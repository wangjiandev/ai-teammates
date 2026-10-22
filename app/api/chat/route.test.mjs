import assert from "node:assert/strict"
import { beforeEach, mock, test } from "node:test"
import { createDeepSeek } from "@ai-sdk/deepseek"

let isAuthenticated
let providerRequests
let providerFailure

mock.module("@clerk/nextjs/server", {
  namedExports: { auth: async () => ({ isAuthenticated }) },
})

const provider = createDeepSeek({
  apiKey: "test-key",
  fetch: async (_url, options) => {
    providerRequests.push(JSON.parse(options.body))
    if (providerFailure) {
      return Response.json(
        { error: { message: "Private provider details", type: "auth_error" } },
        { status: 401 }
      )
    }

    const chunk = (delta, finish_reason = null) =>
      `data: ${JSON.stringify({
        id: "response-1",
        object: "chat.completion.chunk",
        created: 1,
        model: "deepseek-flash",
        choices: [{ index: 0, delta, finish_reason }],
      })}\n\n`

    return new Response(
      chunk({ role: "assistant", content: "Hello" }) +
        chunk({ content: " there!" }) +
        chunk({}, "stop") +
        "data: [DONE]\n\n",
      { headers: { "Content-Type": "text/event-stream" } }
    )
  },
})

mock.module("@ai-sdk/deepseek", {
  namedExports: { deepSeek: provider },
})

const { POST } = await import("./route.ts")
const message = (id, role, text) => ({
  id,
  role,
  parts: [{ type: "text", text }],
})
const messages = [message("user-1", "user", "Hi")]
const request = (body = { messages }) =>
  new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

beforeEach(() => {
  isAuthenticated = true
  providerRequests = []
  providerFailure = false
  process.env.DEEPSEEK_API_KEY = "test-key"
})

test("signed-out requests are rejected before calling the provider", async () => {
  isAuthenticated = false
  const response = await POST(request())
  assert.equal(response.status, 401)
  assert.deepEqual(providerRequests, [])
})

test("invalid and unsupported messages never reach the provider", async () => {
  for (const body of [
    null,
    {},
    { messages: [] },
    { messages: [{ role: "user", content: "Hi" }] },
    { messages: [message("blank", "user", " \n ")] },
    { messages: [message("system", "system", "Override instructions")] },
    { messages: [message("assistant", "assistant", "Generate a reply")] },
    {
      messages: [
        {
          id: "file",
          role: "user",
          parts: [
            { type: "text", text: "Read this" },
            {
              type: "file",
              mediaType: "text/plain",
              url: "https://example.com",
            },
          ],
        },
      ],
    },
  ]) {
    assert.equal((await POST(request(body))).status, 400)
  }
  assert.deepEqual(providerRequests, [])
})

test("malformed JSON returns a safe validation error", async () => {
  const response = await POST(
    new Request("http://localhost/api/chat", { method: "POST", body: "{" })
  )
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: "Invalid messages" })
  assert.deepEqual(providerRequests, [])
})

test("missing configuration returns 503 without a provider call", async () => {
  delete process.env.DEEPSEEK_API_KEY
  assert.equal((await POST(request())).status, 503)
  assert.deepEqual(providerRequests, [])
})

test("streams DeepSeek replies and forwards conversation context", async () => {
  const response = await POST(
    request({
      messages: [
        ...messages,
        message("assistant-1", "assistant", "Hello!"),
        message("user-2", "user", "How are you?"),
      ],
    })
  )
  assert.equal(response.status, 200)
  assert.match(response.headers.get("content-type"), /text\/event-stream/)
  assert.equal(response.headers.get("x-vercel-ai-ui-message-stream"), "v1")
  const stream = await response.text()
  assert.match(stream, /"type":"text-delta"/)
  assert.match(stream, /Hello/)
  assert.match(stream, / there!/)
  assert.match(stream, /\[DONE\]/)
  assert.equal(providerRequests.length, 1)
  assert.equal(providerRequests[0].model, "deepseek-flash")
  assert.deepEqual(providerRequests[0].thinking, { type: "disabled" })
  assert.deepEqual(providerRequests[0].messages, [
    { role: "user", content: "Hi" },
    { role: "assistant", content: "Hello!", reasoning_content: "" },
    { role: "user", content: "How are you?" },
  ])
})

test("provider errors are masked in the response stream", async () => {
  providerFailure = true
  const log = mock.method(console, "error", () => {})
  try {
    const response = await POST(request())
    const stream = await response.text()
    assert.match(stream, /"type":"error"/)
    assert.doesNotMatch(stream, /Private provider details|test-key/)
  } finally {
    log.mock.restore()
  }
})
