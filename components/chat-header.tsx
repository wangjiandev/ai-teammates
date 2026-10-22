import { MonitorIcon } from "lucide-react"

import { BotDialog } from "@/components/bot-dialog"
import { ChatAvatar } from "@/components/chat-avatar"
import { Button } from "@/components/ui/button"
import type { EditableBot } from "@/db/schema"

export function ChatHeader({
  bot,
  chatId,
}: {
  bot: EditableBot | null
  chatId: string
}) {
  return (
    <header className="flex h-10 shrink-0 items-center justify-between gap-4 border-b px-4">
      {bot ? (
        <h1 className="min-w-0" aria-label={bot.name}>
          <BotDialog bot={bot} />
        </h1>
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          <ChatAvatar seed={chatId} className="size-4" />
          <h1 className="truncate text-sm font-semibold">New chat</h1>
        </div>
      )}
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Desktop">
        <MonitorIcon />
      </Button>
    </header>
  )
}
