"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowRight, CheckCircle2, HeartPulse, Loader2, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useHealthPlan } from "@/hooks/use-health-plans"
import { useLanguage } from "@/lib/contexts/language-context"

export function HealthPlanHome() {
  const { t, language } = useLanguage()
  const { home, definition, isLoading, error, enroll, saveOnboarding, completeAction, isEnrolling, isCompleting, isSavingOnboarding } = useHealthPlan()
  const [form, setForm] = useState({ goal: "general_health" as const, baselineActivity: "irregular" as const, availableTime: "30" as const, limitations: "", safetyReview: false })

  if (isLoading) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-orange-500" aria-label={t.healthPlans.loading} /></div>
  if (error) return <Card><CardContent className="p-6 text-sm text-red-600 dark:text-red-300">{t.healthPlans.error}</CardContent></Card>

  if (!home) {
    return (
      <Card className="overflow-hidden border-orange-200/70 bg-white/85 dark:border-orange-400/15 dark:bg-slate-900/75">
        <CardHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-300"><HeartPulse className="h-6 w-6" /></div>
          <CardTitle>{t.healthPlans.discoverTitle}</CardTitle>
          <CardDescription>{definition?.descriptionEs && language === "es" ? definition.descriptionEs : definition?.descriptionEn ?? t.healthPlans.discoverDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">{t.healthPlans.safetyNote}</p>
          <Button onClick={() => void enroll()} disabled={isEnrolling}>{isEnrolling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t.healthPlans.join}</Button>
        </CardContent>
      </Card>
    )
  }

  if (!home.enrollment.onboardingComplete) {
    return (
      <Card className="border-orange-200/70 bg-white/85 dark:border-orange-400/15 dark:bg-slate-900/75">
        <CardHeader><CardTitle>{t.healthPlans.setupTitle}</CardTitle><CardDescription>{t.healthPlans.setupNote}</CardDescription></CardHeader>
        <CardContent><form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void saveOnboarding({ goal: form.goal, baselineActivity: form.baselineActivity, availableTime: form.availableTime, preferences: [], equipment: [], knownLimitations: form.limitations.split(",").map((value) => value.trim()).filter(Boolean), safetySignals: form.safetyReview ? ["recent_injury"] : [] }) }}>
          <label className="grid gap-2 text-sm font-medium">{t.healthPlans.goal}<select className="h-10 rounded-md border bg-transparent px-3" value={form.goal} onChange={(event) => setForm((current) => ({ ...current, goal: event.target.value as typeof current.goal }))}><option value="general_health">{language === "es" ? "Salud general" : "General health"}</option><option value="strength">{language === "es" ? "Fuerza" : "Strength"}</option><option value="mobility">{language === "es" ? "Movilidad" : "Mobility"}</option><option value="energy">{language === "es" ? "Energía" : "Energy"}</option></select></label>
          <label className="grid gap-2 text-sm font-medium">{t.healthPlans.activity}<select className="h-10 rounded-md border bg-transparent px-3" value={form.baselineActivity} onChange={(event) => setForm((current) => ({ ...current, baselineActivity: event.target.value as typeof current.baselineActivity }))}><option value="low">{language === "es" ? "Poco activo" : "Low"}</option><option value="some">{language === "es" ? "Algo activo" : "Some activity"}</option><option value="irregular">{language === "es" ? "Irregular" : "Irregular"}</option><option value="active">{language === "es" ? "Activo" : "Active"}</option></select></label>
          <label className="grid gap-2 text-sm font-medium">{t.healthPlans.time}<select className="h-10 rounded-md border bg-transparent px-3" value={form.availableTime} onChange={(event) => setForm((current) => ({ ...current, availableTime: event.target.value as typeof current.availableTime }))}><option value="15">~15 min/día</option><option value="30">~30 min/día</option><option value="45_60">45–60 min/día</option></select></label>
          <label className="grid gap-2 text-sm font-medium">{t.healthPlans.limitations}<input className="h-10 rounded-md border bg-transparent px-3" placeholder={language === "es" ? "Separadas por comas" : "Comma separated"} value={form.limitations} onChange={(event) => setForm((current) => ({ ...current, limitations: event.target.value }))} /></label>
          <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" className="mt-1 h-4 w-4" checked={form.safetyReview} onChange={(event) => setForm((current) => ({ ...current, safetyReview: event.target.checked }))} />{t.healthPlans.safetyQuestion}</label>
          <Button type="submit" disabled={isSavingOnboarding} className="sm:col-span-2 sm:w-fit">{isSavingOnboarding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t.healthPlans.saveSetup}</Button>
        </form></CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border-orange-200/70 bg-white/85 dark:border-orange-400/15 dark:bg-slate-900/75">
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><Badge className="mb-3 bg-orange-500 text-white">{home.phase.name}</Badge><CardTitle className="text-2xl">{t.healthPlans.home}</CardTitle><CardDescription>{t.healthPlans.subtitle}</CardDescription></div>
          <div className="rounded-2xl bg-orange-500/10 p-3 text-orange-600 dark:text-orange-300"><HeartPulse className="h-7 w-7" /></div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t.healthPlans.week} {home.week.number}</p><h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{home.week.objective}</h2></div>
          <div><div className="mb-2 flex justify-between text-sm"><span>{t.healthPlans.progress}</span><span>{home.week.progress}%</span></div><Progress value={home.week.progress} /></div>
          <div className="rounded-2xl border border-orange-200/70 bg-orange-50/70 p-4 dark:border-orange-400/10 dark:bg-orange-950/20"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-700 dark:text-orange-300">{t.healthPlans.nextAction}</p><p className="mt-1 font-semibold text-slate-900 dark:text-white">{home.nextBestAction?.label}</p>{home.nextBestAction?.href && <Button asChild size="sm" className="mt-3"><Link href={home.nextBestAction.href}>{t.healthPlans.continue}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>}</div>
          <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border p-4"><p className="text-sm font-semibold">{t.healthPlans.minimumVersion}</p><p className="mt-1 text-xs text-slate-500">{String(home.week.minimumVersion.strengthSessions)} {language === "es" ? "sesión de fuerza; 10 min de movimiento." : "strength session; 10 min movement."}</p></div><div className="rounded-xl border p-4"><p className="text-sm font-semibold">{t.healthPlans.fullVersion}</p><p className="mt-1 text-xs text-slate-500">{String(home.week.fullVersion.strengthSessions)} {language === "es" ? "sesiones de fuerza y 3 de movimiento." : "strength sessions and 3 movement sessions."}</p></div></div>
          {home.enrollment.safetyCategory !== "SELF_MANAGED" && <div className="flex gap-2 rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><ShieldCheck className="h-5 w-5 shrink-0" />{t.healthPlans.safetyReview}</div>}
        </CardContent>
      </Card>
      <div><h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">{t.healthPlans.week}</h2><div className="grid gap-3 md:grid-cols-2">{home.actions.map((action) => <Card key={action.id} className="border-slate-200/80 dark:border-slate-700"><CardContent className="flex items-start justify-between gap-4 p-4"><div><div className="flex items-center gap-2"><p className="font-semibold text-slate-900 dark:text-white">{action.title}</p>{action.status === "completed" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}</div><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{action.description}</p></div>{action.status !== "completed" && <Button variant="outline" size="sm" disabled={isCompleting} onClick={() => void completeAction(action.id)}>{t.healthPlans.complete}</Button>}</CardContent></Card>)}</div></div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{t.healthPlans.safetyNote}</p>
    </div>
  )
}
