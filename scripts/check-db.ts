import nextEnv from "@next/env"
import { sql } from "drizzle-orm"

import { createDatabase } from "../db/client"

nextEnv.loadEnvConfig(process.cwd())

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error("Set DATABASE_URL in .env.local before running db:check.")
  }

  await createDatabase(url).execute(sql`select 1 as connected`)
  console.log("Neon connection verified through Drizzle ORM.")
}

main().catch(() => {
  console.error(
    "Database check failed. Verify DATABASE_URL in .env.local and network access."
  )
  process.exitCode = 1
})
