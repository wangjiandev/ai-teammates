"use server"

import { auth } from "@clerk/nextjs/server"
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

type CreateBotResult =
  | { success: true; botId: string; chatId: string }
  | {
      success: false
      error: string
      fieldErrors?: Partial<Record<keyof CreateBotInput, string[]>>
    }

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
