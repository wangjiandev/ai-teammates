import assert from "node:assert/strict"
import { beforeEach, mock, test } from "node:test"
import { pathToFileURL } from "node:url"

import { createDatabase } from "../db/client.ts"

const queryDatabase = createDatabase("postgresql://test:test@example.test/test")
let userId
let authError
let databaseCalls
let queries
let rows

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
            findMany: async (config) => {
              queries.push(queryDatabase.query.chats.findMany(config).toSQL())
              return rows
            },
          },
        },
      }
    },
  },
})

const { getUserChats } = await import("./bots.ts")

beforeEach(() => {
  userId = "user_chat_query_test"
  authError = undefined
  databaseCalls = 0
  queries = []
  rows = []
})

test("signed-out queries never access the database", async () => {
  authError = new Error("Signed out")
  await assert.rejects(getUserChats(), authError)
  assert.equal(databaseCalls, 0)
})

test("SQL scopes chats and bot details to the current Clerk user on every call", async () => {
  await getUserChats("user_supplied_by_caller")
  userId = "user_' OR 1=1 --"
  await getUserChats()

  assert.equal(databaseCalls, 2)
  for (const [index, owner] of [
    "user_chat_query_test",
    "user_' OR 1=1 --",
  ].entries()) {
    const query = queries[index]
    assert.equal(query.params.filter((value) => value === owner).length, 2)
    assert.ok(!query.params.includes("user_supplied_by_caller"))
    assert.ok(!query.sql.includes(owner))
    assert.match(query.sql, /"chats"\."user_id" = \$\d+/)
    assert.match(query.sql, /"bots"\."user_id" = \$\d+/)
  }
})

test("SQL orders chats by recency and selects one deterministic owned bot", async () => {
  await getUserChats()
  const { sql, params } = queries[0]
  assert.match(
    sql,
    /order by "chats"\."last_message_at" desc, "chats"\."id" asc/
  )
  assert.match(sql, /"joined_at" asc, "chats_members"\."bot_id" asc/)
  assert.match(sql, /limit \$\d+/)
  assert.ok(params.includes(1))
  assert.doesNotMatch(sql, /instructions|sandbox_id|"job"/)
})

test("returns minimal chat data and handles chats without an owned bot", async () => {
  const chat = {
    id: "chat_test",
    name: null,
    lastMessageAt: new Date("2026-10-20T12:00:00Z"),
    lastMessagePreview: "A recent message",
  }
  const bot = { name: "Quill", avatar: "quill-seed" }
  rows = [
    { ...chat, members: [{ bot }] },
    { ...chat, id: "chat_without_members", members: [] },
  ]
  assert.deepEqual(await getUserChats(), [
    { ...chat, bot },
    { ...chat, id: "chat_without_members", bot: null },
  ])
  rows = []
  assert.deepEqual(await getUserChats(), [])
})
