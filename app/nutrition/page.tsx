"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { ProtectedDashboardPage } from "@/components/protected-dashboard-page"
import { useMealPlans, useNutritionSummary, useNutritionLogs } from "@/hooks/use-nutrition"
import { useAuth } from "@/lib/contexts/auth-context"
import { Apple, ChefHat, Flame, Beef, Wheat, Droplets, Plus, Sparkles, Calendar, UtensilsCrossed, Clock3, TimerReset } from "lucide-react"
import { useLanguage } from "@/lib/contexts/language-context"
import { isProfileReadyForPlanGeneration } from "@/lib/user-profile"
import { HealthPlanCrossLink } from "@/components/health-plan-cross-link"
import { trackProductEvent } from "@/lib/product-events"
import {
  ANCLORA_MODAL_ACTIONS_CLASS,
  ANCLORA_MODAL_HEADER_CLASS,
  ANCLORA_MODAL_SECONDARY_ACTION_CLASS,
  buildResponsiveModalClass,
} from "@/lib/ui-contracts"

const DAY_NAMES_ES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
const DAY_NAMES_EN = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

function formatNutritionGoal(goal?: string | null, isSpanish = true) {
  if (!goal) return ""

  const labels: Record<string, { es: string; en: string }> = {
    perdida_peso: { es: "Pérdida de peso", en: "Weight loss" },
    ganancia_muscular: { es: "Ganancia muscular", en: "Muscle gain" },
    recomposicion: { es: "Recomposición", en: "Recomposition" },
    mantenimiento: { es: "Mantenimiento", en: "Maintenance" },
    energia: { es: "Más energía", en: "More energy" },
    lose_weight: { es: "Pérdida de peso", en: "Weight loss" },
    build_muscle: { es: "Ganancia muscular", en: "Muscle gain" },
    maintain: { es: "Mantenimiento", en: "Maintenance" },
  }

  const match = labels[goal]
  if (match) return isSpanish ? match.es : match.en

  return goal.replaceAll("_", " ")
}

function getTodayDateInput() {
  const now = new Date()
  return now.toISOString().slice(0, 10)
}

function getNowTimeInput() {
  const now = new Date()
  return now.toTimeString().slice(0, 5)
}

function formatLocalTime(value?: string | null, locale = "es-ES") {
  if (!value) return "—"
  return new Date(value).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
}

function NutritionPageContent() {
  const router = useRouter()
  const { profile } = useAuth()
  const { language, t: copy } = useLanguage()
  const t = language === 'es'
  const nutritionCopy = copy.nutrition
  const dayNames = t ? DAY_NAMES_ES : DAY_NAMES_EN

  const { mealPlans, isLoading, generateMealPlan, isGenerating, deleteMealPlan, isDeleting } = useMealPlans()
  const { data: summary } = useNutritionSummary('day')
  const { logs, logNutrition, isLogging } = useNutritionLogs('day')

  const [generateOpen, setGenerateOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [generateParams, setGenerateParams] = useState({
    goal: '',
    difficulty: '' as '' | 'facil' | 'medio' | 'dificil',
    dietType: '' as '' | 'ninguna' | 'mediterranea' | 'dash' | 'ayuno_intermitente' | 'alta_proteina',
  })
  const [logData, setLogData] = useState({
    mealType: 'almuerzo' as 'desayuno' | 'almuerzo' | 'cena' | 'snack',
    logDate: getTodayDateInput(),
    consumedTime: getNowTimeInput(),
    name: '',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  })

  const handleGenerate = async () => {
    setGenerateError(null)
    try {
      if (!isProfileReady) {
        setGenerateError(nutritionCopy.completeOnboardingError)
        return
      }

      await generateMealPlan({
        goal: generateParams.goal || undefined,
        difficulty: generateParams.difficulty || undefined,
        dietType: generateParams.dietType || undefined,
        age: profile.age ?? undefined,
        sex: profile.sex ?? undefined,
        weightKg: profile.weightKg ?? undefined,
        targetWeightKg: profile.targetWeightKg ?? undefined,
        trainingDaysPerWeek: profile.trainingDaysPerWeek ?? undefined,
      })
      await trackProductEvent({
        action: 'meal_plan_generated',
        category: 'nutrition',
        source: 'nutrition_page',
        metadata: {
          goal: generateParams.goal || null,
          dietType: generateParams.dietType || null,
        },
      })
      setGenerateOpen(false)
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : nutritionCopy.generatePlanError)
    }
  }

  const handleLog = async () => {
    try {
      const consumedAt = new Date(`${logData.logDate}T${logData.consumedTime}:00`)
      await logNutrition({
        mealType: logData.mealType,
        name: logData.name,
        calories: logData.calories,
        protein: logData.protein,
        carbs: logData.carbs,
        fat: logData.fat,
        date: consumedAt.toISOString(),
        consumedAt: consumedAt.toISOString(),
      })
      await trackProductEvent({
        action: 'nutrition_logged',
        category: 'nutrition',
        source: 'nutrition_page',
        metadata: {
          mealType: logData.mealType,
          calories: logData.calories,
          date: consumedAt.toISOString(),
        },
      })
      setLogOpen(false)
      setLogData({
        mealType: 'almuerzo',
        logDate: getTodayDateInput(),
        consumedTime: getNowTimeInput(),
        name: '',
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      })
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteMealPlan = async (planId: string) => {
    const confirmed = window.confirm(
      nutritionCopy.deletePlanConfirm
    )
    if (!confirmed) return

    await deleteMealPlan(planId)
  }

  const latestPlan = mealPlans[0]
  const isIntermittentFasting = latestPlan?.dietType === 'ayuno_intermitente'
  const fastingState = summary?.intermittentFasting
  const isProfileReady = isProfileReadyForPlanGeneration(profile)

  return (
    <div className="space-y-5 px-3 py-4 sm:space-y-6 sm:px-5 sm:py-5 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
            {nutritionCopy.title}
          </h1>
          <p className="text-muted-foreground mt-1">
            {nutritionCopy.subtitle}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <Dialog open={logOpen} onOpenChange={setLogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                {nutritionCopy.logMeal}
              </Button>
            </DialogTrigger>
            <DialogContent showCloseButton={false} className={buildResponsiveModalClass("lg:max-w-[980px]")}>
              <div className="grid max-h-[calc(100dvh-1rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-4 sm:max-h-[calc(100dvh-1.5rem)] sm:p-5 lg:max-h-[calc(100dvh-2rem)] lg:p-6">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="absolute right-4 top-4 z-10 rounded-full border-slate-700/70 bg-slate-900/45 px-5 text-slate-100 hover:bg-slate-800/70 dark:border-slate-700/80 dark:bg-slate-900/45 sm:right-5 sm:top-5 lg:right-6 lg:top-6"
                  onClick={() => setLogOpen(false)}
                >
                  {copy.common.close}
                </Button>
                <DialogHeader className={ANCLORA_MODAL_HEADER_CLASS}>
                  <DialogTitle>{nutritionCopy.logMeal}</DialogTitle>
                  <DialogDescription>
                    {nutritionCopy.logMealDescription}
                  </DialogDescription>
                </DialogHeader>
                <div className="min-h-0 space-y-3 overflow-y-auto pr-1 sm:space-y-4">
                {profile.age && profile.age >= 40 ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-950/20 dark:text-emerald-300">
                    {t
                      ? `El plan tendrá en cuenta criterios 40+: proteína suficiente, saciedad, recuperación y ajustes por sexo${profile.sex ? ` para ${profile.sex === "female" ? "mujer" : "hombre"}` : ""}.`
                      : `The plan will use 40+ rules: sufficient protein, satiety, recovery and sex-specific adjustments${profile.sex ? ` for a ${profile.sex === "female" ? "female" : "male"} profile` : ""}.`}
                  </div>
                ) : null}
                <div>
                  <Label>{nutritionCopy.mealType}</Label>
                  <Select value={logData.mealType} onValueChange={(v) => setLogData(d => ({ ...d, mealType: v as any }))}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {!isIntermittentFasting && <SelectItem value="desayuno">{nutritionCopy.breakfast}</SelectItem>}
                      <SelectItem value="almuerzo">{nutritionCopy.lunch}</SelectItem>
                      <SelectItem value="cena">{nutritionCopy.dinner}</SelectItem>
                      <SelectItem value="snack">{nutritionCopy.snack}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>{nutritionCopy.date}</Label>
                    <Input className="h-10" type="date" value={logData.logDate} onChange={(e) => setLogData(d => ({ ...d, logDate: e.target.value }))} />
                  </div>
                  <div>
                    <Label>{nutritionCopy.intakeTime}</Label>
                    <Input className="h-10" type="time" value={logData.consumedTime} onChange={(e) => setLogData(d => ({ ...d, consumedTime: e.target.value }))} />
                  </div>
                </div>
                {isIntermittentFasting && (
                  <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">
                    {t
                      ? 'En ayuno intermitente registra siempre la hora del almuerzo, la cena y cualquier ingesta entre medias para calcular el ayuno total y reajustar la semana.'
                      : 'For intermittent fasting, always log lunch, dinner, and any between-meal intake times to calculate total fasting and rebalance the week.'}
                  </div>
                )}
                <div>
                  <Label>{nutritionCopy.name}</Label>
                  <Input className="h-10" value={logData.name} onChange={(e) => setLogData(d => ({ ...d, name: e.target.value }))} placeholder={nutritionCopy.namePlaceholder} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>{nutritionCopy.calories}</Label>
                    <Input className="h-10" type="number" value={logData.calories} onChange={(e) => setLogData(d => ({ ...d, calories: +e.target.value }))} />
                  </div>
                  <div>
                    <Label>{nutritionCopy.proteinGrams}</Label>
                    <Input className="h-10" type="number" value={logData.protein} onChange={(e) => setLogData(d => ({ ...d, protein: +e.target.value }))} />
                  </div>
                  <div>
                    <Label>{nutritionCopy.carbsGrams}</Label>
                    <Input className="h-10" type="number" value={logData.carbs} onChange={(e) => setLogData(d => ({ ...d, carbs: +e.target.value }))} />
                  </div>
                  <div>
                    <Label>{nutritionCopy.fatGrams}</Label>
                    <Input className="h-10" type="number" value={logData.fat} onChange={(e) => setLogData(d => ({ ...d, fat: +e.target.value }))} />
                  </div>
                </div>
                </div>
                <DialogFooter className={`mt-3 bg-white/95 dark:bg-slate-950/95 ${ANCLORA_MODAL_ACTIONS_CLASS}`}>
                  <Button
                    variant="outline"
                    className={ANCLORA_MODAL_SECONDARY_ACTION_CLASS}
                    onClick={() => setLogOpen(false)}
                  >
                    {copy.common.cancel}
                  </Button>
                  <Button variant="success" onClick={handleLog} disabled={isLogging} className="h-11 rounded-2xl">
                    {isLogging ? nutritionCopy.saveLoading : copy.common.save}
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={generateOpen} onOpenChange={(v) => { setGenerateOpen(v); if (!v) setGenerateError(null) }}>
            <DialogTrigger asChild>
              <Button variant="success" className="w-full sm:w-auto" disabled={!isProfileReady}>
                <Sparkles className="w-4 h-4 mr-2" />
                {nutritionCopy.generateAiPlan}
              </Button>
            </DialogTrigger>
            <DialogContent showCloseButton={false} className={buildResponsiveModalClass("lg:max-w-[980px]")}>
              <div className="grid gap-0 p-4 sm:p-5 lg:p-6">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="absolute right-4 top-4 z-10 rounded-full border-slate-700/70 bg-slate-900/45 px-5 text-slate-100 hover:bg-slate-800/70 dark:border-slate-700/80 dark:bg-slate-900/45 sm:right-5 sm:top-5 lg:right-6 lg:top-6"
                  onClick={() => { setGenerateOpen(false); setGenerateError(null) }}
                >
                  {copy.common.close}
                </Button>
                <DialogHeader className={ANCLORA_MODAL_HEADER_CLASS}>
                  <DialogTitle>{nutritionCopy.generateMealPlan}</DialogTitle>
                  <DialogDescription>
                    {nutritionCopy.generateMealPlanDescription}
                  </DialogDescription>
                </DialogHeader>
              <div className="space-y-4">
                {!isProfileReady ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-950/20 dark:text-amber-300">
                    {t
                      ? 'Completa objetivo, entorno, nivel, sexo, edad, altura, peso actual, peso objetivo, plazo y días de entrenamiento antes de generar nutrición.'
                      : 'Complete goal, environment, level, sex, age, height, current weight, target weight, timeframe and training days before generating nutrition.'}
                  </div>
                ) : null}
                {profile.age && profile.age >= 40 ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-950/20 dark:text-emerald-300">
                    {t
                      ? `El plan tendrá en cuenta criterios 40+: proteína suficiente, saciedad, recuperación y ajustes por sexo${profile.sex ? ` para ${profile.sex === "female" ? "mujer" : "hombre"}` : ""}.`
                      : `The plan will use 40+ rules: sufficient protein, satiety, recovery and sex-specific adjustments${profile.sex ? ` for a ${profile.sex === "female" ? "female" : "male"} profile` : ""}.`}
                  </div>
                ) : null}
                <div>
                  <Label>{nutritionCopy.goal}</Label>
                  <Select value={generateParams.goal} onValueChange={(v) => setGenerateParams(p => ({ ...p, goal: v }))}>
                    <SelectTrigger><SelectValue placeholder={nutritionCopy.selectPlaceholder} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="perdida_peso">{nutritionCopy.weightLoss}</SelectItem>
                      <SelectItem value="ganancia_muscular">{nutritionCopy.muscleGain}</SelectItem>
                      <SelectItem value="mantenimiento">{nutritionCopy.maintenance}</SelectItem>
                      <SelectItem value="energia">{nutritionCopy.moreEnergy}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{nutritionCopy.recipeDifficulty}</Label>
                  <Select value={generateParams.difficulty} onValueChange={(v) => setGenerateParams(p => ({ ...p, difficulty: v as any }))}>
                    <SelectTrigger><SelectValue placeholder={nutritionCopy.anyPlaceholder} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="facil">{nutritionCopy.easy}</SelectItem>
                      <SelectItem value="medio">{nutritionCopy.medium}</SelectItem>
                      <SelectItem value="dificil">{nutritionCopy.hard}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{nutritionCopy.dietType}</Label>
                  <Select value={generateParams.dietType} onValueChange={(v) => setGenerateParams(p => ({ ...p, dietType: v as any }))}>
                    <SelectTrigger><SelectValue placeholder={nutritionCopy.noRestriction} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ninguna">{nutritionCopy.noRestriction}</SelectItem>
                      <SelectItem value="mediterranea">{t ? 'Mediterránea 🫒' : 'Mediterranean 🫒'}</SelectItem>
                      <SelectItem value="dash">{t ? 'DASH (antihipertensiva) ❤️' : 'DASH (anti-hypertension) ❤️'}</SelectItem>
                      <SelectItem value="ayuno_intermitente">{t ? 'Ayuno Intermitente 16:8 ⏱️' : 'Intermittent Fasting 16:8 ⏱️'}</SelectItem>
                      <SelectItem value="alta_proteina">{t ? 'Alta en proteína 💪' : 'High protein 💪'}</SelectItem>
                    </SelectContent>
                  </Select>
                  {generateParams.dietType === 'mediterranea' && (
                    <p className="text-xs text-muted-foreground mt-1">{t ? 'Avalada por el ensayo PREDIMED (+7.000 participantes). Reduce riesgo cardiovascular un 30%.' : 'Backed by the PREDIMED trial (+7,000 participants). Reduces cardiovascular risk by 30%.'}</p>
                  )}
                  {generateParams.dietType === 'dash' && (
                    <p className="text-xs text-muted-foreground mt-1">{t ? 'Desarrollada por el NIH. Recomendada por la AHA para hipertensión, pérdida de peso y salud metabólica.' : 'Developed by the NIH. Recommended by the AHA for hypertension, weight loss and metabolic health.'}</p>
                  )}
                  {generateParams.dietType === 'ayuno_intermitente' && (
                    <p className="text-xs text-muted-foreground mt-1">{t ? 'Protocolo 16:8. Ventana de alimentación 12:00–20:00. Solo Almuerzo y Cena. Sin desayuno.' : '16:8 protocol. Eating window 12:00–20:00. Lunch and Dinner only. No breakfast.'}</p>
                  )}
                  {generateParams.dietType === 'alta_proteina' && (
                    <p className="text-xs text-muted-foreground mt-1">{t ? 'Pensada para aumentar saciedad, recuperación y masa muscular con recetas de proteína alta.' : 'Designed to improve satiety, recovery and muscle gain with high-protein recipes.'}</p>
                  )}
                </div>
                {generateError && (
                  <div className="px-3 py-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg">
                    {generateError}
                  </div>
                )}
                <DialogFooter className={ANCLORA_MODAL_ACTIONS_CLASS}>
                  <Button
                    variant="outline"
                    className={ANCLORA_MODAL_SECONDARY_ACTION_CLASS}
                    onClick={() => { setGenerateOpen(false); setGenerateError(null) }}
                  >
                    {copy.common.cancel}
                  </Button>
                  <Button variant="success" onClick={handleGenerate} disabled={isGenerating || !isProfileReady} className="h-11 rounded-2xl">
                    {isGenerating ? nutritionCopy.generatePlanLoading : nutritionCopy.generateWeeklyPlan}
                  </Button>
                </DialogFooter>
              </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Resumen del día */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <Flame className="w-6 h-6 mx-auto text-orange-500 mb-1" />
              <p className="text-2xl font-bold">{summary.totals.calories}</p>
              <p className="text-xs text-muted-foreground">{t ? 'Calorías' : 'Calories'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Beef className="w-6 h-6 mx-auto text-red-500 mb-1" />
              <p className="text-2xl font-bold">{Math.round(summary.totals.protein)}g</p>
              <p className="text-xs text-muted-foreground">{t ? 'Proteína' : 'Protein'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Wheat className="w-6 h-6 mx-auto text-amber-500 mb-1" />
              <p className="text-2xl font-bold">{Math.round(summary.totals.carbs)}g</p>
              <p className="text-xs text-muted-foreground">{t ? 'Carbos' : 'Carbs'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Droplets className="w-6 h-6 mx-auto text-blue-500 mb-1" />
              <p className="text-2xl font-bold">{Math.round(summary.totals.fat)}g</p>
              <p className="text-xs text-muted-foreground">{t ? 'Grasa' : 'Fat'}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {latestPlan?.explanation ? (
        <Card className="border-0 bg-gradient-to-r from-emerald-50 to-teal-50 shadow-lg dark:from-emerald-950/20 dark:to-teal-950/20">
          <CardHeader className="px-4 pb-2 pt-4 sm:px-6 sm:pb-3 sm:pt-6">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-500" />
              {copy.nutrition.recommendationWhy}
            </CardTitle>
            <CardDescription>{latestPlan.explanation.summary || copy.nutrition.recommendationSummary}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 px-4 pb-4 pt-0 sm:px-6 sm:pb-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-2">
              {latestPlan.explanation.reasons.map((reason) => (
                <div
                  key={reason}
                  className="rounded-2xl border border-emerald-100 bg-white/80 px-3 py-2 text-xs leading-5 text-slate-700 dark:border-emerald-500/10 dark:bg-slate-950/40 dark:text-slate-200 sm:text-sm"
                >
                  {reason}
                </div>
              ))}
              {latestPlan.explanation.signals?.length ? (
                <div className="grid gap-2 pt-1 grid-cols-2 sm:grid-cols-3">
                  {latestPlan.explanation.signals.map((signal) => (
                    <div key={`${signal.label}-${signal.value}`} className="rounded-2xl border border-emerald-100 bg-white/80 px-3 py-2.5 text-xs text-slate-700 dark:border-emerald-500/10 dark:bg-slate-950/40 dark:text-slate-200 sm:py-3 sm:text-sm">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400 sm:text-xs">{signal.label}</p>
                      <p className="mt-1.5 font-semibold sm:mt-2">{signal.value}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            {latestPlan.explanation.adjustment ? (
              <div className="rounded-2xl border border-emerald-200/70 bg-emerald-100/60 p-3.5 dark:border-emerald-500/20 dark:bg-emerald-950/20 sm:p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300 sm:text-xs">
                  {copy.nutrition.recommendationAdjustment}
                </p>
                <p className="mt-2 text-xs leading-5 text-emerald-900 dark:text-emerald-100 sm:text-sm">
                  {latestPlan.explanation.adjustment}
                </p>
                {latestPlan.explanation.nextBestAction ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 h-10 w-full rounded-2xl border-emerald-300/70 bg-white/80 text-xs text-emerald-800 hover:bg-white dark:border-emerald-500/20 dark:bg-slate-950/40 dark:text-emerald-100 sm:mt-4 sm:text-sm"
                    onClick={() => setLogOpen(true)}
                  >
                    {latestPlan.explanation.nextBestAction.label}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {fastingState?.enabled && (
        <div className="grid gap-3 md:grid-cols-3 md:gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <TimerReset className="mx-auto mb-1 h-6 w-6 text-emerald-500" />
              <p className="text-2xl font-bold">{fastingState.fastingHours !== null ? `${fastingState.fastingHours}h` : "—"}</p>
              <p className="text-xs text-muted-foreground">{t ? 'Ayuno estimado de hoy' : 'Estimated fasting today'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Clock3 className="mx-auto mb-1 h-6 w-6 text-blue-500" />
              <p className="text-sm font-semibold">
                {formatLocalTime(fastingState.firstIntakeAt, t ? "es-ES" : "en-US")} - {formatLocalTime(fastingState.lastIntakeAt, t ? "es-ES" : "en-US")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t ? 'Ventana de ingesta' : 'Eating window'} {fastingState.eatingWindowHours !== null ? `(${fastingState.eatingWindowHours}h)` : ''}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Apple className="mx-auto mb-1 h-6 w-6 text-orange-500" />
              <p className="text-2xl font-bold">{Math.round(fastingState.carryoverCalories)}</p>
              <p className="text-xs text-muted-foreground">
                {t ? 'Kcal pendientes de compensar' : 'Carryover kcal to balance'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Plan semanal más reciente */}
      {latestPlan && (
        <Card>
          <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  {nutritionCopy.weeklyPlanTitle}
                </CardTitle>
                <CardDescription>
                  {nutritionCopy.weekOf} {new Date(latestPlan.weekStart).toLocaleDateString()}
                  {latestPlan.goal && (
                    <span className="ml-2 inline-flex rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">
                      {formatNutritionGoal(latestPlan.goal, t)}
                    </span>
                  )}
                  {latestPlan.dietType === 'ayuno_intermitente' && (
                    <span className="ml-2 inline-flex rounded-full border border-emerald-200 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-300">
                      {nutritionCopy.intermittentFastingBadge}
                    </span>
                  )}
                </CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="success" size="sm" className="w-full sm:w-auto" onClick={() => router.push(`/nutrition/meal-plans/${latestPlan.id}`)}>
                  {nutritionCopy.viewFull}
                </Button>
                <Button variant="destructive" size="sm" className="w-full sm:w-auto" onClick={() => handleDeleteMealPlan(latestPlan.id)} disabled={isDeleting}>
                  {t ? 'Eliminar' : 'Delete'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0 sm:px-6 sm:pb-6">
            <Tabs defaultValue="0">
              <TabsList className="flex w-full min-w-0 gap-1 overflow-x-auto whitespace-nowrap">
                {dayNames.map((day, i) => (
                  <TabsTrigger key={i} value={String(i)} className="shrink-0 px-3 text-xs">
                    {day.slice(0, 3)}
                  </TabsTrigger>
                ))}
              </TabsList>

              {dayNames.map((_, dayIndex) => {
                const dayMeals = latestPlan.meals.filter((m) => m.dayOfWeek === dayIndex)
                return (
                  <TabsContent key={dayIndex} value={String(dayIndex)} className="space-y-3 mt-4">
                    {dayMeals.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">
                        {nutritionCopy.noMealsForDay}
                      </p>
                    ) : (
                      dayMeals.map((meal) => (
                        <Card key={meal.id} className="bg-muted/30">
                          <CardContent className="px-3 py-3 sm:px-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex items-center gap-2">
                                <UtensilsCrossed className="w-4 h-4 text-green-600" />
                                <span className="font-medium capitalize">{meal.mealType}</span>
                              </div>
                              {meal.servingMultiplier < 1 && (
                                <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                                  {nutritionCopy.adjusted} -{Math.round((1 - meal.servingMultiplier) * 100)}%
                                </span>
                              )}
                            </div>
                            {meal.adjustmentReason && (
                              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{meal.adjustmentReason}</p>
                            )}
                            {meal.recipes.map((mr) => (
                              <div key={mr.id} className="mt-2">
                                <p className="text-sm font-medium leading-5 sm:text-base">{mr.recipe.name}</p>
                                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground sm:mt-1 sm:grid sm:grid-cols-2 sm:gap-x-3 sm:gap-y-1 sm:text-xs lg:flex lg:flex-wrap lg:gap-4">
                                  <span className="rounded-full bg-slate-200/55 px-2 py-1 dark:bg-slate-800/70">{Math.round((mr.recipe.calories || 0) * meal.servingMultiplier)} kcal</span>
                                  <span className="rounded-full bg-slate-200/55 px-2 py-1 dark:bg-slate-800/70">P: {mr.recipe.protein}g</span>
                                  <span className="rounded-full bg-slate-200/55 px-2 py-1 dark:bg-slate-800/70">C: {mr.recipe.carbs}g</span>
                                  <span className="rounded-full bg-slate-200/55 px-2 py-1 dark:bg-slate-800/70">G: {mr.recipe.fat}g</span>
                                </div>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </TabsContent>
                )
              })}
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Comidas registradas hoy */}
      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Apple className="w-5 h-5 text-green-600" />
              {nutritionCopy.todayLog}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="flex flex-col gap-1 py-2 border-b last:border-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <span className="font-medium capitalize">{log.mealType}</span>
                  {log.name && <span className="text-muted-foreground ml-2 break-words">— {log.name}</span>}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  {log.consumedAt && <span>{formatLocalTime(log.consumedAt, t ? "es-ES" : "en-US")}</span>}
                  <span>{log.calories} kcal</span>
                  <span>P:{log.protein}g</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Estado vacío */}
      {!isLoading && mealPlans.length === 0 && logs.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <ChefHat className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {nutritionCopy.emptyTitle}
            </h3>
            <p className="text-muted-foreground mb-4">
              {nutritionCopy.emptyDescription}
            </p>
            <Button variant="success" onClick={() => setGenerateOpen(true)}>
              <Sparkles className="w-4 h-4 mr-2" />
              {nutritionCopy.generateFirstPlan}
            </Button>
          </CardContent>
        </Card>
      )}

      <HealthPlanCrossLink context="nutrition" />
    </div>
  )
}

export default function NutritionPage() {
  return (
    <ProtectedDashboardPage>
      <NutritionPageContent />
    </ProtectedDashboardPage>
  )
}
