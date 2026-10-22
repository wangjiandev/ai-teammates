import "server-only"

import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"

import { getDb } from "@/db"
import { bots } from "@/db/schema"

export async function getUserChats() {
  const { userId } = await auth.protect()
  const db = getDb()
  const ownedBots = db
    .select({ id: bots.id })
    .from(bots)
    .where(eq(bots.userId, userId))

  const rows = await db.query.chats.findMany({
    columns: {
      id: true,
      name: true,
      lastMessagePreview: true,
      lastMessageAt: true,
    },
    where: (chat, { eq }) => eq(chat.userId, userId),
    orderBy: (chat, { asc, desc }) => [desc(chat.lastMessageAt), asc(chat.id)],
    with: {
      members: {
        columns: {},
        where: (member, { inArray }) => inArray(member.botId, ownedBots),
        orderBy: (member, { asc }) => [asc(member.joinedAt), asc(member.botId)],
        limit: 1,
        with: {
          bot: { columns: { name: true, avatar: true } },
        },
      },
    },
  })

  return rows.map(({ members, ...chat }) => ({
    ...chat,
    bot: members[0]?.bot ?? null,
  }))
}
