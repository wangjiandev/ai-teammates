import "server-only"

import { createDatabase } from "./client"

let database: ReturnType<typeof createDatabase> | undefined

export function getDb() {
  if (!database) {
    const url = process.env.DATABASE_URL

    if (!url) {
      throw new Error("Set DATABASE_URL in .env.local before querying Neon.")
    }

    database = createDatabase(url)
  }

  return database
}
