import assert from "node:assert/strict"
import { beforeEach, mock, test } from "node:test"
import { pathToFileURL } from "node:url"

import { createDatabase } from "../db/client.ts"

const queryDatabase = createDatabase("postgresql://test:test@example.test/test")
let userId
let authError
let databaseError
let databaseCalls
let batches
let deletedRows
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
        select: queryDatabase.select.bind(queryDatabase),
        delete: queryDatabase.delete.bind(queryDatabase),
        batch: async (statements) => {
          batches.push(statements.map((statement) => statement.toSQL()))
          if (databaseError) throw databaseError
          return [{ rowCount: 1 }, deletedRows]
        },
      }
    },
  },
})

const { deleteBot } = await import("./bot.ts")

beforeEach(() => {
  userId = "user_bot_delete_test"
  authError = undefined
  databaseError = undefined
  databaseCalls = 0
  batches = []
  deletedRows = [{ id: "bot_test" }]
  invalidations = []
})

test("signed-out deletions never access the database", async () => {
  authError = new Error("Signed out")
  await assert.rejects(deleteBot("bot_test"), authError)
  assert.equal(databaseCalls, 0)
  assert.deepEqual(invalidations, [])
})

test("invalid IDs are rejected before accessing the database", async () => {
  for (const botId of [undefined, null, "", "  ", 42, {}, ["bot_test"]]) {
    assert.deepEqual(await deleteBot(botId), {
      success: false,
      error: "Could not find your bot.",
    })
  }
  assert.equal(databaseCalls, 0)
})

test("deletes direct chats before the bot in one batch and refreshes the dashboard", async () => {
  assert.deepEqual(await deleteBot(" bot_test "), { success: true })
  assert.equal(batches.length, 1)
  assert.equal(batches[0].length, 2)
  assert.match(batches[0][0].sql, /^delete from "chats"/)
  assert.match(batches[0][1].sql, /^delete from "bots"/)
  assert.match(batches[0][1].sql, /returning "id"$/)
  assert.ok(batches[0][1].params.includes("bot_test"))
  assert.deepEqual(invalidations, [["/(dashboard)", "layout"]])
})

test("SQL restricts both deletions to the current Clerk user and parameterizes the bot ID", async () => {
  const botId = "bot_' OR 1=1 --"
  await deleteBot(botId, "user_supplied_by_caller")
  userId = "user_next_session"
  await deleteBot(botId)

  for (const [index, owner] of [
    "user_bot_delete_test",
    "user_next_session",
  ].entries()) {
    const [chatDelete, botDelete] = batches[index]
    assert.match(chatDelete.sql, /"chats"\."user_id" = \$\d+/)
    assert.match(chatDelete.sql, /"chats"\."kind" = \$\d+/)
    assert.match(chatDelete.sql, /"chat_members"\."bot_id" in \(select/)
    assert.match(chatDelete.sql, /"bots"\."id" = \$\d+/)
    assert.match(chatDelete.sql, /"bots"\."user_id" = \$\d+/)
    assert.equal(chatDelete.params.filter((value) => value === owner).length, 2)
    assert.ok(chatDelete.params.includes("direct"))
    assert.ok(!chatDelete.params.includes("group"))
    assert.match(
      botDelete.sql,
      /where \("bots"\."id" = \$\d+ and "bots"\."user_id" = \$\d+\)/
    )
    for (const query of [chatDelete, botDelete]) {
      assert.ok(query.params.includes(botId))
      assert.ok(query.params.includes(owner))
      assert.ok(!query.params.includes("user_supplied_by_caller"))
      assert.ok(!query.sql.includes(botId))
      assert.ok(!query.sql.includes(owner))
    }
  }
})

test("missing or unowned bots return the same safe error without revalidation", async () => {
  deletedRows = []
  for (const botId of ["missing_bot", "another_users_bot"]) {
    assert.deepEqual(await deleteBot(botId), {
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
    assert.deepEqual(await deleteBot("bot_test"), {
      success: false,
      error: "Could not delete your bot. Please try again.",
    })
    assert.deepEqual(invalidations, [])
    assert.equal(batches.length, 1)
  } finally {
    log.mock.restore()
  }
})
