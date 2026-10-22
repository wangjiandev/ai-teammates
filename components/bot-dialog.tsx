"use client"

import { useId, useState, type ReactNode } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon, ShuffleIcon } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"

import { createBot } from "@/actions/bot"
import { ChatAvatar } from "@/components/chat-avatar"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { createBotSchema, type CreateBotInput } from "@/db/schema"

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

export function BotDialog({
  trigger,
}: {
  trigger?: (openDialog: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const form = useForm<CreateBotInput>({
    resolver: zodResolver(createBotSchema),
    defaultValues,
  })
  const avatarSeed = useWatch({ control: form.control, name: "avatar" })
  const job = useWatch({ control: form.control, name: "job" })
  const { errors, isSubmitting } = form.formState
  const selectedPreset = presets.find((preset) => preset.job === job)

  function openDialog() {
    if (isSubmitting) return
    form.reset({ ...defaultValues, avatar: crypto.randomUUID() })
    setOpen(true)
  }

  async function onSubmit(values: CreateBotInput) {
    form.clearErrors("root")

    try {
      const result = await createBot(values)

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
        title: "Bot created",
        description: `${values.name} is ready.`,
      })
    } catch {
      form.setError("root", {
        message: "Could not create your bot. Please try again.",
      })
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen, details) => {
        if (isSubmitting) {
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
        <DialogTrigger render={<Button />}>
          <PlusIcon data-icon="inline-start" />
          Create bot
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[calc(100svh-2rem)] gap-6 overflow-y-auto p-6 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New bot</DialogTitle>
          <DialogDescription>
            Give it a face, a name, and a job to do.
          </DialogDescription>
        </DialogHeader>
        <form
          id={`${id}-form`}
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-6"
          noValidate
          aria-busy={isSubmitting}
        >
          <FieldGroup className="gap-6">
            <ToggleGroup
              aria-label="Bot presets"
              variant="outline"
              spacing={2}
              className="flex-wrap justify-start"
              value={selectedPreset ? [selectedPreset.job] : []}
              disabled={isSubmitting}
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
            <Field data-invalid={!!errors.avatar} data-disabled={isSubmitting}>
              <input type="hidden" {...form.register("avatar")} />
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
                  disabled={isSubmitting}
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
            <Field data-invalid={!!errors.name} data-disabled={isSubmitting}>
              <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
              <Input
                {...form.register("name")}
                id={`${id}-name`}
                placeholder="Ada"
                autoComplete="off"
                required
                disabled={isSubmitting}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? `${id}-name-error` : undefined}
              />
              <FieldError id={`${id}-name-error`} errors={[errors.name]} />
            </Field>
            <Field data-invalid={!!errors.job} data-disabled={isSubmitting}>
              <FieldLabel htmlFor={`${id}-job`}>Job</FieldLabel>
              <Input
                {...form.register("job")}
                id={`${id}-job`}
                placeholder="Research assistant"
                autoComplete="off"
                required
                disabled={isSubmitting}
                aria-invalid={!!errors.job}
                aria-describedby={errors.job ? `${id}-job-error` : undefined}
              />
              <FieldError id={`${id}-job-error`} errors={[errors.job]} />
            </Field>
            <Field
              data-invalid={!!errors.instructions}
              data-disabled={isSubmitting}
            >
              <FieldLabel htmlFor={`${id}-instructions`}>
                How it should work
              </FieldLabel>
              <Textarea
                {...form.register("instructions")}
                id={`${id}-instructions`}
                placeholder={presets[0].instructions}
                className="min-h-28 resize-y"
                disabled={isSubmitting}
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
            <DialogClose
              render={<Button type="button" variant="outline" />}
              disabled={isSubmitting}
            >
              Cancel
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Spinner data-icon="inline-start" />}
              {isSubmitting ? "Creating…" : "Create bot"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
