import { deepSeek } from "@ai-sdk/deepseek"
import { auth } from "@clerk/nextjs/server"
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
} from "ai"

export const maxDuration = 60

export async function POST(request: Request) {
  const { isAuthenticated } = await auth()
  if (!isAuthenticated) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const result = await safeValidateUIMessages({ messages: body?.messages })

  if (
    !result.success ||
    result.data.length === 0 ||
    result.data.at(-1)?.role !== "user" ||
    result.data.some(
      (message) =>
        !["user", "assistant"].includes(message.role) ||
        message.parts.some(
          (part) => part.type !== "text" && part.type !== "step-start"
        )
    ) ||
    !result.data
      .at(-1)
      ?.parts.some((part) => part.type === "text" && part.text.trim())
  ) {
    return Response.json({ error: "Invalid messages" }, { status: 400 })
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    return Response.json({ error: "Chat is unavailable" }, { status: 503 })
  }

  const response = streamText({
    model: deepSeek("deepseek-flash"),
    messages: await convertToModelMessages(result.data),
    providerOptions: { deepseek: { thinking: { type: "disabled" } } },
    abortSignal: request.signal,
  })

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: response.stream }),
  })
}
