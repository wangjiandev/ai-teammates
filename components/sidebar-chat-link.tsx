"use client"

import Link from "next/link"
import { useParams } from "next/navigation"

import { SidebarMenuButton } from "@/components/ui/sidebar"

export function SidebarChatLink({
  chatId,
  name,
  children,
}: {
  chatId: string
  name: string
  children: React.ReactNode
}) {
  const params = useParams<{ chatId?: string }>()
  const isActive = params.chatId === chatId

  return (
    <SidebarMenuButton
      render={<Link href={`/chats/${encodeURIComponent(chatId)}`} />}
      isActive={isActive}
      aria-current={isActive ? "page" : undefined}
      size="lg"
      aria-label={name}
      tooltip={name}
      className="gap-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:[&>span]:hidden"
    >
      {children}
    </SidebarMenuButton>
  )
}
