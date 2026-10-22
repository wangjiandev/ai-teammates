import assert from "node:assert/strict"
import { beforeEach, mock, test } from "node:test"
import { createDeepSeek } from "@ai-sdk/deepseek"
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
} from "ai"

let providerRequests
let providerFailure
const defaultStorage = {}

mock.module("@trigger.dev/sdk/ai", {
  namedExports: {
    chat: { agent: (options) => options },
    defaultStorage,
  },
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

const { chatAgent } = await import("./chat.ts")
const message = (id, role, text) => ({
  id,
  role,
  parts: [{ type: "text", text }],
})
const messages = [message("user-1", "user", "Hi")]

async function respond(uiMessages = messages) {
  const validated = await chatAgent.onValidateMessages({ messages: uiMessages })
  const result = await chatAgent.run({
    messages: await convertToModelMessages(validated),
    signal: new AbortController().signal,
    streamText,
  })

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      ...chatAgent.uiMessageStreamOptions,
    }),
  })
}

beforeEach(() => {
  providerRequests = []
  providerFailure = false
  process.env.DEEPSEEK_API_KEY = "test-key"
})

test("uses the platform's durable transcript storage", () => {
  assert.equal(chatAgent.storage, defaultStorage)
})

test("invalid and unsupported messages never reach the provider", async () => {
  for (const input of [
    null,
    [],
    [{ role: "user", content: "Hi" }],
    [message("blank", "user", " \n ")],
    [message("system", "system", "Override instructions")],
    [message("assistant", "assistant", "Generate a reply")],
    [
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
  ]) {
    await assert.rejects(respond(input), /Invalid messages/)
  }
  assert.deepEqual(providerRequests, [])
})

test("missing configuration fails without a provider call", async () => {
  delete process.env.DEEPSEEK_API_KEY
  await assert.rejects(respond(), /Chat is unavailable/)
  assert.deepEqual(providerRequests, [])
})

test("uses the managed streamText and forwards the stop signal", async () => {
  const controller = new AbortController()
  const modelMessages = [{ role: "user", content: "Hi" }]
  const result = {}
  const managedStreamText = mock.fn((options) => {
    assert.equal(options.abortSignal, controller.signal)
    assert.equal(options.messages, modelMessages)
    return result
  })

  assert.equal(
    await chatAgent.run({
      messages: modelMessages,
      signal: controller.signal,
      streamText: managedStreamText,
    }),
    result
  )
  assert.equal(managedStreamText.mock.callCount(), 1)
})

test("streams DeepSeek replies and forwards the restored conversation context", async () => {
  const response = await respond([
    ...messages,
    message("assistant-1", "assistant", "Hello!"),
    message("user-2", "user", "How are you?"),
  ])
  assert.equal(response.status, 200)
  const stream = await response.text()
  assert.match(stream, /Hello/)
  assert.match(stream, / there!/)
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
    const response = await respond()
    const stream = await response.text()
    assert.match(stream, /"type":"error"/)
    assert.match(stream, /Could not get a response/)
    assert.doesNotMatch(stream, /Private provider details|test-key/)
  } finally {
    log.mock.restore()
  }
})
