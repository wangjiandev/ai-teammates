import "server-only"

import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"

import { getDb } from "@/db"
import { bots } from "@/db/schema"

export async function getChat(chatId: string) {
  const { userId } = await auth.protect()
  const db = getDb()
  const ownedBots = db
    .select({ id: bots.id })
    .from(bots)
    .where(eq(bots.userId, userId))

  const chat = await db.query.chats.findFirst({
    columns: { id: true },
    where: (chat, { and, eq }) =>
      and(eq(chat.id, chatId), eq(chat.userId, userId)),
    with: {
      members: {
        columns: {},
        where: (member, { inArray }) => inArray(member.botId, ownedBots),
        orderBy: (member, { asc }) => [asc(member.joinedAt), asc(member.botId)],
        limit: 1,
        with: {
          bot: {
            columns: {
              id: true,
              name: true,
              avatar: true,
              job: true,
              instructions: true,
            },
          },
        },
      },
    },
  })

  if (!chat) return null

  const { members, ...details } = chat
  return { ...details, bot: members[0]?.bot ?? null }
}
