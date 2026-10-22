import { relations, sql } from "drizzle-orm"
import {
  check,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core"
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

export const chatKindEnum = pgEnum("chat_kind", ["direct", "group"])

export const chats = pgTable(
  "chats",
  {
    id: text("id").primaryKey().$defaultFn(nanoid),
    userId: text("user_id").notNull(),
    kind: chatKindEnum("kind").default("direct").notNull(),
    // Direct chats use the bot's name instead of storing their own.
    name: text("name"),
    lastMessagePreview: text("last_message_preview"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("chats_user_id_idx").on(table.userId),
    check(
      "chats_direct_name_null",
      sql`${table.kind} <> 'direct' OR ${table.name} IS NULL`
    ),
  ]
)

export const chatMembers = pgTable(
  "chat_members",
  {
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    botId: text("bot_id")
      .notNull()
      .references(() => bots.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.chatId, table.botId] }),
    index("chat_members_bot_id_idx").on(table.botId),
  ]
)

export const botsRelations = relations(bots, ({ many }) => ({
  memberships: many(chatMembers),
}))

export const chatsRelations = relations(chats, ({ many }) => ({
  members: many(chatMembers),
}))

export const chatMembersRelations = relations(chatMembers, ({ one }) => ({
  chat: one(chats, {
    fields: [chatMembers.chatId],
    references: [chats.id],
  }),
  bot: one(bots, {
    fields: [chatMembers.botId],
    references: [bots.id],
  }),
}))

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
export type Chat = typeof chats.$inferSelect
export type NewChat = typeof chats.$inferInsert
export type ChatMember = typeof chatMembers.$inferSelect
export type NewChatMember = typeof chatMembers.$inferInsert
