"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getDb } from "@/db"
import { bots, createBotSchema, type CreateBotInput } from "@/db/schema"

type CreateBotResult =
  | { success: true; botId: string }
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

  let botId: string

  try {
    const [bot] = await getDb()
      .insert(bots)
      .values({
        ...parsed.data,
        instructions: parsed.data.instructions || null,
        userId,
      })
      .returning({ id: bots.id })

    if (!bot) throw new Error("The database did not return the new bot.")
    botId = bot.id
  } catch (error) {
    console.error("Failed to create bot:", error)
    return {
      success: false,
      error: "Could not create your bot. Please try again.",
    }
  }

  revalidatePath("/")
  return { success: true, botId }
}
