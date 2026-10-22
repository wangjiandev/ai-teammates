import assert from "node:assert/strict"
import { beforeEach, mock, test } from "node:test"
import { pathToFileURL } from "node:url"

import { createDatabase } from "../db/client.ts"

const queryDatabase = createDatabase("postgresql://test:test@example.test/test")
let userId
let authError
let databaseError
let databaseCalls
let queries
let row

mock.module("server-only", { namedExports: {} })
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
mock.module(pathToFileURL(`${process.cwd()}/db/index.ts`).href, {
  namedExports: {
    getDb: () => {
      databaseCalls++
      return {
        select: queryDatabase.select.bind(queryDatabase),
        query: {
          chats: {
            findFirst: async (config) => {
              queries.push(queryDatabase.query.chats.findFirst(config).toSQL())
              if (databaseError) throw databaseError
              return row
            },
          },
        },
      }
    },
  },
})

const { getChat } = await import("../app/(dashboard)/chats/queries.ts")

beforeEach(() => {
  userId = "user_chat_detail_test"
  authError = undefined
  databaseError = undefined
  databaseCalls = 0
  queries = []
  row = undefined
})

test("signed-out chat lookup never accesses the database", async () => {
  authError = new Error("Signed out")
  await assert.rejects(getChat("chat_test"), authError)
  assert.equal(databaseCalls, 0)
})

test("SQL scopes the chat ID and bot details to the current Clerk user", async () => {
  const chatId = "chat_' OR 1=1 --"
  await getChat(chatId, "user_supplied_by_caller")
  userId = "user_other_session"
  await getChat(chatId)

  assert.equal(databaseCalls, 2)
  for (const [index, owner] of [
    "user_chat_detail_test",
    "user_other_session",
  ].entries()) {
    const query = queries[index]
    assert.ok(query.params.includes(chatId))
    assert.equal(query.params.filter((value) => value === owner).length, 2)
    assert.ok(!query.params.includes("user_supplied_by_caller"))
    assert.ok(!query.sql.includes(chatId))
    assert.ok(!query.sql.includes(owner))
    assert.match(query.sql, /"chats"\."id" = \$\d+/)
    assert.match(query.sql, /"chats"\."user_id" = \$\d+/)
    assert.match(query.sql, /"bots"\."user_id" = \$\d+/)
  }
})

test("selects the first deterministic owned member's editable fields", async () => {
  await getChat("chat_test")
  const { sql, params } = queries[0]
  assert.match(sql, /"joined_at" asc, "chats_members"\."bot_id" asc/)
  assert.match(sql, /limit \$\d+/)
  assert.ok(params.includes(1))
  for (const field of ["id", "name", "avatar", "job", "instructions"]) {
    assert.ok(sql.includes(`"chats_members_bot"."${field}"`))
  }
  assert.doesNotMatch(sql, /sandbox_id/)
})

test("returns the chat with its first bot, with a safe fallback for no members", async () => {
  const bot = {
    id: "bot_test",
    name: "Quill",
    avatar: "quill-seed",
    job: "Writing editor",
    instructions: "Keep the author's voice.",
  }
  row = { id: "chat_test", members: [{ bot }] }
  assert.deepEqual(await getChat("chat_test"), { id: "chat_test", bot })

  row = { id: "chat_test", members: [] }
  assert.deepEqual(await getChat("chat_test"), { id: "chat_test", bot: null })
})

test("missing or inaccessible chats return null", async () => {
  assert.equal(await getChat("missing_chat"), null)
  assert.equal(await getChat("another_users_chat"), null)
})

test("database failures propagate instead of appearing as a missing chat", async () => {
  databaseError = new Error("Database unavailable")
  await assert.rejects(getChat("chat_test"), databaseError)
})
