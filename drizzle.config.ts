import { loadEnvConfig } from "@next/env"
import { defineConfig } from "drizzle-kit"

loadEnvConfig(process.cwd())

// Database commands use the direct connection URL.
export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? "" },
  strict: true,
})
