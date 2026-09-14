"use client"

import Link from "next/link"
import { ArrowRight, HeartPulse } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useLanguage } from "@/lib/contexts/language-context"

export function HealthPlanCrossLink({ context }: { context: "progress" | "nutrition" | "gamification" }) {
  const { t, language } = useLanguage()
  const copy = {
    progress: language === "es" ? "Conecta este dato con tu semana" : "Connect this signal to your week",
    nutrition: language === "es" ? "Lleva esta decisión a tu semana" : "Carry this decision into your week",
    gamification: language === "es" ? "Convierte la continuidad en una acción" : "Turn consistency into an action",
  }[context]
  return <Card className="border-orange-200/70 bg-orange-50/60 dark:border-orange-400/10 dark:bg-orange-950/20"><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><HeartPulse className="h-5 w-5 text-orange-600 dark:text-orange-300" /><div><p className="text-sm font-semibold text-slate-900 dark:text-white">{copy}</p><p className="text-xs text-slate-600 dark:text-slate-400">{t.healthPlans.subtitle}</p></div></div><Link href="/health-plans" className="inline-flex items-center text-sm font-semibold text-orange-700 dark:text-orange-300">{t.healthPlans.explore}<ArrowRight className="ml-1 h-4 w-4" /></Link></CardContent></Card>
}
