import assert from "node:assert/strict"
import { beforeEach, mock, test } from "node:test"
import { pathToFileURL } from "node:url"

const trustedUserId = "user_bot_action_test"
let authError
let databaseError
let databaseCalls
let batches
let writes
let invalidations

mock.module("@clerk/nextjs/server", {
  namedExports: {
    auth: {
      protect: async () => {
        if (authError) throw authError
        return { userId: trustedUserId }
      },
    },
  },
})
mock.module("next/cache", {
  namedExports: { revalidatePath: (path) => invalidations.push(path) },
})
mock.module(pathToFileURL(`${process.cwd()}/db/index.ts`).href, {
  namedExports: {
    getDb: () => {
      databaseCalls++
      return {
        insert: (table) => ({
          values: (values) => ({ table, values }),
        }),
        batch: async (queries) => {
          batches.push(queries)
          if (databaseError) throw databaseError
          writes.push(...queries)
          return []
        },
      }
    },
  },
})

const { createBot } = await import("./bot.ts")
const { bots, chats, chatMembers } = await import("../db/schema.ts")
const input = { name: "Ada", avatar: "gaze-seed", job: "Research assistant" }

beforeEach(() => {
  authError = undefined
  databaseError = undefined
  databaseCalls = 0
  batches = []
  writes = []
  invalidations = []
})

test("signed-out requests never reach the database", async () => {
  authError = new Error("Signed out")
  await assert.rejects(createBot(input), authError)
  assert.equal(databaseCalls, 0)
})

test("blank required fields return field errors without a write", async () => {
  const result = await createBot({ ...input, name: "  ", job: "\n" })
  assert.equal(result.success, false)
  assert.deepEqual(result.fieldErrors.name, ["Name is required."])
  assert.deepEqual(result.fieldErrors.job, ["Job is required."])
  assert.equal(databaseCalls, 0)
})

test("creates one owned bot, direct chat, and linked membership in a single batch", async () => {
  const result = await createBot(input)
  assert.equal(result.success, true)
  assert.match(result.botId, /^[A-Za-z0-9_-]{21}$/)
  assert.match(result.chatId, /^[A-Za-z0-9_-]{21}$/)
  assert.notEqual(result.botId, result.chatId)
  assert.equal(batches.length, 1)
  assert.deepEqual(writes, [
    {
      table: bots,
      values: {
        ...input,
        id: result.botId,
        instructions: null,
        userId: trustedUserId,
      },
    },
    {
      table: chats,
      values: {
        id: result.chatId,
        userId: trustedUserId,
        kind: "direct",
        name: null,
      },
    },
    {
      table: chatMembers,
      values: { chatId: result.chatId, botId: result.botId },
    },
  ])
  assert.deepEqual(invalidations, ["/"])
})

test("client-supplied ownership and generated fields cannot override the batch", async () => {
  const result = await createBot({
    ...input,
    userId: "another-user",
    id: "client-id",
    botId: "client-bot-id",
    chatId: "client-chat-id",
    kind: "group",
    createdAt: new Date(),
    sandboxId: "client-sandbox",
  })
  assert.equal(result.success, true)
  assert.notEqual(result.botId, "client-id")
  assert.notEqual(result.botId, "client-bot-id")
  assert.notEqual(result.chatId, "client-chat-id")
  assert.equal(writes[0].values.userId, trustedUserId)
  assert.equal(writes[0].values.sandboxId, undefined)
  assert.equal(writes[0].values.createdAt, undefined)
  assert.equal(writes[1].values.userId, trustedUserId)
  assert.equal(writes[1].values.kind, "direct")
  assert.equal(writes[1].values.name, null)
  assert.deepEqual(writes[2].values, {
    chatId: result.chatId,
    botId: result.botId,
  })
})

test("text is trimmed and optional instructions can be omitted or blank", async () => {
  await createBot({
    ...input,
    name: " Ada ",
    job: " Research assistant ",
    instructions: "  ",
  })
  assert.equal(writes[0].values.name, "Ada")
  assert.equal(writes[0].values.job, "Research assistant")
  assert.equal(writes[0].values.instructions, null)
  await createBot({ ...input, instructions: " Cite sources. " })
  assert.equal(writes[3].values.instructions, "Cite sources.")
})

test("database failures return a safe error and do not refresh the page", async () => {
  databaseError = new Error("Internal database details")
  const log = mock.method(console, "error", () => {})
  try {
    const result = await createBot(input)
    assert.deepEqual(result, {
      success: false,
      error: "Could not create your bot. Please try again.",
    })
    assert.deepEqual(invalidations, [])
    assert.equal(batches.length, 1)
    assert.deepEqual(writes, [])
  } finally {
    log.mock.restore()
  }
})
