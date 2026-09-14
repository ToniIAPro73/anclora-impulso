"use client"

import { ProgressTracker } from "@/components/progress-tracker"
import { ProtectedDashboardPage } from "@/components/protected-dashboard-page"
import { useLanguage } from "@/lib/contexts/language-context"
import { HealthPlanCrossLink } from "@/components/health-plan-cross-link"

export default function ProgressPage() {
  const { language } = useLanguage()
  const isSpanish = language === "es"

  return (
    <ProtectedDashboardPage>
      <div className="p-6 pb-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {isSpanish ? "Progreso Físico" : "Physical Progress"}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {isSpanish
              ? "Métricas corporales, frecuencia de entrenamientos y récords personales"
              : "Body metrics, workout frequency, and personal records"}
          </p>
        </div>
        <ProgressTracker />
        <div className="mt-6"><HealthPlanCrossLink context="progress" /></div>
      </div>
    </ProtectedDashboardPage>
  )
}
