import { UserButton } from "@clerk/nextjs"
import { format, formatDistanceStrict } from "date-fns"

import { ChatListItemContent } from "@/components/chat-list-item"
import { SidebarChatLink } from "@/components/sidebar-chat-link"
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
  SidebarRail,
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
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex justify-end group-data-[collapsible=icon]:justify-start">
          <SidebarCreateMenu />
        </div>
        <SidebarSearch chats={chats} />
      </SidebarHeader>
      <SidebarContent className="group-data-[collapsible=icon]:overflow-y-auto">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu aria-label="Chats">
              {chats.map((chat) => (
                <SidebarMenuItem key={chat.id}>
                  <SidebarChatLink chatId={chat.id} name={chat.name}>
                    <ChatListItemContent chat={chat} />
                  </SidebarChatLink>
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
              className="p-0 group-data-[collapsible=icon]:p-0! has-focus-visible:ring-2"
            >
              <UserButton
                showName
                appearance={{
                  elements: {
                    rootBox: "h-full w-full",
                    userButtonTrigger:
                      "h-full w-full rounded-md p-2 text-inherit shadow-none transition-[width,height,padding] group-data-[collapsible=icon]:p-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:shadow-none active:bg-sidebar-accent active:text-sidebar-accent-foreground",
                    userButtonBox:
                      "w-full min-w-0 flex-row-reverse justify-end gap-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0",
                    userButtonAvatarBox: "size-6 shrink-0",
                    userButtonOuterIdentifier:
                      "min-w-0 flex-1 truncate p-0 text-left text-sm font-normal text-inherit group-data-[collapsible=icon]:hidden",
                  },
                }}
              />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
