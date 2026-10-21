<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Database

- This is a development project. There is no backwards compatibility and the data is worthless. Prefer data loss: never backfill, migrate, or preserve existing rows, and never spend effort on keeping old data working. Every schema change means a clean slate.
- Apply database schema changes only with `npm run db:push` (`drizzle-kit push`).
- Never generate or run database migrations, add migration scripts, or create migration SQL, snapshots, or journals.

## Forms and Server Actions

Use `components/bot-dialog.tsx`, `actions/bot.ts`, and `db/schema.ts` as reference implementations.

- Use the shadcn skill for form composition, the Clerk skill for authentication, and the Neon skill for database work. Read the relevant component documentation and reuse installed primitives.
- For database-backed forms, derive Zod validation from Drizzle tables, using `drizzle-zod`'s `createInsertSchema` for inserts. Derive the client input schema with an explicit `.pick()` of editable fields and infer TypeScript types from it. Share that schema between the form and server action instead of duplicating validation.
- Trim text and reject whitespace-only required fields. Keep optional fields optional and normalize blank optional text to `null` before inserting when the database column is nullable.
- Put mutations in `actions/<resource>.ts` with `"use server"`. For authenticated mutations, call `await auth.protect()` inside the action and obtain `userId` from Clerk. Assign ownership IDs, generated IDs, timestamps, and lazily assigned external IDs on the server; never let form input assign or override them. Page protection does not replace action authentication.
- Treat action input as untrusted and validate it again with `safeParse` before any database write. Use `getDb()` from `@/db`, assign trusted server fields after validation, and return a typed success/error result with field errors when appropriate. Keep internal database errors out of user-facing messages.
- Build interactive forms as Client Components using React Hook Form, `zodResolver`, and explicit default values. Keep route pages as Server Components. Use `register` for simple inputs, `Controller` for controlled components, and `useWatch` for previews or dependent controls.
- Compose forms with `FieldGroup`, `Field`, `FieldLabel`, `FieldDescription`, and `FieldError`, plus existing `Input` and `Textarea` components. Associate labels and errors with stable IDs; pair `data-invalid` on fields with `aria-invalid` on controls, and expose disabled states consistently.
- Compose dialogs with the existing Dialog primitives, including an accessible title and description. This project uses Base UI: use `render` for trigger/close composition. Use semantic theme tokens and component variants; use layout classes to match references instead of rebuilding controls or hardcoding theme colors.
- Use `ToggleGroup` for selectable presets. Apply preset and shuffle changes through React Hook Form's `setValue`, updating dirty and validation state as needed. Give every non-submit form button `type="button"`. For DiceBear faces, store the seed and preview it with `ChatAvatar`; generate fresh seeds in event handlers or during request-time server rendering, never during client rendering.
- While submitting, disable duplicate submissions and editing, show a `Spinner` with a clear pending label, and prevent dialog dismissal. Preserve entered values on failure, map server field errors back to the form, and show a safe form-level error for other failures.
- After a successful write, revalidate the affected path, close the dialog, and show a success toast using the project's `toast` component. Reset a creation form when reopening it so stale values and errors do not carry over.
- Verify mutation validation, signed-out rejection, ownership enforcement, and failure handling with meaningful tests. Run typecheck and lint, check the important form interactions in the browser, and remove temporary preview routes and test records after verification.

## Git

- Never create branches, worktrees, or commits automatically. Only do so when the user explicitly asks for that specific action in the current request.
- Leave changes uncommitted in the working tree on the current branch and let the user decide when and how to commit.

## DiceBear

Use DiceBear 10. Documentation: https://www.dicebear.com/llms.txt

There are seven native cores with identical output, not one library with
wrappers. Use the one matching this project's language. Do not reach for the
JavaScript core when the project is written in something else:

    JavaScript  @dicebear/core + @dicebear/styles
    PHP         dicebear/core + dicebear/styles
    Python      dicebear-core + dicebear-styles
    Rust        dicebear-core + dicebear-styles
    Go          github.com/dicebear/dicebear-go/v10 + github.com/dicebear/styles/v10
    Dart        dicebear_core + dicebear_styles
    C#          DiceBear.Core + DiceBear.Styles

Every style page carries a loading snippet for all seven, for example
https://www.dicebear.com/styles/lorelei/index.md

HTTP API: https://api.dicebear.com/10.x/<style>/svg?seed=<seed> The seed is a
query parameter, not a path segment. Options are query parameters too; array
values are separated by commas.

Options named after a component end in Variant: eyesVariant, not eyes. This
holds in all seven cores and in the HTTP API. Look up the options of a style at
https://api.dicebear.com/10.x/<style>/options.json

Write these forms, not the ones on the left. The left column is pre-10 and the
API does not reject it, so an outdated call runs and silently does the wrong
thing:

    avatars.dicebear.com/api/<style>/<seed>.svg  ->  api.dicebear.com/10.x/<style>/svg?seed=<seed>
    api.dicebear.com/9.x/<style>/svg             ->  api.dicebear.com/10.x/<style>/svg
    npm install @dicebear/collection             ->  npm install @dicebear/styles
    npm install @dicebear/lorelei                ->  npm install @dicebear/styles
    createAvatar(lorelei, { seed })              ->  new Avatar(new Style(definition), { seed })
    { eyes: ['variant01'] }                      ->  { eyesVariant: ['variant01'] }
    ?radius=50                                   ->  ?borderRadius=50

Only JavaScript and the HTTP API have a pre-10 form. The other six cores were
released in 2026 and never had one, so any older-looking PHP, Python, Rust, Go,
Dart or C# API attributed to DiceBear is invented rather than outdated.
