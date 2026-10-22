import assert from "node:assert/strict"
import { beforeEach, mock, test } from "node:test"
import { pathToFileURL } from "node:url"

let authError
let ownedChats
let lookups
let starts
let tokens
let loads
let transcripts
let storageError
const defaultStorage = {}

mock.module("@clerk/nextjs/server", {
  namedExports: {
    auth: {
      protect: async () => {
        if (authError) throw authError
        return { userId: "user_chat_test" }
      },
    },
  },
})
mock.module(
  pathToFileURL(`${process.cwd()}/app/(dashboard)/chats/queries.ts`).href,
  {
    namedExports: {
      getChat: async (id) => {
        lookups.push(id)
        return ownedChats.has(id) ? { id } : null
      },
    },
  }
)
mock.module("@trigger.dev/sdk", {
  namedExports: {
    auth: {
      createPublicToken: async (options) => {
        tokens.push(options)
        return `token:${options.scopes.read.sessions}`
      },
    },
  },
})
mock.module("@trigger.dev/sdk/ai", {
  namedExports: {
    defaultStorage,
    chat: {
      createStartSessionAction: (task) => async (params) => {
        starts.push({ task, ...params })
        return { publicAccessToken: `token:${params.chatId}` }
      },
      createLoadTranscriptAction:
        (storage) =>
        async ({ chatId }) => {
          assert.equal(storage, defaultStorage)
          loads.push(chatId)
          if (storageError) throw storageError
          return transcripts.get(chatId) ?? { messages: [], state: null }
        },
    },
  },
})

const { startChatSession, mintChatAccessToken, loadChatTranscript } =
  await import("./chat.ts")
const actions = [startChatSession, mintChatAccessToken, loadChatTranscript]

beforeEach(() => {
  authError = undefined
  ownedChats = new Set(["chat_a", "chat_b"])
  lookups = []
  starts = []
  tokens = []
  loads = []
  transcripts = new Map()
  storageError = undefined
})

test("signed-out calls cannot start, read, or mint a token for a chat", async () => {
  authError = new Error("Signed out")
  for (const action of actions) {
    await assert.rejects(action("chat_a"), authError)
  }
  assert.deepEqual(lookups, [])
  assert.deepEqual(starts, [])
  assert.deepEqual(tokens, [])
  assert.deepEqual(loads, [])
})

test("invalid IDs are rejected before querying or contacting Trigger.dev", async () => {
  for (const id of [null, undefined, {}, [], 42, "", " \n "]) {
    for (const action of actions) {
      await assert.rejects(action(id), /Could not find your chat/)
    }
  }
  assert.deepEqual(lookups, [])
  assert.deepEqual(starts, [])
  assert.deepEqual(tokens, [])
  assert.deepEqual(loads, [])
})

test("missing and other users' chats cannot reach any Trigger.dev operation", async () => {
  for (const id of ["missing", "another_users_chat"]) {
    for (const action of actions) {
      await assert.rejects(action(id), /Could not find your chat/)
    }
  }
  assert.deepEqual(starts, [])
  assert.deepEqual(tokens, [])
  assert.deepEqual(loads, [])
})

test("starts only the fixed agent for the owned chat without client metadata", async () => {
  assert.deepEqual(await startChatSession(" chat_a "), {
    publicAccessToken: "token:chat_a",
  })
  assert.deepEqual(starts, [{ task: "chat-agent", chatId: "chat_a" }])
})

test("refresh tokens authorize only the owned chat session", async () => {
  assert.equal(await mintChatAccessToken("chat_a"), "token:chat_a")
  assert.deepEqual(tokens, [
    {
      scopes: {
        read: { sessions: "chat_a" },
        write: { sessions: "chat_a" },
      },
      expirationTime: "1h",
    },
  ])
})

test("reload restores each chat's own messages and matching resume cursor", async () => {
  for (const id of ownedChats) {
    transcripts.set(id, {
      messages: [
        { id: `${id}-user`, role: "user", parts: [{ type: "text", text: id }] },
      ],
      state: { privateRuntimeState: true },
      cursors: {
        lastOutEventId: `${id}-cursor`,
        lastInEventId: "private-input",
      },
    })
  }

  for (const id of ownedChats) {
    assert.deepEqual(await loadChatTranscript(id), {
      messages: transcripts.get(id).messages,
      session: {
        publicAccessToken: `token:${id}`,
        lastEventId: `${id}-cursor`,
      },
    })
  }
  assert.deepEqual(loads, ["chat_a", "chat_b"])
  assert.deepEqual(starts, [])
})

test("new chats load empty without starting a session or minting tokens", async () => {
  assert.deepEqual(await loadChatTranscript("chat_a"), {
    messages: [],
    session: undefined,
  })
  assert.deepEqual(starts, [])
  assert.deepEqual(tokens, [])
})

test("failed transcript reads fail the load instead of resuming with empty history", async () => {
  storageError = new Error("Storage unavailable")
  await assert.rejects(loadChatTranscript("chat_a"), storageError)
  assert.deepEqual(tokens, [])
  assert.deepEqual(starts, [])
})
