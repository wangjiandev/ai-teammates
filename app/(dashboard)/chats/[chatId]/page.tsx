import { notFound } from "next/navigation"

import { loadChatTranscript } from "@/actions/chat"
import { getChat } from "@/app/(dashboard)/chats/queries"
import { Chat } from "@/components/chat"
import { ChatHeader } from "@/components/chat-header"

export default async function Page({
  params,
}: {
  params: Promise<{ chatId: string }>
}) {
  const { chatId } = await params
  const chat = await getChat(chatId)

  if (!chat) notFound()

  const transcript = await loadChatTranscript(chat.id)

  return (
    <main className="flex h-svh min-h-0 flex-col">
      <ChatHeader bot={chat.bot} chatId={chat.id} />
      <Chat
        key={chat.id}
        chatId={chat.id}
        botName={chat.bot?.name ?? "Assistant"}
        initialMessages={transcript.messages}
        initialSession={transcript.session}
      />
    </main>
  )
}
