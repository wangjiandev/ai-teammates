import { notFound } from "next/navigation"

import { getChat } from "@/app/(dashboard)/chats/queries"
import { ChatHeader } from "@/components/chat-header"

export default async function Page({
  params,
}: {
  params: Promise<{ chatId: string }>
}) {
  const { chatId } = await params
  const chat = await getChat(chatId)

  if (!chat) notFound()

  return (
    <main className="flex min-h-svh flex-col">
      <ChatHeader bot={chat.bot} chatId={chat.id} />
    </main>
  )
}
