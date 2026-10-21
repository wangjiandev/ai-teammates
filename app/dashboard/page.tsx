import { auth } from "@clerk/nextjs/server"

export default async function DashboardPage() {
  await auth.protect()

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-3 p-6">
      <h1 className="text-2xl font-semibold">Your workspace</h1>
      <p className="text-muted-foreground">
        You’re signed in. Your AI teammates workspace is ready.
      </p>
    </main>
  )
}
