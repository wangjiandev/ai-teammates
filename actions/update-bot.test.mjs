import assert from "node:assert/strict"
import { beforeEach, mock, test } from "node:test"
import { pathToFileURL } from "node:url"

import { createDatabase } from "../db/client.ts"

const queryDatabase = createDatabase("postgresql://test:test@example.test/test")
let userId
let authError
let databaseError
let databaseCalls
let writes
let updatedRows
let invalidations

mock.module("@clerk/nextjs/server", {
  namedExports: {
    auth: {
      protect: async () => {
        if (authError) throw authError
        return { userId }
      },
    },
  },
})
mock.module("next/cache", {
  namedExports: {
    revalidatePath: (...args) => invalidations.push(args),
  },
})
mock.module(pathToFileURL(`${process.cwd()}/db/index.ts`).href, {
  namedExports: {
    getDb: () => {
      databaseCalls++
      return {
        update: (table) => ({
          set: (values) => ({
            where: (condition) => ({
              returning: async (columns) => {
                writes.push({
                  values,
                  query: queryDatabase
                    .update(table)
                    .set(values)
                    .where(condition)
                    .returning(columns)
                    .toSQL(),
                })
                if (databaseError) throw databaseError
                return updatedRows
              },
            }),
          }),
        }),
      }
    },
  },
})

const { updateBot } = await import("./bot.ts")
const input = {
  name: "Maya",
  avatar: "maya-seed",
  job: "Writing editor",
  instructions: "Keep the author's voice.",
}

beforeEach(() => {
  userId = "user_bot_update_test"
  authError = undefined
  databaseError = undefined
  databaseCalls = 0
  writes = []
  updatedRows = [{ id: "bot_test" }]
  invalidations = []
})

test("signed-out updates never access the database", async () => {
  authError = new Error("Signed out")
  await assert.rejects(updateBot("bot_test", input), authError)
  assert.equal(databaseCalls, 0)
  assert.deepEqual(invalidations, [])
})

test("blank required fields return field errors without writing", async () => {
  const result = await updateBot("bot_test", {
    ...input,
    name: "  ",
    avatar: "\n",
    job: "\t",
  })
  assert.equal(result.success, false)
  assert.deepEqual(result.fieldErrors.name, ["Name is required."])
  assert.deepEqual(result.fieldErrors.avatar, ["Choose a face for your bot."])
  assert.deepEqual(result.fieldErrors.job, ["Job is required."])
  assert.equal(databaseCalls, 0)
})

test("invalid bot IDs are rejected before accessing the database", async () => {
  for (const botId of [undefined, null, "", "  ", 42, {}]) {
    assert.deepEqual(await updateBot(botId, input), {
      success: false,
      error: "Could not find your bot.",
    })
  }
  assert.equal(databaseCalls, 0)
})

test("updates are constrained by the bot ID and current Clerk user in SQL", async () => {
  const botId = "bot_' OR 1=1 --"
  await updateBot(botId, input)
  userId = "user_next_session"
  await updateBot(botId, input)

  for (const [index, owner] of [
    "user_bot_update_test",
    "user_next_session",
  ].entries()) {
    const { sql, params } = writes[index].query
    assert.match(
      sql,
      /where \("bots"\."id" = \$\d+ and "bots"\."user_id" = \$\d+\)/
    )
    assert.ok(params.includes(botId))
    assert.ok(params.includes(owner))
    assert.ok(!sql.includes(botId))
    assert.ok(!sql.includes(owner))
  }
})

test("client fields cannot overwrite ownership, IDs, timestamps, or external IDs", async () => {
  const result = await updateBot("bot_test", {
    ...input,
    id: "client_id",
    botId: "client_bot_id",
    userId: "another_user",
    createdAt: new Date(),
    sandboxId: "client_sandbox",
  })
  assert.deepEqual(result, { success: true, botId: "bot_test" })
  assert.deepEqual(writes[0].values, input)
  assert.doesNotMatch(
    writes[0].query.sql.split(" where ")[0],
    /user_id|created_at|sandbox_id/
  )
  assert.deepEqual(invalidations, [["/(dashboard)", "layout"]])
})

test("trims text and normalizes blank or omitted instructions to null", async () => {
  await updateBot("bot_test", {
    ...input,
    name: " Maya ",
    avatar: " maya-seed ",
    job: " Writing editor ",
    instructions: "  ",
  })
  assert.deepEqual(writes[0].values, { ...input, instructions: null })

  const requiredInput = { ...input }
  delete requiredInput.instructions
  await updateBot("bot_test", requiredInput)
  assert.equal(writes[1].values.instructions, null)
  await updateBot("bot_test", { ...input, instructions: " Be concise. " })
  assert.equal(writes[2].values.instructions, "Be concise.")
})

test("missing or unowned bots return the same safe error without revalidation", async () => {
  updatedRows = []
  for (const botId of ["missing_bot", "another_users_bot"]) {
    assert.deepEqual(await updateBot(botId, input), {
      success: false,
      error: "Could not find your bot.",
    })
  }
  assert.deepEqual(invalidations, [])
})

test("database failures return a safe error without revalidation", async () => {
  databaseError = new Error("Sensitive database details")
  const log = mock.method(console, "error", () => {})
  try {
    assert.deepEqual(await updateBot("bot_test", input), {
      success: false,
      error: "Could not update your bot. Please try again.",
    })
    assert.deepEqual(invalidations, [])
  } finally {
    log.mock.restore()
  }
})
