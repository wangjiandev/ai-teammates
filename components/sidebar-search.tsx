"use client"

import { useEffect, useState } from "react"
import { defaultFilter } from "cmdk"
import { SearchIcon } from "lucide-react"
import { useRouter } from "next/navigation"

import {
  ChatListItemContent,
  type ChatSummary,
} from "@/components/chat-list-item"
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
import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar"

export function SidebarSearch({ chats }: { chats: ChatSummary[] }) {
  const router = useRouter()
  const { state, isMobile } = useSidebar()
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
      <SidebarMenuButton
        type="button"
        variant={state === "collapsed" && !isMobile ? "default" : "outline"}
        tooltip="Search chats"
        aria-label="Search chats"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-keyshortcuts="Meta+K Control+K"
        onClick={() => handleOpenChange(true)}
        className="group-data-[collapsible=icon]:justify-center"
      >
        <SearchIcon data-icon="inline-start" />
        <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">
          Search
        </span>
        <KbdGroup
          aria-hidden="true"
          className="group-data-[collapsible=icon]:hidden"
        >
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </SidebarMenuButton>
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
