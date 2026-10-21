import { Avatar, Style } from "@dicebear/core"
import gaze from "@dicebear/styles/gaze.json" with { type: "json" }
import Image from "next/image"

import { cn } from "@/lib/utils"

const gazeStyle = new Style(gaze)

type ChatAvatarProps = {
  seed: string
  animated?: boolean
  className?: string
}

export function ChatAvatar({
  seed,
  animated = false,
  className,
}: ChatAvatarProps) {
  const avatar = new Avatar(gazeStyle, {
    seed,
    animationVariant: animated ? "medium" : "none",
  })

  return (
    <Image
      src={avatar.toDataUri()}
      alt="Chat avatar"
      width={32}
      height={32}
      className={cn("size-8 shrink-0", className)}
      unoptimized
    />
  )
}
