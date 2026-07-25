"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, CheckCircle2, Clock3, Dumbbell, Loader2, PauseCircle, PlayCircle, Save, TimerReset } from "lucide-react"

import { ProtectedDashboardPage } from "@/components/protected-dashboard-page"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { sessionsApi, workoutsApi } from "@/lib/api"
import { useLanguage } from "@/lib/contexts/language-context"
import { useAuth } from "@/lib/contexts/auth-context"
import { getLocalizedExerciseCopy } from "@/lib/localized-exercise-copy"
import type { AppLanguage } from "@/lib/workout-domain-labels"
import { trackProductEvent } from "@/lib/product-events"

type ExerciseSetState = {
  reps: string
  weight: string
  rir: string
  rpe: string
  restSeconds: string
  completed: boolean
}

type WorkoutDraft = {
  startedAt: string
  notes: string
  sets: Record<string, ExerciseSetState[]>
}

function ActiveWorkoutPageContent() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { language } = useLanguage()
  const { user } = useAuth()
  const isSpanish = language === "es"
  const labelLanguage: AppLanguage = isSpanish ? "es" : "en"
  const workoutId = typeof params?.id === "string" ? params.id : ""
  const [notes, setNotes] = useState("")
  const [setState, setSetState] = useState<Record<string, ExerciseSetState[]>>({})
  const [startedAt, setStartedAt] = useState<string>(new Date().toISOString())
  const [isSaving, setIsSaving] = useState(false)
  const [restSeconds, setRestSeconds] = useState(0)
  const [currentRestLabel, setCurrentRestLabel] = useState("")

  const { data: workout, isLoading, error } = useQuery({
    queryKey: ["workout", workoutId],
    queryFn: () => workoutsApi.getById(workoutId),
    enabled: Boolean(workoutId),
    staleTime: 5 * 60 * 1000,
  })

  const draftKey = user ? `anclora-active-workout:${user.id}:${workoutId}` : null

  useEffect(() => {
    if (!draftKey || !workout) return

    const storedDraft = window.localStorage.getItem(draftKey)
    if (storedDraft) {
      try {
        const draft = JSON.parse(storedDraft) as WorkoutDraft
        setNotes(draft.notes)
        setSetState(draft.sets)
        setStartedAt(draft.startedAt)
        return
      } catch {
        window.localStorage.removeItem(draftKey)
      }
    }

    const initialSets = Object.fromEntries(
      workout.exercises.map((exercise) => [
        exercise.exerciseId,
        Array.from({ length: exercise.sets }, () => ({
          reps: String(exercise.reps),
          weight: "",
          rir: "",
          rpe: "",
          restSeconds: String(exercise.rest),
          completed: false,
        })),
      ]),
    )
    setSetState(initialSets)
    setNotes("")
    setStartedAt(new Date().toISOString())
  }, [draftKey, workout])

  useEffect(() => {
    if (!workout) return

    void trackProductEvent({
      action: "workout_started",
      category: "fitness",
      source: "active_workout",
      metadata: {
        workoutId: workout.id,
        exerciseCount: workout.exercises.length,
      },
    })
  }, [workout])

  useEffect(() => {
    if (!draftKey || !workout || Object.keys(setState).length === 0) return
    const draft: WorkoutDraft = {
      startedAt,
      notes,
      sets: setState,
    }
    window.localStorage.setItem(draftKey, JSON.stringify(draft))
  }, [draftKey, notes, setState, startedAt, workout])

  useEffect(() => {
    if (restSeconds <= 0) return
    const interval = window.setInterval(() => {
      setRestSeconds((current) => Math.max(0, current - 1))
    }, 1000)
    return () => window.clearInterval(interval)
  }, [restSeconds])

  const completedSets = useMemo(
    () => Object.values(setState).flat().filter((entry) => entry.completed).length,
    [setState],
  )
  const totalSets = useMemo(() => Object.values(setState).flat().length, [setState])
  const completionRate = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0
  const elapsedSeconds = Math.max(60, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000))

  const updateSet = (exerciseId: string, setIndex: number, nextState: Partial<ExerciseSetState>) => {
    setSetState((current) => ({
      ...current,
      [exerciseId]: current[exerciseId].map((set, index) =>
        index === setIndex ? { ...set, ...nextState } : set,
      ),
    }))
  }

  const startRest = (seconds: number, label: string) => {
    setRestSeconds(seconds)
    setCurrentRestLabel(label)
  }

  const handleFinish = async () => {
    if (!workout) return
    setIsSaving(true)
    try {
      await sessionsApi.create({
        workoutId: workout.id,
        duration: elapsedSeconds,
        notes: notes || undefined,
        exercises: workout.exercises.map((exercise) => ({
          exerciseId: exercise.exerciseId,
          sets: (setState[exercise.exerciseId] ?? []).map((set, index) => ({
            reps: Number(set.reps) || exercise.reps,
            weight: Number(set.weight) || 0,
            rir: set.rir ? Number(set.rir) : undefined,
            rpe: set.rpe ? Number(set.rpe) : undefined,
            restSeconds: set.restSeconds ? Number(set.restSeconds) : exercise.rest,
            order: index,
          })),
        })),
      })

      if (draftKey) {
        window.localStorage.removeItem(draftKey)
      }

      await trackProductEvent({
        action: "workout_completed",
        category: "fitness",
        source: "active_workout",
        metadata: {
          workoutId: workout.id,
          duration: elapsedSeconds,
          completionRate,
        },
      })

      router.push("/progress")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
      </div>
    )
  }

  if (error || !workout) {
    return (
      <div className="p-6">
        <Card className="border-0 bg-white/80 shadow-lg backdrop-blur-sm dark:bg-gray-800/80">
          <CardContent className="flex min-h-[280px] flex-col items-center justify-center gap-4">
            <Dumbbell className="h-12 w-12 text-orange-500" />
            <p className="text-center text-slate-600 dark:text-slate-400">
              {isSpanish ? "No se pudo cargar la sesión activa." : "Unable to load the active session."}
            </p>
            <Button onClick={() => router.push("/workouts/generate")}>
              {isSpanish ? "Volver" : "Back"}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 px-3 py-4 sm:px-5 sm:py-5 lg:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <Button variant="ghost" size="sm" className="mb-2 -ml-3 rounded-2xl" onClick={() => router.push(`/workouts/${workout.id}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {isSpanish ? "Volver al plan" : "Back to plan"}
          </Button>
          <h1 className="text-2xl font-semibold leading-tight text-slate-900 dark:text-white">{workout.name}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {isSpanish ? "Modo activo con guardado parcial automático." : "Active mode with automatic partial save."}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Badge variant="secondary" className="rounded-xl px-3 py-1">
            <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
            {completedSets}/{totalSets} {isSpanish ? "series" : "sets"}
          </Badge>
          <Badge variant="outline" className="rounded-xl px-3 py-1">
            <Clock3 className="mr-2 h-3.5 w-3.5" />
            {Math.round(elapsedSeconds / 60)} min
          </Badge>
        </div>
      </div>

      <Card className="border-0 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-white shadow-xl">
        <CardContent className="grid gap-4 px-4 py-4 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              {isSpanish ? "Progreso de la sesión" : "Session progress"}
            </p>
            <p className="mt-2 text-3xl font-semibold">{completionRate}%</p>
            <Progress value={completionRate} className="mt-3 h-2.5 bg-white/10" />
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {isSpanish ? "Descanso" : "Rest"}
                </p>
                <p className="mt-2 text-3xl font-semibold">{restSeconds}s</p>
                <p className="mt-1 text-xs text-slate-300">{currentRestLabel || (isSpanish ? "Listo para el siguiente bloque." : "Ready for the next block.")}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="icon" className="rounded-full bg-white/12 text-white hover:bg-white/18" onClick={() => setRestSeconds((current) => (current > 0 ? 0 : 60))}>
                  {restSeconds > 0 ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                </Button>
                <Button variant="secondary" size="icon" className="rounded-full bg-white/12 text-white hover:bg-white/18" onClick={() => setRestSeconds(0)}>
                  <TimerReset className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {workout.exercises.map((workoutExercise, exerciseIndex) => {
          const localizedExercise = getLocalizedExerciseCopy(workoutExercise.exercise, labelLanguage)

          return (
          <Card key={workoutExercise.id} className="border-0 bg-white/80 shadow-lg backdrop-blur-sm dark:bg-gray-800/80">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-sm font-semibold text-white">
                      {exerciseIndex + 1}
                    </span>
                    <span>{localizedExercise.name}</span>
                  </CardTitle>
                  <CardDescription className="mt-2">
                    {localizedExercise.description}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="rounded-xl px-3 py-1">
                  {workoutExercise.sets} x {workoutExercise.reps} · {workoutExercise.rest}s
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {(setState[workoutExercise.exerciseId] ?? []).map((set, setIndex) => (
                <div key={`${workoutExercise.exerciseId}-${setIndex}`} className="grid gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-slate-700/60 dark:bg-slate-900/30 xl:grid-cols-[auto_minmax(0,1fr)_100px_120px_90px_90px_110px_auto_auto] xl:items-center">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {isSpanish ? `Serie ${setIndex + 1}` : `Set ${setIndex + 1}`}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {isSpanish ? `Objetivo: ${workoutExercise.reps} reps` : `Target: ${workoutExercise.reps} reps`}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{isSpanish ? "Reps" : "Reps"}</Label>
                    <Input value={set.reps} inputMode="numeric" onChange={(event) => updateSet(workoutExercise.exerciseId, setIndex, { reps: event.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{isSpanish ? "Peso (kg)" : "Weight (kg)"}</Label>
                    <Input value={set.weight} inputMode="decimal" onChange={(event) => updateSet(workoutExercise.exerciseId, setIndex, { weight: event.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">RIR</Label>
                    <Input value={set.rir ?? ""} inputMode="numeric" placeholder="0-5" onChange={(event) => updateSet(workoutExercise.exerciseId, setIndex, { rir: event.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">RPE</Label>
                    <Input value={set.rpe ?? ""} inputMode="decimal" placeholder="0-10" onChange={(event) => updateSet(workoutExercise.exerciseId, setIndex, { rpe: event.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{isSpanish ? "Desc. (s)" : "Rest (s)"}</Label>
                    <Input value={set.restSeconds ?? String(workoutExercise.rest)} inputMode="numeric" onChange={(event) => updateSet(workoutExercise.exerciseId, setIndex, { restSeconds: event.target.value })} />
                  </div>
                  <Button variant={set.completed ? "default" : "outline"} className="rounded-2xl" onClick={() => updateSet(workoutExercise.exerciseId, setIndex, { completed: !set.completed })}>
                    {set.completed ? (isSpanish ? "Hecha" : "Done") : (isSpanish ? "Marcar" : "Mark")}
                  </Button>
                  <Button variant="ghost" className="rounded-2xl" onClick={() => startRest(Number(set.restSeconds) || workoutExercise.rest, `${localizedExercise.name} · ${isSpanish ? "serie" : "set"} ${setIndex + 1}`)}>
                    {isSpanish ? "Descanso" : "Rest"}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
          )
        })}
      </div>

      <Card className="border-0 bg-white/80 shadow-lg backdrop-blur-sm dark:bg-gray-800/80">
        <CardHeader>
          <CardTitle>{isSpanish ? "Notas de la sesión" : "Session notes"}</CardTitle>
          <CardDescription>
            {isSpanish ? "Se guardan junto con la sesión completada." : "These are saved alongside the completed session."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={isSpanish ? "Sensaciones, cargas, molestias, observaciones..." : "Feelings, loads, pain points, observations..."} />
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => router.push(`/workouts/${workout.id}`)}>
              <Save className="mr-2 h-4 w-4" />
              {isSpanish ? "Salir y mantener borrador" : "Exit and keep draft"}
            </Button>
            <Button disabled={isSaving} className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600" onClick={handleFinish}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              {isSpanish ? "Finalizar y registrar" : "Finish and log"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function ActiveWorkoutPage() {
  return (
    <ProtectedDashboardPage>
      <ActiveWorkoutPageContent />
    </ProtectedDashboardPage>
  )
}
