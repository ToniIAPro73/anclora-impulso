"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, ChevronRight, Dumbbell, MapPin, ShieldAlert, Target, TrendingUp, UserRound } from "lucide-react"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/lib/contexts/auth-context"
import { getProfileCompletion, type ExperienceLevel, type ProfileSex, type TrainingEnvironment, type TrainingGoal } from "@/lib/user-profile"
import { useLanguage } from "@/lib/contexts/language-context"
import { trackProductEvent } from "@/lib/product-events"

interface OnboardingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function toNumber(value: string) {
  if (!value.trim()) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const LIMITATION_OPTIONS = [
  { id: "rodillas", en: "knees" },
  { id: "lumbar", en: "lower back" },
  { id: "hombros", en: "shoulders" },
  { id: "cuello", en: "neck" },
  { id: "movilidad", en: "mobility" },
] as const

export function OnboardingDialog({ open, onOpenChange }: OnboardingDialogProps) {
  const { profile, updateProfile } = useAuth()
  const { language } = useLanguage()
  const isSpanish = language === "es"
  const [step, setStep] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState({
    trainingGoal: profile.trainingGoal ?? "",
    preferredTrainingEnvironment: profile.preferredTrainingEnvironment ?? "",
    experienceLevel: profile.experienceLevel ?? "",
    sex: profile.sex ?? "",
    age: profile.age?.toString() ?? "",
    heightCm: profile.heightCm?.toString() ?? "",
    weightKg: profile.weightKg?.toString() ?? "",
    targetWeightKg: profile.targetWeightKg?.toString() ?? "",
    timeframeWeeks: profile.timeframeWeeks?.toString() ?? "",
    trainingDaysPerWeek: profile.trainingDaysPerWeek?.toString() ?? "",
    limitations: profile.limitations?.join(", ") ?? "",
  })

  useEffect(() => {
    if (!open) return
    setStep(0)
    setForm({
      trainingGoal: profile.trainingGoal ?? "",
      preferredTrainingEnvironment: profile.preferredTrainingEnvironment ?? "",
      experienceLevel: profile.experienceLevel ?? "",
      sex: profile.sex ?? "",
      age: profile.age?.toString() ?? "",
      heightCm: profile.heightCm?.toString() ?? "",
      weightKg: profile.weightKg?.toString() ?? "",
      targetWeightKg: profile.targetWeightKg?.toString() ?? "",
      timeframeWeeks: profile.timeframeWeeks?.toString() ?? "",
      trainingDaysPerWeek: profile.trainingDaysPerWeek?.toString() ?? "",
      limitations: profile.limitations?.join(", ") ?? "",
    })
  }, [open, profile])

  const parsedLimitations = useMemo(
    () =>
      form.limitations
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 8),
    [form.limitations],
  )

  const previewCompletion = getProfileCompletion({
    ...profile,
    trainingGoal: (form.trainingGoal || null) as TrainingGoal | null,
    preferredTrainingEnvironment: (form.preferredTrainingEnvironment || null) as TrainingEnvironment | null,
    experienceLevel: (form.experienceLevel || null) as ExperienceLevel | null,
    sex: (form.sex || null) as ProfileSex | null,
    age: toNumber(form.age),
    heightCm: toNumber(form.heightCm),
    weightKg: toNumber(form.weightKg),
    targetWeightKg: toNumber(form.targetWeightKg),
    timeframeWeeks: toNumber(form.timeframeWeeks),
    trainingDaysPerWeek: toNumber(form.trainingDaysPerWeek),
    limitations: parsedLimitations,
  })

  const handleToggleLimitation = (value: string) => {
    const current = new Set(parsedLimitations)
    if (current.has(value)) {
      current.delete(value)
    } else {
      current.add(value)
    }
    setForm((prev) => ({ ...prev, limitations: Array.from(current).join(", ") }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateProfile({
        trainingGoal: (form.trainingGoal || null) as TrainingGoal | null,
        preferredTrainingEnvironment: (form.preferredTrainingEnvironment || null) as TrainingEnvironment | null,
        experienceLevel: (form.experienceLevel || null) as ExperienceLevel | null,
        sex: (form.sex || null) as ProfileSex | null,
        age: toNumber(form.age),
        heightCm: toNumber(form.heightCm),
        weightKg: toNumber(form.weightKg),
        targetWeightKg: toNumber(form.targetWeightKg),
        timeframeWeeks: toNumber(form.timeframeWeeks),
        trainingDaysPerWeek: toNumber(form.trainingDaysPerWeek),
        limitations: parsedLimitations,
        onboardingCompletedAt: new Date().toISOString(),
      })
      await trackProductEvent({
        action: "onboarding_completed",
        category: "activation",
        source: "onboarding_dialog",
        metadata: {
          profileCompletion: previewCompletion.percentage,
          trainingGoal: form.trainingGoal || null,
          trainingEnvironment: form.preferredTrainingEnvironment || null,
        },
      })
      onOpenChange(false)
    } finally {
      setIsSaving(false)
    }
  }

  const steps = [
    {
      title: isSpanish ? "Contexto de entrenamiento" : "Training context",
      description: isSpanish ? "Define objetivo, entorno y nivel para personalizar tu experiencia." : "Define your goal, environment and level to personalize the experience.",
      icon: Target,
      content: (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2 sm:col-span-3">
            <Label>{isSpanish ? "Objetivo principal" : "Primary goal"}</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { value: "lose_weight", label: isSpanish ? "Perder peso" : "Lose weight" },
                { value: "build_muscle", label: isSpanish ? "Ganar músculo" : "Build muscle" },
                { value: "recomposition", label: isSpanish ? "Recomposición" : "Recomposition" },
                { value: "maintain", label: isSpanish ? "Mantener" : "Maintain" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, trainingGoal: option.value }))}
                  className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                    form.trainingGoal === option.value
                      ? "border-orange-400 bg-orange-50 text-orange-900 dark:border-orange-500 dark:bg-orange-500/10 dark:text-orange-100"
                      : "border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200"
                  }`}
                >
                  <div className="font-semibold">{option.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{isSpanish ? "Entorno habitual" : "Usual environment"}</Label>
            <Select value={form.preferredTrainingEnvironment || undefined} onValueChange={(value) => setForm((prev) => ({ ...prev, preferredTrainingEnvironment: value }))}>
              <SelectTrigger>
                <SelectValue placeholder={isSpanish ? "Selecciona" : "Select"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gym">{isSpanish ? "Gimnasio" : "Gym"}</SelectItem>
                <SelectItem value="home">{isSpanish ? "Casa" : "Home"}</SelectItem>
                <SelectItem value="outdoor">{isSpanish ? "Exterior" : "Outdoor"}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>{isSpanish ? "Nivel actual" : "Current level"}</Label>
            <Select value={form.experienceLevel || undefined} onValueChange={(value) => setForm((prev) => ({ ...prev, experienceLevel: value }))}>
              <SelectTrigger>
                <SelectValue placeholder={isSpanish ? "Selecciona" : "Select"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">{isSpanish ? "Principiante" : "Beginner"}</SelectItem>
                <SelectItem value="intermediate">{isSpanish ? "Intermedio" : "Intermediate"}</SelectItem>
                <SelectItem value="advanced">{isSpanish ? "Avanzado" : "Advanced"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ),
    },
    {
      title: isSpanish ? "Datos base" : "Core profile",
      description: isSpanish ? "Lo mínimo para generar recomendaciones coherentes." : "The minimum data needed for coherent recommendations.",
      icon: UserRound,
      content: (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{isSpanish ? "Sexo" : "Sex"}</Label>
            <Select value={form.sex || undefined} onValueChange={(value) => setForm((prev) => ({ ...prev, sex: value }))}>
              <SelectTrigger>
                <SelectValue placeholder={isSpanish ? "Selecciona" : "Select"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">{isSpanish ? "Hombre" : "Male"}</SelectItem>
                <SelectItem value="female">{isSpanish ? "Mujer" : "Female"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{isSpanish ? "Edad" : "Age"}</Label>
            <Input inputMode="numeric" value={form.age} onChange={(event) => setForm((prev) => ({ ...prev, age: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>{isSpanish ? "Altura (cm)" : "Height (cm)"}</Label>
            <Input inputMode="decimal" value={form.heightCm} onChange={(event) => setForm((prev) => ({ ...prev, heightCm: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>{isSpanish ? "Peso actual (kg)" : "Current weight (kg)"}</Label>
            <Input inputMode="decimal" value={form.weightKg} onChange={(event) => setForm((prev) => ({ ...prev, weightKg: event.target.value }))} />
          </div>
        </div>
      ),
    },
    {
      title: isSpanish ? "Objetivo y limitaciones" : "Target and limitations",
      description: isSpanish ? "Con esto podemos ajustar carga, frecuencia y expectativas." : "This lets us tune load, frequency and expectations.",
      icon: TrendingUp,
      content: (
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>{isSpanish ? "Peso objetivo (kg)" : "Target weight (kg)"}</Label>
              <Input inputMode="decimal" value={form.targetWeightKg} onChange={(event) => setForm((prev) => ({ ...prev, targetWeightKg: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{isSpanish ? "Plazo (semanas)" : "Timeframe (weeks)"}</Label>
              <Input inputMode="numeric" value={form.timeframeWeeks} onChange={(event) => setForm((prev) => ({ ...prev, timeframeWeeks: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{isSpanish ? "Entrenos/semana" : "Workouts/week"}</Label>
              <Input inputMode="numeric" value={form.trainingDaysPerWeek} onChange={(event) => setForm((prev) => ({ ...prev, trainingDaysPerWeek: event.target.value }))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-orange-500" />
              {isSpanish ? "Limitaciones o molestias" : "Limitations or pain points"}
            </Label>
            <div className="flex flex-wrap gap-2">
              {LIMITATION_OPTIONS.map((option) => {
                const label = isSpanish ? option.id : option.en
                const active = parsedLimitations.includes(option.id) || parsedLimitations.includes(option.en)
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleToggleLimitation(option.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? "border-orange-400 bg-orange-50 text-orange-900 dark:border-orange-500 dark:bg-orange-500/10 dark:text-orange-100"
                        : "border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300"
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            <Textarea
              value={form.limitations}
              onChange={(event) => setForm((prev) => ({ ...prev, limitations: event.target.value }))}
              placeholder={isSpanish ? "Ej: rodillas, lumbar, hombros" : "Ex: knees, lower back, shoulders"}
              className="min-h-20"
            />
          </div>
        </div>
      ),
    },
  ]

  const currentStep = steps[step]
  const Icon = currentStep.icon

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="h-[calc(100dvh-0.75rem)] w-[calc(100vw-0.75rem)] max-h-[980px] max-w-[1280px] overflow-hidden rounded-[28px] border-orange-200/70 bg-[linear-gradient(180deg,rgba(255,251,245,0.98),rgba(255,255,255,0.96))] p-0 shadow-[0_30px_120px_rgba(15,23,42,0.35)] backdrop-blur-xl sm:h-[calc(100dvh-1.5rem)] sm:w-[calc(100vw-2rem)] lg:h-[calc(100dvh-2rem)] lg:w-[calc(100vw-3rem)] lg:max-h-none lg:max-w-[1480px] dark:border-orange-400/10 dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.98))]"
      >
        <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)] lg:grid-rows-1">
          <div className="border-b border-orange-100/70 bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.2),_transparent_52%),linear-gradient(180deg,_rgba(255,247,237,0.95),_rgba(255,237,213,0.7))] p-4 dark:border-orange-400/10 dark:bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.14),_transparent_48%),linear-gradient(180deg,_rgba(15,23,42,0.96),_rgba(15,23,42,0.88))] sm:p-6 lg:min-h-0 lg:border-b-0 lg:border-r lg:overflow-y-auto">
            <DialogHeader className="text-left">
              <DialogTitle className="text-2xl text-slate-900 dark:text-white">
                {isSpanish ? "Configura tu perfil" : "Set up your profile"}
              </DialogTitle>
              <DialogDescription className="text-slate-600 dark:text-slate-400">
                {isSpanish ? "Completa tu base para desbloquear recomendaciones más precisas, mejor adherencia y un dashboard realmente útil." : "Complete your base profile to unlock better recommendations, adherence guidance and a more useful dashboard."}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 space-y-4">
              <div className="rounded-3xl border border-white/60 bg-white/75 p-4 dark:border-white/5 dark:bg-slate-950/40">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      {isSpanish ? "Perfil completo" : "Profile completion"}
                    </p>
                    <p className="mt-1 text-3xl font-semibold text-slate-900 dark:text-white">{previewCompletion.percentage}%</p>
                  </div>
                  <CheckCircle2 className="h-10 w-10 text-orange-500" />
                </div>
                <Progress value={previewCompletion.percentage} className="mt-4 h-2.5" />
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                  {previewCompletion.isComplete
                    ? isSpanish ? "Tu perfil ya tiene el mínimo necesario para recomendaciones avanzadas." : "Your profile now contains the minimum required for advanced recommendations."
                    : isSpanish ? "Aún faltan datos clave para afinar planes y seguimiento." : "Some key fields are still missing for accurate plans and tracking."}
                </p>
              </div>

              <div className="space-y-2">
                {steps.map((item, index) => {
                  const StepIcon = item.icon
                  const active = index === step
                  return (
                    <div key={item.title} className={`flex items-center gap-3 rounded-2xl border px-3 py-3 ${active ? "border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-500/60 dark:bg-orange-500/10 dark:text-orange-100" : "border-slate-200 bg-white/70 text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300"}`}>
                      <StepIcon className="h-4 w-4 shrink-0" />
                      <span className="text-sm font-medium">{item.title}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-4 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em]">
                  {isSpanish ? `Paso ${step + 1} de ${steps.length}` : `Step ${step + 1} of ${steps.length}`}
                </Badge>
                <div className="mt-4 flex items-center gap-3">
                  <div className="rounded-2xl bg-orange-500/10 p-3 text-orange-600 dark:text-orange-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{currentStep.title}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{currentStep.description}</p>
                  </div>
                </div>
              </div>
            </div>

            <div
              data-testid="onboarding-step-scroll-body"
              className="min-h-0 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]"
            >
              <div className="max-w-5xl pb-4">
              {currentStep.content}
              </div>
            </div>

            <div className="mt-4 flex shrink-0 flex-col gap-3 border-t border-orange-100/70 bg-white/80 pt-4 dark:border-orange-400/10 dark:bg-slate-950/40 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <MapPin className="h-4 w-4" />
                {isSpanish ? "Este flujo se guarda y sincroniza entre dispositivos." : "This flow is saved and synced across devices."}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" onClick={() => (step === 0 ? onOpenChange(false) : setStep((current) => current - 1))}>
                  {step === 0 ? (isSpanish ? "Más tarde" : "Later") : (isSpanish ? "Atrás" : "Back")}
                </Button>
                {step < steps.length - 1 ? (
                  <Button className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600" onClick={() => setStep((current) => current + 1)}>
                    <Dumbbell className="mr-2 h-4 w-4" />
                    {isSpanish ? "Continuar" : "Continue"}
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button disabled={isSaving} className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600" onClick={handleSave}>
                    {isSaving ? (isSpanish ? "Guardando..." : "Saving...") : (isSpanish ? "Finalizar onboarding" : "Finish onboarding")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
