import { ChatAvatar } from "@/components/chat-avatar"

export type ChatSummary = {
  id: string
  name: string
  avatar: string
  lastMessagePreview: string | null
  lastMessageAt: string
  lastMessageAge: string
  lastMessageTitle: string
}

export function ChatListItemContent({ chat }: { chat: ChatSummary }) {
  return (
    <>
      <ChatAvatar seed={chat.avatar} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate font-medium">{chat.name}</span>
          <time
            dateTime={chat.lastMessageAt}
            title={chat.lastMessageTitle}
            className="shrink-0 text-xs text-muted-foreground"
          >
            {chat.lastMessageAge}
          </time>
        </span>
        {chat.lastMessagePreview && (
          <span className="truncate text-xs text-muted-foreground">
            {chat.lastMessagePreview}
          </span>
        )}
      </span>
    </>
  )
}
