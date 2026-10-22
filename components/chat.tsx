"use client"

import { useChat } from "@ai-sdk/react"
import { zodResolver } from "@hookform/resolvers/zod"
import type { ChatSessionPersistedState } from "@trigger.dev/sdk/chat"
import { useTriggerChatTransport } from "@trigger.dev/sdk/chat/react"
import type { UIMessage } from "ai"
import { ArrowUpIcon, MessageCircleIcon, SquareIcon } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { mintChatAccessToken, startChatSession } from "@/actions/chat"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Message, MessageContent, MessageHeader } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { Spinner } from "@/components/ui/spinner"
import { Trace, TraceIcon, TraceLine, TraceTitle } from "@/components/ui/trace"
import type { chatAgent } from "@/trigger/chat"

const promptSchema = z.object({
  message: z.string().trim().min(1, "Enter a message."),
})

export function Chat({
  chatId,
  botName,
  initialMessages,
  initialSession,
}: {
  chatId: string
  botName: string
  initialMessages: UIMessage[]
  initialSession?: ChatSessionPersistedState
}) {
  const transport = useTriggerChatTransport<typeof chatAgent>({
    task: "chat-agent",
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId }) => startChatSession(chatId),
    sessions: initialSession ? { [chatId]: initialSession } : undefined,
  })
  const { messages, sendMessage, status, error, regenerate, stop } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
    resume: !!initialSession,
  })
  const form = useForm<z.infer<typeof promptSchema>>({
    resolver: zodResolver(promptSchema),
    defaultValues: { message: "" },
  })
  const input = useWatch({ control: form.control, name: "message" })
  const isBusy = status === "submitted" || status === "streaming"
  const { errors, isSubmitting } = form.formState
  const messageId = `message-${chatId}`

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MessageScrollerProvider autoScroll>
        <MessageScroller className="flex-1">
          <MessageScrollerViewport aria-label="Conversation">
            <MessageScrollerContent className="mx-auto max-w-3xl p-4 sm:p-6">
              {messages.length === 0 && (
                <MessageScrollerItem messageId="empty" className="my-auto">
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <MessageCircleIcon />
                      </EmptyMedia>
                      <EmptyTitle>Start a conversation</EmptyTitle>
                      <EmptyDescription>
                        Send a message to {botName} to get started.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </MessageScrollerItem>
              )}
              {messages.map((message) => (
                <MessageScrollerItem
                  key={message.id}
                  messageId={message.id}
                  scrollAnchor={message.role === "user"}
                >
                  <Message align={message.role === "user" ? "end" : "start"}>
                    <MessageContent>
                      <MessageHeader>
                        {message.role === "user" ? "You" : botName}
                      </MessageHeader>
                      {message.parts.map((part, index) =>
                        part.type === "text" && part.text ? (
                          <Bubble
                            key={index}
                            variant={
                              message.role === "user" ? "muted" : "ghost"
                            }
                          >
                            <BubbleContent className="whitespace-pre-wrap">
                              {part.text}
                            </BubbleContent>
                          </Bubble>
                        ) : null
                      )}
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              ))}
              {isBusy && (
                <MessageScrollerItem messageId="pending">
                  <Trace role="status">
                    <TraceLine status="running">
                      <TraceIcon>
                        <Spinner />
                      </TraceIcon>
                      <TraceTitle>Responding…</TraceTitle>
                    </TraceLine>
                  </Trace>
                </MessageScrollerItem>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      <div className="mx-auto flex w-full max-w-3xl shrink-0 flex-col gap-3 p-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription className="flex items-center justify-between gap-3">
              Could not get a response. Please try again.
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBusy}
                onClick={() => void regenerate()}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}
        <form
          onSubmit={form.handleSubmit(async ({ message }) => {
            if (isBusy) return
            form.reset()
            await sendMessage({ text: message })
          })}
        >
          <FieldGroup>
            <Field data-invalid={!!errors.message} data-disabled={isBusy}>
              <FieldLabel htmlFor={messageId} className="sr-only">
                Message
              </FieldLabel>
              <InputGroup>
                <InputGroupTextarea
                  {...form.register("message")}
                  id={messageId}
                  placeholder={`Message ${botName}…`}
                  aria-invalid={!!errors.message}
                  aria-describedby={`${messageId}-hint ${messageId}-error`}
                  disabled={isBusy || isSubmitting}
                  className="max-h-48 min-h-20"
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault()
                      event.currentTarget.form?.requestSubmit()
                    }
                  }}
                />
                <InputGroupAddon align="block-end" className="justify-end">
                  {isBusy ? (
                    <InputGroupButton
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        void stop()
                        void transport.stopGeneration(chatId)
                      }}
                    >
                      <SquareIcon data-icon="inline-start" />
                      Stop
                    </InputGroupButton>
                  ) : (
                    <InputGroupButton
                      type="submit"
                      variant="default"
                      size="icon-sm"
                      disabled={!input.trim() || isSubmitting}
                      aria-label="Send message"
                    >
                      <ArrowUpIcon />
                    </InputGroupButton>
                  )}
                </InputGroupAddon>
              </InputGroup>
              <FieldError id={`${messageId}-error`} errors={[errors.message]} />
              <FieldDescription id={`${messageId}-hint`}>
                Enter to send · Shift+Enter for a new line
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </div>
    </div>
  )
}
