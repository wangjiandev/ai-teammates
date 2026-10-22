import { UserButton } from "@clerk/nextjs"
import { format, formatDistanceStrict } from "date-fns"
import Link from "next/link"

import { ChatListItemContent } from "@/components/chat-list-item"
import { SidebarCreateMenu } from "@/components/sidebar-create-menu"
import { SidebarSearch } from "@/components/sidebar-search"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { getUserChats } from "@/queries/bots"

export async function AppSidebar() {
  const rows = await getUserChats()
  const now = new Date()
  const chats = rows.map((chat) => ({
    id: chat.id,
    name: chat.name ?? chat.bot?.name ?? "New chat",
    avatar: chat.bot?.avatar ?? chat.id,
    lastMessagePreview: chat.lastMessagePreview,
    lastMessageAt: chat.lastMessageAt.toISOString(),
    lastMessageAge: formatDistanceStrict(chat.lastMessageAt, now),
    lastMessageTitle: format(chat.lastMessageAt, "PPpp"),
  }))

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex justify-end">
          <SidebarCreateMenu />
        </div>
        <SidebarSearch chats={chats} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu aria-label="Chats">
              {chats.map((chat) => (
                <SidebarMenuItem key={chat.id}>
                  <SidebarMenuButton
                    render={
                      <Link href={`/chats/${encodeURIComponent(chat.id)}`} />
                    }
                    size="lg"
                    className="gap-3"
                  >
                    <ChatListItemContent chat={chat} />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="mt-auto">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<div />}
              className="p-0 has-focus-visible:ring-2"
            >
              <UserButton
                showName
                appearance={{
                  elements: {
                    rootBox: "h-full w-full",
                    userButtonTrigger:
                      "h-full w-full rounded-md p-2 text-inherit shadow-none transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:shadow-none active:bg-sidebar-accent active:text-sidebar-accent-foreground",
                    userButtonBox:
                      "w-full min-w-0 flex-row-reverse justify-end gap-2",
                    userButtonAvatarBox: "size-6 shrink-0",
                    userButtonOuterIdentifier:
                      "min-w-0 flex-1 truncate p-0 text-left text-sm font-normal text-inherit",
                  },
                }}
              />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
