"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { useAuth } from "@/components/auth-provider"
import { FullPageLoader } from "@/components/full-page-loader"
import { Header } from "@/components/layout/header"
import { AppSidebar } from "@/components/layout/sidebar-nav"
import { SidebarProvider } from "@/components/layout/sidebar-state"
import { PrivacyProvider } from "@/components/privacy"
import { TooltipProvider } from "@/components/ui/tooltip"

/** Shell for every signed-in page; sends visitors without a session to /login. */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { status } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login")
  }, [status, router])

  if (status !== "authenticated") return <FullPageLoader />

  return (
    <SidebarProvider>
      <PrivacyProvider>
        <TooltipProvider>
          <div className="flex min-h-svh">
            <AppSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <Header />
              <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
                <div className="mx-auto w-full max-w-7xl">{children}</div>
              </main>
            </div>
          </div>
        </TooltipProvider>
      </PrivacyProvider>
    </SidebarProvider>
  )
}
