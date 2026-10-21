import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { nanoid } from "nanoid"

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

export type Bot = typeof bots.$inferSelect
export type NewBot = typeof bots.$inferInsert
