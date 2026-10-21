import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

export const todos = pgTable(
  "todos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Clerk owns user records; authorize queries against the signed-in user's ID.
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    completed: boolean("completed").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("todos_user_id_idx").on(table.userId)]
)

export type Todo = typeof todos.$inferSelect
export type NewTodo = typeof todos.$inferInsert
