"use client"

import { useEffect, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"

import { DashboardHeader } from "@/components/dashboard-header"
import { LegalFooter } from "@/components/legal-footer"
import { Navigation } from "@/components/navigation"
import { cn } from "@/lib/utils"

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const pathname = usePathname()
  const isDashboardRoute = pathname === "/dashboard"

  useEffect(() => {
    const savedState = window.localStorage.getItem("anclora-impulso-sidebar-collapsed")
    if (savedState === "true") {
      setIsCollapsed(true)
    }
  }, [])

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-800 lg:h-dvh lg:overflow-hidden">
      <Navigation isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      <div className={`flex min-h-0 flex-1 flex-col transition-[padding] duration-300 ${isCollapsed ? "lg:pl-24" : "lg:pl-64"}`}>
        <DashboardHeader />
        <main
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-visible overflow-x-clip lg:overflow-y-auto",
          )}
        >
          {children}
          {isDashboardRoute ? (
            <div className="mt-auto">
              <LegalFooter />
            </div>
          ) : null}
        </main>
      </div>
    </div>
  )
}
