import { randomUUID } from "node:crypto"
import { auth } from "@clerk/nextjs/server"

import { ChatAvatar } from "@/components/chat-avatar"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

export default async function Page() {
  await auth.protect()

  const avatarSeed = randomUUID()

  return (
    <main className="flex min-h-svh p-6">
      <Empty>
        <EmptyHeader>
          <EmptyMedia>
            <ChatAvatar seed={avatarSeed} />
          </EmptyMedia>
          <EmptyTitle>
            <h1>Project ready!</h1>
          </EmptyTitle>
          <EmptyDescription>
            <p>You may now add components and start building.</p>
            <p>We&apos;ve already added the button component for you.</p>
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button>Button</Button>
          <div className="font-mono text-xs text-muted-foreground">
            (Press <kbd>d</kbd> to toggle dark mode)
          </div>
        </EmptyContent>
      </Empty>
    </main>
  )
}
