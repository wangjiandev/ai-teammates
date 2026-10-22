"use server"

import { auth } from "@clerk/nextjs/server"
import { auth as triggerAuth } from "@trigger.dev/sdk"
import { chat, defaultStorage } from "@trigger.dev/sdk/ai"
import { z } from "zod"

import { getChat } from "@/app/(dashboard)/chats/queries"
import type { chatAgent } from "@/trigger/chat"

const startSession =
  chat.createStartSessionAction<typeof chatAgent>("chat-agent")
const loadTranscript = chat.createLoadTranscriptAction(defaultStorage)

async function requireOwnedChat(chatId: unknown) {
  await auth.protect()
  const parsed = z.string().trim().min(1).safeParse(chatId)

  if (!parsed.success) throw new Error("Could not find your chat.")

  const ownedChat = await getChat(parsed.data)
  if (!ownedChat) throw new Error("Could not find your chat.")

  return ownedChat.id
}

function createAccessToken(chatId: string) {
  return triggerAuth.createPublicToken({
    scopes: { read: { sessions: chatId }, write: { sessions: chatId } },
    expirationTime: "1h",
  })
}

export async function startChatSession(chatId: string) {
  const id = await requireOwnedChat(chatId)
  return startSession({ chatId: id })
}

export async function mintChatAccessToken(chatId: string) {
  const id = await requireOwnedChat(chatId)
  return createAccessToken(id)
}

export async function loadChatTranscript(chatId: string) {
  const id = await requireOwnedChat(chatId)
  const transcript = await loadTranscript({ chatId: id })

  return {
    messages: transcript.messages,
    session:
      transcript.messages.length > 0
        ? {
            publicAccessToken: await createAccessToken(id),
            lastEventId: transcript.cursors?.lastOutEventId,
          }
        : undefined,
  }
}
