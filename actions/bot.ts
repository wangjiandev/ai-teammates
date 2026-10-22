"use server"

import { auth } from "@clerk/nextjs/server"
import { and, eq, inArray } from "drizzle-orm"
import { nanoid } from "nanoid"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getDb } from "@/db"
import {
  bots,
  chatMembers,
  chats,
  createBotSchema,
  type CreateBotInput,
} from "@/db/schema"

type BotMutationError = {
  success: false
  error: string
  fieldErrors?: Partial<Record<keyof CreateBotInput, string[]>>
}

type CreateBotResult =
  { success: true; botId: string; chatId: string } | BotMutationError

type UpdateBotResult = { success: true; botId: string } | BotMutationError

type DeleteBotResult = { success: true } | BotMutationError

export async function createBot(input: unknown): Promise<CreateBotResult> {
  const { userId } = await auth.protect()
  const parsed = createBotSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false,
      error: "Please check the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    }
  }

  // Generate both IDs before building the batch so the membership can link them.
  const botId = nanoid()
  const chatId = nanoid()

  try {
    const db = getDb()
    await db.batch([
      db.insert(bots).values({
        ...parsed.data,
        id: botId,
        instructions: parsed.data.instructions || null,
        userId,
      }),
      db.insert(chats).values({
        id: chatId,
        userId,
        kind: "direct",
        name: null,
      }),
      db.insert(chatMembers).values({ chatId, botId }),
    ])
  } catch (error) {
    console.error("Failed to create bot:", error)
    return {
      success: false,
      error: "Could not create your bot. Please try again.",
    }
  }

  revalidatePath("/")
  return { success: true, botId, chatId }
}

export async function updateBot(
  botId: unknown,
  input: unknown
): Promise<UpdateBotResult> {
  const { userId } = await auth.protect()
  const parsed = createBotSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false,
      error: "Please check the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    }
  }

  const parsedId = z.string().trim().min(1).safeParse(botId)

  if (!parsedId.success) {
    return { success: false, error: "Could not find your bot." }
  }

  try {
    const db = getDb()
    const [updated] = await db
      .update(bots)
      .set({
        ...parsed.data,
        instructions: parsed.data.instructions || null,
      })
      .where(and(eq(bots.id, parsedId.data), eq(bots.userId, userId)))
      .returning({ id: bots.id })

    if (!updated) {
      return { success: false, error: "Could not find your bot." }
    }
  } catch (error) {
    console.error("Failed to update bot:", error)
    return {
      success: false,
      error: "Could not update your bot. Please try again.",
    }
  }

  revalidatePath("/(dashboard)", "layout")
  return { success: true, botId: parsedId.data }
}

export async function deleteBot(botId: unknown): Promise<DeleteBotResult> {
  const { userId } = await auth.protect()
  const parsedId = z.string().trim().min(1).safeParse(botId)

  if (!parsedId.success) {
    return { success: false, error: "Could not find your bot." }
  }

  try {
    const db = getDb()
    const ownedBot = db
      .select({ id: bots.id })
      .from(bots)
      .where(and(eq(bots.id, parsedId.data), eq(bots.userId, userId)))
    const linkedChats = db
      .select({ id: chatMembers.chatId })
      .from(chatMembers)
      .where(inArray(chatMembers.botId, ownedBot))

    // Delete direct chats before cascading memberships lose their chat IDs.
    const [, deletedBots] = await db.batch([
      db
        .delete(chats)
        .where(
          and(
            eq(chats.userId, userId),
            eq(chats.kind, "direct"),
            inArray(chats.id, linkedChats)
          )
        ),
      db
        .delete(bots)
        .where(and(eq(bots.id, parsedId.data), eq(bots.userId, userId)))
        .returning({ id: bots.id }),
    ])

    if (deletedBots.length === 0) {
      return { success: false, error: "Could not find your bot." }
    }
  } catch (error) {
    console.error("Failed to delete bot:", error)
    return {
      success: false,
      error: "Could not delete your bot. Please try again.",
    }
  }

  revalidatePath("/(dashboard)", "layout")
  return { success: true }
}
