"use client"

import { useEffect, useState } from "react"
import { defaultFilter } from "cmdk"
import { SearchIcon } from "lucide-react"
import { useRouter } from "next/navigation"

import {
  ChatListItemContent,
  type ChatSummary,
} from "@/components/chat-list-item"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Kbd, KbdGroup } from "@/components/ui/kbd"

export function SidebarSearch({ chats }: { chats: ChatSummary[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.key.toLowerCase() === "k" &&
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.shiftKey &&
        !event.repeat &&
        !event.isComposing &&
        !event.defaultPrevented
      ) {
        event.preventDefault()
        setSearch("")
        setOpen((current) => !current)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) setSearch("")
    setOpen(nextOpen)
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        aria-label="Search chats"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-keyshortcuts="Meta+K Control+K"
        onClick={() => handleOpenChange(true)}
        className="h-8 w-full min-w-0 justify-start gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base font-normal text-muted-foreground transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 has-data-[icon=inline-start]:pl-2.5 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
      >
        <SearchIcon data-icon="inline-start" />
        <span className="flex-1 text-left">Search</span>
        <KbdGroup aria-hidden="true">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        title="Search chats"
        description="Find a chat by its name or recent message."
        className="sm:max-w-lg"
      >
        <Command
          loop
          label="Search chats"
          filter={(_id, query, keywords) => defaultFilter("", query, keywords)}
        >
          <CommandInput
            placeholder="Search chats..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList label="Chats">
            <CommandEmpty>No chats found.</CommandEmpty>
            <CommandGroup heading="Chats">
              {chats.map((chat) => (
                <CommandItem
                  key={chat.id}
                  value={chat.id}
                  keywords={[chat.name, chat.lastMessagePreview ?? ""]}
                  onSelect={() => {
                    handleOpenChange(false)
                    router.push(`/chats/${encodeURIComponent(chat.id)}`)
                  }}
                  className="h-12 gap-3 [&>svg:last-child]:hidden"
                >
                  <ChatListItemContent chat={chat} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
