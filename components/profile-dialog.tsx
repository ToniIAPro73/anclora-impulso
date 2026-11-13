"use client"

import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react"
import Link from "next/link"
import { Calculator, Camera, Target, UserRound, Weight, Ruler, CalendarClock, Sparkles } from "lucide-react"

import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { UserAvatar } from "@/components/user-avatar"
import { useAuth } from "@/lib/contexts/auth-context"
import { useLanguage } from "@/lib/contexts/language-context"
import { buildRecommendedPlan, calculateBmi, interpretBmi, type ProfileSex } from "@/lib/user-profile"

interface ProfileDialogProps {
  children?: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function toNumber(value: string) {
  if (!value.trim()) {
    return null
  }

  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function ProfileDialog({ children, open: controlledOpen, onOpenChange }: ProfileDialogProps) {
  const { user, profile, updateProfile } = useAuth()
  const { language } = useLanguage()
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen
  const [form, setForm] = useState({
    sex: profile.sex ?? "",
    age: profile.age?.toString() ?? "",
    heightCm: profile.heightCm?.toString() ?? "",
    weightKg: profile.weightKg?.toString() ?? "",
    targetWeightKg: profile.targetWeightKg?.toString() ?? "",
    timeframeWeeks: profile.timeframeWeeks?.toString() ?? "",
    trainingDaysPerWeek: profile.trainingDaysPerWeek?.toString() ?? "",
    avatarDataUrl: profile.avatarDataUrl ?? "",
  })

  useEffect(() => {
    if (open) {
      setForm({
        sex: profile.sex ?? "",
        age: profile.age?.toString() ?? "",
        heightCm: profile.heightCm?.toString() ?? "",
        weightKg: profile.weightKg?.toString() ?? "",
        targetWeightKg: profile.targetWeightKg?.toString() ?? "",
        timeframeWeeks: profile.timeframeWeeks?.toString() ?? "",
        trainingDaysPerWeek: profile.trainingDaysPerWeek?.toString() ?? "",
        avatarDataUrl: profile.avatarDataUrl ?? "",
      })
    }
  }, [open, profile])

  const bmi = useMemo(() => calculateBmi(toNumber(form.heightCm), toNumber(form.weightKg)), [form.heightCm, form.weightKg])
  const bmiInterpretation = interpretBmi(bmi)
  const recommendedPlan = useMemo(
    () =>
      buildRecommendedPlan({
        sex: (form.sex || null) as ProfileSex | null,
        age: toNumber(form.age),
        heightCm: toNumber(form.heightCm),
        weightKg: toNumber(form.weightKg),
        targetWeightKg: toNumber(form.targetWeightKg),
        timeframeWeeks: toNumber(form.timeframeWeeks),
        trainingDaysPerWeek: toNumber(form.trainingDaysPerWeek),
        avatarDataUrl: form.avatarDataUrl || null,
      }, language === "es" ? "es" : "en"),
    [form, language],
  )

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })

    setForm((current) => ({ ...current, avatarDataUrl: dataUrl }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveError(false)

    try {
      await updateProfile({
        sex: (form.sex || null) as ProfileSex | null,
        age: toNumber(form.age),
        heightCm: toNumber(form.heightCm),
        weightKg: toNumber(form.weightKg),
        targetWeightKg: toNumber(form.targetWeightKg),
        timeframeWeeks: toNumber(form.timeframeWeeks),
        trainingDaysPerWeek: toNumber(form.trainingDaysPerWeek),
        avatarDataUrl: form.avatarDataUrl || null,
        recommendedPlan,
      })
      handleOpenChange(false)
    } catch {
      // Keep the dialog open with the entered data and tell the user; never fail silently.
      setSaveError(true)
    } finally {
      setIsSaving(false)
    }
  }

  const primaryMetrics = [
    { id: "profile-age", label: "Edad", value: form.age, inputMode: "numeric" as const, onChange: (value: string) => setForm((current) => ({ ...current, age: value })) },
    { id: "profile-height", label: "Altura", suffix: "cm", value: form.heightCm, inputMode: "decimal" as const, onChange: (value: string) => setForm((current) => ({ ...current, heightCm: value })) },
    { id: "profile-weight", label: "Peso actual", suffix: "kg", value: form.weightKg, inputMode: "decimal" as const, onChange: (value: string) => setForm((current) => ({ ...current, weightKg: value })) },
  ]

  const objectiveMetrics = [
    { id: "profile-target-weight", label: "Peso objetivo", suffix: "kg", value: form.targetWeightKg, inputMode: "decimal" as const, onChange: (value: string) => setForm((current) => ({ ...current, targetWeightKg: value })) },
    { id: "profile-timeframe", label: "Plazo", suffix: "semanas", value: form.timeframeWeeks, inputMode: "numeric" as const, onChange: (value: string) => setForm((current) => ({ ...current, timeframeWeeks: value })) },
    { id: "profile-days", label: "Entrenos", suffix: "días/sem", value: form.trainingDaysPerWeek, inputMode: "numeric" as const, onChange: (value: string) => setForm((current) => ({ ...current, trainingDaysPerWeek: value })) },
  ]

  const weeklyPreview = recommendedPlan?.weeklySplit.slice(0, 4) ?? []

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSaveError(false)
    }
    if (!isControlled) {
      setUncontrolledOpen(nextOpen)
    }

    onOpenChange?.(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <DialogContent
        className="max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1rem)] max-w-4xl overflow-hidden rounded-[24px] border border-orange-200/60 bg-[linear-gradient(180deg,rgba(255,251,245,0.98),rgba(255,255,255,0.96))] p-0 shadow-[0_30px_120px_rgba(15,23,42,0.35)] backdrop-blur-xl sm:w-[calc(100vw-2rem)] dark:border-orange-400/10 dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.98))]"
      >
        <div className="grid h-full min-h-0 grid-cols-1 overflow-hidden lg:grid-cols-[240px_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col overflow-y-auto border-b border-orange-100/80 bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.22),_transparent_48%),linear-gradient(180deg,_rgba(255,247,237,0.92),_rgba(255,237,213,0.56))] px-3 py-3 lg:min-h-0 lg:border-r lg:border-b-0 lg:py-2.5 dark:border-orange-400/10 dark:bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.12),_transparent_45%),linear-gradient(180deg,_rgba(15,23,42,0.98),_rgba(15,23,42,0.88))]">
            <DialogHeader className="text-left">
              <DialogTitle className="flex items-center gap-2 text-[1.6rem] font-semibold tracking-tight text-slate-900 dark:text-white">
                <UserRound className="h-4.5 w-4.5 text-orange-500" />
                Perfil
              </DialogTitle>
              <DialogDescription className="max-w-[17ch] text-[11px] leading-5 text-slate-600 dark:text-slate-400">
                Ajusta tus datos y define una base clara para tu entrenamiento.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-2.5 grid grid-cols-1 gap-2 lg:flex-1">
              <div className="overflow-hidden rounded-[18px] border border-white/60 bg-white/72 p-2.5 shadow-[0_16px_40px_rgba(251,146,60,0.12)] dark:border-white/5 dark:bg-slate-950/45">
                <div className="flex items-center gap-2.5">
                  <UserAvatar className="size-10 ring-4 ring-white/70 dark:ring-slate-900/70" fallbackClassName="text-sm" imageSrc={form.avatarDataUrl || null} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-slate-900 dark:text-white">{user?.fullName || "Usuario"}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
                  </div>
                </div>
                <Label
                  htmlFor="avatar-upload"
                  className="mt-2 inline-flex h-7 w-full cursor-pointer items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-3 text-[11px] font-semibold text-white transition hover:from-orange-600 hover:to-rose-600"
                >
                  <Camera className="h-3.5 w-3.5 shrink-0" />
                  Cambiar avatar
                </Label>
                <Input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>

              <div className="grid gap-2">
                <div className="overflow-hidden rounded-[18px] border border-white/60 bg-white/70 p-2 shadow-sm dark:border-white/5 dark:bg-slate-950/45">
                  <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    <Calculator className="h-4 w-4 text-orange-500" />
                    IMC
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[1.2rem] font-semibold tracking-tight text-slate-900 dark:text-white">{bmi ?? "--"}</p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Índice estimado</p>
                      {bmiInterpretation ? (
                        <p className="mt-1 text-[11px] font-medium leading-4 text-orange-700 dark:text-orange-300">
                          {bmiInterpretation}
                        </p>
                      ) : null}
                    </div>
                    {bmiInterpretation ? (
                      <Badge
                        title={bmiInterpretation}
                        className="shrink-0 rounded-full border-0 bg-orange-100 px-2 py-1 text-[10px] font-semibold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300"
                      >
                        {bmiInterpretation}
                      </Badge>
                    ) : null}
                  </div>
                </div>

                <div className="overflow-hidden rounded-[18px] border border-white/60 bg-[linear-gradient(160deg,rgba(15,23,42,0.94),rgba(30,41,59,0.88))] p-2 text-white shadow-[0_16px_40px_rgba(15,23,42,0.28)] max-lg:border-orange-200/70 max-lg:bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.18),_transparent_52%),linear-gradient(160deg,rgba(255,247,237,0.96),rgba(255,255,255,0.92))] max-lg:text-slate-900 max-lg:shadow-[0_16px_40px_rgba(251,146,60,0.12)] dark:border-white/5 dark:bg-[linear-gradient(160deg,rgba(15,23,42,0.94),rgba(30,41,59,0.88))] dark:text-white dark:shadow-[0_16px_40px_rgba(15,23,42,0.28)]">
                  <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-200 max-lg:text-orange-700 dark:text-orange-200">
                    <Sparkles className="h-4 w-4 text-orange-400 max-lg:text-orange-500 dark:text-orange-400" />
                    Enfoque
                  </div>
                  {recommendedPlan ? (
                    <>
                      <p className="line-clamp-2 text-[12px] font-semibold leading-4.5">{recommendedPlan.title}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <Badge className="rounded-full border-0 bg-white/10 px-2 py-1 text-[10px] text-white max-lg:bg-orange-100 max-lg:text-orange-800 dark:bg-white/10 dark:text-white">{recommendedPlan.duration} min</Badge>
                        <Badge title={recommendedPlan.difficulty} className="max-w-full truncate rounded-full border-0 bg-white/10 px-2 py-1 text-[10px] text-white max-lg:bg-orange-100 max-lg:text-orange-800 dark:bg-white/10 dark:text-white">{recommendedPlan.difficulty}</Badge>
                      </div>
                    </>
                  ) : (
                    <p className="text-[12px] leading-4.5 text-slate-300 max-lg:text-slate-600 dark:text-slate-300">
                      Completa tus métricas para generar una propuesta inicial.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(248,250,252,0.94))] px-3 py-3 dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.3),rgba(15,23,42,0.12))] lg:py-4 lg:pr-10">

            <div className="min-h-0 overflow-y-auto pr-0.5 max-lg:pb-2">
              <div className="grid gap-1 max-lg:gap-2 xl:grid-cols-[minmax(0,1fr)_192px]">
                <section className="overflow-hidden rounded-[18px] border border-slate-200/80 bg-white/80 p-1.5 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/45">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Datos base</p>
                    <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">Lo esencial para personalizar tu punto de partida.</p>
                  </div>
                  <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px]">
                    Perfil inicial
                  </Badge>
                </div>
                <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="min-w-0 overflow-hidden rounded-[15px] border border-slate-200/80 bg-slate-50/85 p-1.5 dark:border-slate-800/80 dark:bg-slate-900/75">
                    <Label htmlFor="profile-sex" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Sexo
                    </Label>
                    <Select value={form.sex || undefined} onValueChange={(value) => setForm((current) => ({ ...current, sex: value as "" | ProfileSex }))}>
                      <SelectTrigger
                        id="profile-sex"
                        className="mt-1 h-8 border-0 bg-transparent px-0 text-left text-[0.95rem] font-semibold tracking-tight text-slate-900 shadow-none focus:ring-0 focus:ring-offset-0 dark:text-white"
                      >
                        <SelectValue placeholder="Selecciona" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Hombre</SelectItem>
                        <SelectItem value="female">Mujer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {primaryMetrics.map((field) => (
                    <div key={field.id} className="min-w-0 overflow-hidden rounded-[15px] border border-slate-200/80 bg-slate-50/85 p-1.5 dark:border-slate-800/80 dark:bg-slate-900/75">
                      <Label htmlFor={field.id} className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        {field.label}
                      </Label>
                      <div className="mt-1 flex min-w-0 items-end justify-between gap-2">
                        <Input
                          id={field.id}
                          inputMode={field.inputMode}
                          value={field.value}
                          onChange={(event) => field.onChange(event.target.value)}
                          className="min-w-0 h-6 border-0 bg-transparent px-0 text-[1rem] font-semibold tracking-tight text-slate-900 shadow-none focus-visible:ring-0 dark:bg-transparent dark:text-white"
                        />
                        {field.suffix ? <span className="shrink-0 pb-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">{field.suffix}</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
                </section>

                <section className="overflow-hidden rounded-[18px] border border-orange-200/60 bg-[linear-gradient(180deg,rgba(255,247,237,0.92),rgba(255,237,213,0.68))] p-1.5 shadow-sm dark:border-orange-400/10 dark:bg-[linear-gradient(180deg,rgba(124,45,18,0.18),rgba(15,23,42,0.58))]">
                <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-orange-100">
                  <Target className="h-4 w-4 text-orange-500" />
                  Objetivo
                </div>
                <div className="grid gap-1 sm:grid-cols-2 md:grid-cols-3">
                  {objectiveMetrics.map((field) => (
                    <div key={field.id} className="min-w-0 overflow-hidden rounded-[15px] border border-white/70 bg-white/70 p-1.5 dark:border-white/5 dark:bg-slate-950/35">
                      <Label htmlFor={field.id} className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        {field.label}
                      </Label>
                      <div className="mt-1 flex min-w-0 items-end justify-between gap-2">
                        <Input
                          id={field.id}
                          inputMode={field.inputMode}
                          value={field.value}
                          onChange={(event) => field.onChange(event.target.value)}
                          className="min-w-0 h-6 border-0 bg-transparent px-0 text-[0.95rem] font-semibold tracking-tight text-slate-900 shadow-none focus-visible:ring-0 dark:bg-transparent dark:text-white"
                        />
                        {field.suffix ? <span className="shrink-0 pb-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">{field.suffix}</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
                </section>
              </div>

              <section className="mt-1 grid min-h-0 gap-1 pb-0 max-lg:gap-2 xl:grid-cols-[minmax(0,1fr)_192px]">
                <div className="overflow-hidden rounded-[18px] border border-slate-200/80 bg-white/80 p-1.5 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/45">
                <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  <CalendarClock className="h-4 w-4 text-orange-500" />
                  Plan sugerido
                </div>
                {recommendedPlan ? (
                  <div className="grid gap-1 lg:grid-cols-[minmax(0,1fr)_166px]">
                    <div className="min-w-0 overflow-hidden">
                      <p className="truncate text-[12px] font-semibold tracking-tight text-slate-900 dark:text-white">{recommendedPlan.title}</p>
                      <p className="mt-0.5 text-[10px] leading-4 text-slate-600 dark:text-slate-400">{recommendedPlan.summary}</p>
                      <div className="mt-1 grid gap-1 sm:grid-cols-2">
                        {weeklyPreview.map((day) => (
                          <div
                            key={day}
                            title={day}
                            className="truncate rounded-[11px] border border-slate-200/80 bg-slate-50/85 px-2 py-0.5 text-[10px] leading-3.5 text-slate-600 dark:border-slate-800/80 dark:bg-slate-900/75 dark:text-slate-300"
                          >
                            {day}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="grid content-start gap-1 self-start">
                      <div className="overflow-hidden rounded-[14px] border border-slate-200/80 bg-slate-50/85 p-2.5 dark:border-slate-800/80 dark:bg-slate-900/75">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Parámetros</p>
                        <div className="mt-1 space-y-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                          <p className="flex items-center gap-1 truncate" title={`${recommendedPlan.duration} min`}><Weight className="h-3 w-3 shrink-0 text-orange-500" /> <span className="truncate">{recommendedPlan.duration} min</span></p>
                          <p className="flex items-center gap-1 truncate" title={recommendedPlan.difficulty}><Ruler className="h-3 w-3 shrink-0 text-orange-500" /> <span className="truncate">{recommendedPlan.difficulty}</span></p>
                          <p className="flex items-center gap-1 truncate" title={recommendedPlan.workoutType}><Target className="h-3 w-3 shrink-0 text-orange-500" /> <span className="truncate">{recommendedPlan.workoutType}</span></p>
                        </div>
                      </div>
                      <Button asChild className="h-9 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 px-3 text-xs text-white hover:from-orange-600 hover:to-rose-600">
                        <Link href="/workouts/generate">Usar esta propuesta</Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-[88px] items-center rounded-[15px] border border-dashed border-orange-200/80 bg-orange-50/55 p-3 text-[11px] leading-4 text-slate-600 dark:border-orange-400/10 dark:bg-orange-500/5 dark:text-slate-400">
                    Completa peso actual, peso objetivo, plazo y días de entreno para generar una propuesta automática.
                  </div>
                )}
                </div>
              </section>
            </div>

            <div className="mt-2 rounded-[18px] border border-slate-200/80 bg-[linear-gradient(160deg,rgba(255,255,255,0.96),rgba(241,245,249,0.96))] p-3 shadow-sm dark:border-slate-800/80 dark:bg-[linear-gradient(160deg,rgba(15,23,42,0.95),rgba(30,41,59,0.86))] max-lg:sticky max-lg:bottom-0 max-lg:z-10 max-lg:-mx-1 max-lg:border-t max-lg:border-slate-200/80 max-lg:pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] dark:max-lg:border-slate-800/80">
                <div className="flex flex-col items-start justify-between gap-2 sm:flex-row">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Resumen</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-slate-600 dark:text-slate-400">
                      Ajusta tus métricas clave y guarda los cambios.
                    </p>
                  </div>
                  <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[10px]">
                    Perfil activo
                  </Badge>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="overflow-hidden rounded-[12px] bg-slate-50/85 p-2.5 dark:bg-slate-900/75">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Meta de peso</p>
                    <p className="mt-0.5 truncate text-[13px] font-semibold text-slate-900 dark:text-white">
                      {form.targetWeightKg || "--"} <span className="text-[12px] font-medium text-slate-400">kg</span>
                    </p>
                  </div>
                  <div className="overflow-hidden rounded-[12px] bg-slate-50/85 p-2.5 dark:bg-slate-900/75">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Frecuencia</p>
                    <p className="mt-0.5 truncate text-[13px] font-semibold text-slate-900 dark:text-white">
                      {form.trainingDaysPerWeek || "--"} <span className="text-[12px] font-medium text-slate-400">días/sem</span>
                    </p>
                  </div>
                </div>
                {saveError ? (
                  <p role="alert" className="mt-2.5 text-xs font-medium text-red-700 dark:text-red-300">
                    No se pudo guardar tu perfil. Inténtalo de nuevo.
                  </p>
                ) : null}
                <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
                  <Button variant="outline" className="h-9 flex-1 rounded-2xl px-3 text-xs" onClick={() => handleOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button
                    className="h-9 flex-1 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 px-3 text-xs text-white hover:from-orange-600 hover:to-rose-600"
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? "Guardando..." : "Guardar"}
                  </Button>
                </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
