"use client"

import { useId, useState, type ReactNode } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon, ShuffleIcon, Trash2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useForm, useWatch } from "react-hook-form"

import { createBot, deleteBot, updateBot } from "@/actions/bot"
import { ChatAvatar } from "@/components/chat-avatar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  createBotSchema,
  type CreateBotInput,
  type EditableBot,
} from "@/db/schema"

const presets = [
  {
    name: "Ada",
    job: "Research assistant",
    instructions:
      "Answer briefly, cite sources, and ask before running anything destructive.",
  },
  {
    name: "Linus",
    job: "Code reviewer",
    instructions:
      "Review code for bugs, security issues, and clarity. Explain your suggestions with concrete examples.",
  },
  {
    name: "Maya",
    job: "Writing editor",
    instructions:
      "Make writing clear and concise while preserving the author's voice. Explain significant edits.",
  },
  {
    name: "Sage",
    job: "Tutor",
    instructions:
      "Explain ideas step by step, use examples, and ask questions to check understanding.",
  },
]

const defaultValues: CreateBotInput = {
  avatar: "new-bot",
  name: "",
  job: "",
  instructions: "",
}

function getDefaultValues(bot?: EditableBot): CreateBotInput {
  if (!bot) return defaultValues

  return {
    name: bot.name,
    avatar: bot.avatar,
    job: bot.job,
    instructions: bot.instructions ?? "",
  }
}

export function BotDialog({
  bot,
  trigger,
}: {
  bot?: EditableBot
  trigger?: (openDialog: () => void) => ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const id = useId()
  const form = useForm<CreateBotInput>({
    resolver: zodResolver(createBotSchema),
    defaultValues: getDefaultValues(bot),
  })
  const avatarSeed = useWatch({ control: form.control, name: "avatar" })
  const job = useWatch({ control: form.control, name: "job" })
  const { errors, isSubmitting } = form.formState
  const isBusy = isSubmitting || isDeleting
  const selectedPreset = presets.find((preset) => preset.job === job)

  function openDialog() {
    if (isBusy) return
    form.reset(
      bot
        ? getDefaultValues(bot)
        : { ...defaultValues, avatar: crypto.randomUUID() }
    )
    setOpen(true)
    setDeleteOpen(false)
    setDeleteError(null)
  }

  async function onSubmit(values: CreateBotInput) {
    if (isDeleting || deleteOpen) return
    form.clearErrors("root")

    try {
      const result = bot
        ? await updateBot(bot.id, values)
        : await createBot(values)

      if (!result.success) {
        for (const field of [
          "name",
          "avatar",
          "job",
          "instructions",
        ] as const) {
          const message = result.fieldErrors?.[field]?.[0]
          if (message) form.setError(field, { type: "server", message })
        }
        form.setError("root", { message: result.error })
        return
      }

      setOpen(false)
      toast.add({
        title: bot ? "Bot updated" : "Bot created",
        description: bot
          ? `${values.name} has been updated.`
          : `${values.name} is ready.`,
      })
    } catch {
      form.setError("root", {
        message: bot
          ? "Could not update your bot. Please try again."
          : "Could not create your bot. Please try again.",
      })
    }
  }

  async function onDelete() {
    if (!bot || isBusy) return
    setIsDeleting(true)
    setDeleteError(null)

    try {
      const result = await deleteBot(bot.id)

      if (!result.success) {
        setDeleteError(result.error)
        return
      }

      setDeleteOpen(false)
      setOpen(false)
      toast.add({
        title: "Bot deleted",
        description: `${bot.name} has been deleted.`,
      })
      router.replace("/")
    } catch {
      setDeleteError("Could not delete your bot. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen, details) => {
        if (isBusy || deleteOpen) {
          details.cancel()
          return
        }
        if (nextOpen) {
          openDialog()
        } else {
          setOpen(false)
        }
      }}
    >
      {trigger ? (
        trigger(openDialog)
      ) : (
        <DialogTrigger
          render={
            <Button
              type="button"
              variant={bot ? "ghost" : "default"}
              className={
                bot ? "max-w-full min-w-0 justify-start gap-2" : undefined
              }
              aria-label={bot ? `Edit ${bot.name}` : undefined}
              disabled={isBusy}
            />
          }
        >
          {bot ? (
            <>
              <ChatAvatar seed={bot.avatar} className="size-4" />
              <span className="truncate">{bot.name}</span>
            </>
          ) : (
            <>
              <PlusIcon data-icon="inline-start" />
              Create bot
            </>
          )}
        </DialogTrigger>
      )}
      <DialogContent
        showCloseButton={!isBusy}
        className="max-h-[calc(100svh-2rem)] gap-6 overflow-y-auto p-6 sm:max-w-xl"
      >
        <DialogHeader>
          <DialogTitle>{bot ? "Edit bot" : "New bot"}</DialogTitle>
          <DialogDescription>
            {bot
              ? "Update its face, name, and job."
              : "Give it a face, a name, and a job to do."}
          </DialogDescription>
        </DialogHeader>
        <form
          id={`${id}-form`}
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-6"
          noValidate
          aria-busy={isBusy}
        >
          <FieldGroup className="gap-6">
            <ToggleGroup
              aria-label="Bot presets"
              variant="outline"
              spacing={2}
              className="flex-wrap justify-start"
              value={selectedPreset ? [selectedPreset.job] : []}
              disabled={isBusy}
              onValueChange={([value]) => {
                const preset = presets.find((item) => item.job === value)
                if (!preset) return
                for (const field of ["name", "job", "instructions"] as const) {
                  form.setValue(field, preset[field], {
                    shouldDirty: true,
                    shouldValidate: form.formState.isSubmitted,
                  })
                }
              }}
            >
              {presets.map((preset) => (
                <ToggleGroupItem
                  key={preset.job}
                  value={preset.job}
                  className="rounded-full"
                  type="button"
                >
                  {preset.job}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Field data-invalid={!!errors.avatar} data-disabled={isBusy}>
              <input
                type="hidden"
                disabled={isBusy}
                {...form.register("avatar")}
              />
              <Field orientation="horizontal" className="items-center gap-4">
                <ChatAvatar seed={avatarSeed} className="size-12" />
                <FieldContent>
                  <FieldTitle>Face</FieldTitle>
                  <FieldDescription>
                    Shuffle until you find one you like.
                  </FieldDescription>
                </FieldContent>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isBusy}
                  onClick={() =>
                    form.setValue("avatar", crypto.randomUUID(), {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                >
                  <ShuffleIcon data-icon="inline-start" />
                  Shuffle
                </Button>
              </Field>
              <FieldError errors={[errors.avatar]} />
            </Field>
            <Field data-invalid={!!errors.name} data-disabled={isBusy}>
              <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
              <Input
                {...form.register("name")}
                id={`${id}-name`}
                placeholder="Ada"
                autoComplete="off"
                required
                disabled={isBusy}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? `${id}-name-error` : undefined}
              />
              <FieldError id={`${id}-name-error`} errors={[errors.name]} />
            </Field>
            <Field data-invalid={!!errors.job} data-disabled={isBusy}>
              <FieldLabel htmlFor={`${id}-job`}>Job</FieldLabel>
              <Input
                {...form.register("job")}
                id={`${id}-job`}
                placeholder="Research assistant"
                autoComplete="off"
                required
                disabled={isBusy}
                aria-invalid={!!errors.job}
                aria-describedby={errors.job ? `${id}-job-error` : undefined}
              />
              <FieldError id={`${id}-job-error`} errors={[errors.job]} />
            </Field>
            <Field data-invalid={!!errors.instructions} data-disabled={isBusy}>
              <FieldLabel htmlFor={`${id}-instructions`}>
                How it should work
              </FieldLabel>
              <Textarea
                {...form.register("instructions")}
                id={`${id}-instructions`}
                placeholder={presets[0].instructions}
                className="min-h-28 resize-y"
                disabled={isBusy}
                aria-invalid={!!errors.instructions}
                aria-describedby={
                  errors.instructions ? `${id}-instructions-error` : undefined
                }
              />
              <FieldError
                id={`${id}-instructions-error`}
                errors={[errors.instructions]}
              />
            </Field>
          </FieldGroup>
          {errors.root?.message && (
            <Alert variant="destructive">
              <AlertDescription>{errors.root.message}</AlertDescription>
            </Alert>
          )}
          <DialogFooter className="-mx-6 mt-2 -mb-6 p-6">
            {bot && (
              <AlertDialog
                open={deleteOpen}
                onOpenChange={(nextOpen, details) => {
                  if (isDeleting) {
                    details.cancel()
                    return
                  }
                  if (nextOpen) setDeleteError(null)
                  setDeleteOpen(nextOpen)
                }}
              >
                <AlertDialogTrigger
                  render={
                    <Button
                      type="button"
                      variant="destructive"
                      className="sm:mr-auto"
                      disabled={isBusy}
                    />
                  }
                >
                  <Trash2Icon data-icon="inline-start" />
                  Delete bot
                </AlertDialogTrigger>
                <AlertDialogContent aria-busy={isDeleting}>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {bot.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes this bot and its direct chats.
                      This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  {deleteError && (
                    <Alert variant="destructive">
                      <AlertDescription>{deleteError}</AlertDescription>
                    </Alert>
                  )}
                  <AlertDialogFooter>
                    <AlertDialogCancel type="button" disabled={isDeleting}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      type="button"
                      variant="destructive"
                      disabled={isDeleting}
                      onClick={onDelete}
                    >
                      {isDeleting && <Spinner data-icon="inline-start" />}
                      {isDeleting ? "Deleting…" : "Delete bot"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <DialogClose
              render={<Button type="button" variant="outline" />}
              disabled={isBusy}
            >
              Cancel
            </DialogClose>
            <Button type="submit" disabled={isBusy}>
              {isSubmitting && <Spinner data-icon="inline-start" />}
              {bot
                ? isSubmitting
                  ? "Saving…"
                  : "Save changes"
                : isSubmitting
                  ? "Creating…"
                  : "Create bot"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
