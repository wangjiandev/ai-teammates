import { deepSeek } from "@ai-sdk/deepseek"
import { chat, defaultStorage } from "@trigger.dev/sdk/ai"
import { safeValidateUIMessages } from "ai"

export const chatAgent = chat.agent({
  id: "chat-agent",
  storage: defaultStorage,
  onValidateMessages: async ({ messages }) => {
    const result = await safeValidateUIMessages({ messages })

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
      throw new Error("Invalid messages")
    }

    return result.data
  },
  uiMessageStreamOptions: {
    onError: () => "Could not get a response. Please try again.",
  },
  run: async ({ messages, signal, streamText }) => {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error("Chat is unavailable")
    }

    return streamText({
      model: deepSeek("deepseek-flash"),
      messages,
      providerOptions: { deepseek: { thinking: { type: "disabled" } } },
      abortSignal: signal,
    })
  },
})
