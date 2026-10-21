import { ClerkProvider, Show, UserButton } from "@clerk/nextjs"
import { shadcn } from "@clerk/ui/themes"
import Link from "next/link"
import { Geist, Geist_Mono } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { buttonVariants } from "@/components/ui/button"
import { Toaster } from "@/components/ui/toast"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        geist.variable
      )}
    >
      <body>
        <ClerkProvider
          appearance={{ theme: shadcn }}
          signInFallbackRedirectUrl="/dashboard"
          signUpFallbackRedirectUrl="/dashboard"
        >
          <ThemeProvider>
            <TooltipProvider>
              <Toaster>
                <header className="flex items-center justify-between gap-4 border-b px-6 py-4">
                  <Link href="/" className="font-medium">
                    AI Teammates
                  </Link>
                  <nav aria-label="Account" className="flex items-center gap-3">
                    <Show when="signed-out">
                      <Link
                        href="/sign-in"
                        className={buttonVariants({ variant: "outline" })}
                      >
                        Sign in
                      </Link>
                      <Link href="/sign-up" className={buttonVariants()}>
                        Sign up
                      </Link>
                    </Show>
                    <Show when="signed-in">
                      <Link
                        href="/dashboard"
                        className={buttonVariants({ variant: "ghost" })}
                      >
                        Dashboard
                      </Link>
                      <UserButton />
                    </Show>
                  </nav>
                </header>
                {children}
              </Toaster>
            </TooltipProvider>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  )
}
