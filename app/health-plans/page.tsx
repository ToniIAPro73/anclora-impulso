"use client"

import { HealthPlanHome } from "@/components/health-plan-home"
import { ProtectedDashboardPage } from "@/components/protected-dashboard-page"

export default function HealthPlansPage() {
  return <ProtectedDashboardPage><HealthPlanHome /></ProtectedDashboardPage>
}
