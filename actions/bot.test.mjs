import assert from "node:assert/strict"
import { beforeEach, mock, test } from "node:test"
import { pathToFileURL } from "node:url"

const trustedUserId = "user_bot_action_test"
let authError
let databaseError
let databaseCalls
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
        insert: () => ({
          values: (values) => ({
            returning: async () => {
              if (databaseError) throw databaseError
              writes.push(values)
              return [{ id: "generated-bot-id" }]
            },
          }),
        }),
      }
    },
  },
})

const { createBot } = await import("./bot.ts")
const input = { name: "Ada", avatar: "gaze-seed", job: "Research assistant" }

beforeEach(() => {
  authError = undefined
  databaseError = undefined
  databaseCalls = 0
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

test("client-supplied ownership and generated fields cannot override the server", async () => {
  const result = await createBot({
    ...input,
    userId: "another-user",
    id: "client-id",
    createdAt: new Date(),
    sandboxId: "client-sandbox",
  })
  assert.deepEqual(result, { success: true, botId: "generated-bot-id" })
  assert.deepEqual(writes, [
    { ...input, userId: trustedUserId, instructions: null },
  ])
  assert.deepEqual(invalidations, ["/"])
})

test("text is trimmed and optional instructions can be omitted or blank", async () => {
  await createBot({
    ...input,
    name: " Ada ",
    job: " Research assistant ",
    instructions: "  ",
  })
  assert.equal(writes[0].name, "Ada")
  assert.equal(writes[0].job, "Research assistant")
  assert.equal(writes[0].instructions, null)
  await createBot({ ...input, instructions: " Cite sources. " })
  assert.equal(writes[1].instructions, "Cite sources.")
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
  } finally {
    log.mock.restore()
  }
})
