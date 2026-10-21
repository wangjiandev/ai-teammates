import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { createInsertSchema } from "drizzle-zod"
import { nanoid } from "nanoid"
import { z } from "zod"

export const bots = pgTable(
  "bots",
  {
    id: text("id").primaryKey().$defaultFn(nanoid),
    // Clerk owns user records; authorize queries against the signed-in user's ID.
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    avatar: text("avatar").notNull(),
    // A short phrase describing what the bot is for.
    job: text("job").notNull(),
    instructions: text("instructions"),
    // Third-party sandbox ID, set when the sandbox is created lazily.
    sandboxId: text("sandbox_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("bots_user_id_idx").on(table.userId)]
)

export const insertBotSchema = createInsertSchema(bots, {
  userId: (schema) => schema.min(1),
  name: (schema) => schema.trim().min(1, "Name is required."),
  avatar: (schema) => schema.trim().min(1, "Choose a face for your bot."),
  job: (schema) => schema.trim().min(1, "Job is required."),
  instructions: (schema) => schema.trim(),
})

// Only these fields can come from the client. Ownership and generated fields
// are assigned on the server; avatar stores the DiceBear seed.
export const createBotSchema = insertBotSchema.pick({
  name: true,
  avatar: true,
  job: true,
  instructions: true,
})

export type CreateBotInput = z.infer<typeof createBotSchema>
export type Bot = typeof bots.$inferSelect
export type NewBot = typeof bots.$inferInsert
