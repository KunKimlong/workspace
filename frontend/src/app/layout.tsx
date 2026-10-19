import type { Metadata } from "next"
import { Geist_Mono, Manrope } from "next/font/google"
import "./globals.css"

import { AuthProvider } from "@/components/auth-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { APP_NAME } from "@/lib/site"

const sans = Manrope({ variable: "--font-sans", subsets: ["latin"] })
const mono = Geist_Mono({ variable: "--font-mono-face", subsets: ["latin"] })

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Personal workspace for tracking salary and expenses",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sans.variable} ${mono.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider>
            <AuthProvider>{children}</AuthProvider>
            <Toaster richColors position="top-right" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
