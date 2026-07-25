"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Clock, Dumbbell, Loader2, Play, Target } from "lucide-react"

import { ProtectedDashboardPage } from "@/components/protected-dashboard-page"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { workoutsApi } from "@/lib/api"
import { useLanguage } from "@/lib/contexts/language-context"
import { getLocalizedExerciseCopy } from "@/lib/localized-exercise-copy"
import { getMuscleGroupLabel, type AppLanguage } from "@/lib/workout-domain-labels"
import { useWorkouts } from "@/hooks/use-workouts"

function WorkoutDetailContent() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { language, t } = useLanguage()
  const isSpanish = language === "es"
  const labelLanguage: AppLanguage = isSpanish ? "es" : "en"

  const workoutId = typeof params?.id === "string" ? params.id : ""

  const {
    data: workout,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["workout", workoutId],
    queryFn: () => workoutsApi.getById(workoutId),
    enabled: Boolean(workoutId),
    staleTime: 5 * 60 * 1000,
  })
  const { deleteWorkout, isDeleting } = useWorkouts()

  const handleDeleteWorkout = async () => {
    const confirmed = window.confirm(
      isSpanish ? "¿Quieres eliminar este plan de entrenamiento?" : "Do you want to delete this workout plan?"
    )
    if (!confirmed) return

    await deleteWorkout(workoutId)
    router.push("/workouts/generate")
  }

  if (isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-orange-500" />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {isSpanish ? "Cargando entrenamiento..." : "Loading workout..."}
          </p>
        </div>
      </div>
    )
  }

  if (error || !workout) {
    return (
      <div className="p-6">
        <Card className="border-0 bg-white/80 shadow-lg backdrop-blur-sm dark:bg-gray-800/80">
          <CardContent className="flex min-h-[320px] flex-col items-center justify-center gap-4 text-center">
            <div className="rounded-full bg-red-100 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
              <Target className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                {isSpanish ? "No se pudo cargar el entrenamiento" : "Unable to load workout"}
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {isSpanish
                  ? "El entrenamiento no existe o ya no está disponible."
                  : "The workout does not exist or is no longer available."}
              </p>
            </div>
            <Button onClick={() => router.push("/workouts/generate")} className="rounded-2xl">
              {isSpanish ? "Volver al generador" : "Back to generator"}
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
          <Button variant="ghost" size="sm" className="mb-2 -ml-3 rounded-2xl" onClick={() => router.push("/workouts/generate")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {isSpanish ? "Volver" : "Back"}
          </Button>
          <h1 className="truncate text-2xl font-semibold text-slate-900 dark:text-white">{workout.name}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {isSpanish
              ? "Tu entrenamiento está listo. Revisa los ejercicios antes de empezar."
              : "Your workout is ready. Review the exercises before you start."}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Badge variant="secondary" className="rounded-xl px-3 py-1">
            <Dumbbell className="mr-2 h-3.5 w-3.5" />
            {workout.exercises.length} {isSpanish ? "ejercicios" : "exercises"}
          </Badge>
          <Button variant="destructive" onClick={handleDeleteWorkout} disabled={isDeleting} className="w-full rounded-2xl sm:w-auto">
            {isSpanish ? "Eliminar plan" : "Delete plan"}
          </Button>
          <Button onClick={() => router.push(`/workouts/${workout.id}/start`)} className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 sm:w-auto">
            <Play className="mr-2 h-4 w-4" />
            {isSpanish ? "Empezar entrenamiento" : "Start workout"}
          </Button>
        </div>
      </div>

      <Card className="border-0 bg-white/80 shadow-lg backdrop-blur-sm dark:bg-gray-800/80">
        <CardHeader className="pb-3">
          <CardTitle>{isSpanish ? "Rutina generada" : "Generated routine"}</CardTitle>
          <CardDescription>
            {isSpanish
              ? "Orden recomendado, repeticiones y descansos."
              : "Recommended order, repetitions, and rest times."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {workout.explanation ? (
            <div className="rounded-3xl border border-orange-200/70 bg-gradient-to-r from-orange-50 to-rose-50 p-4 dark:border-orange-500/20 dark:from-orange-950/20 dark:to-rose-950/20">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600 dark:text-orange-300">
                    {t.workouts.recommendationWhy}
                  </p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {workout.explanation.summary || t.workouts.recommendationSummary}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {workout.explanation.focusMuscles?.length ? (
                    <Badge variant="secondary" className="rounded-xl px-3 py-1">
                      {t.workouts.focusMuscles}: {workout.explanation.focusMuscles.join(", ")}
                    </Badge>
                  ) : null}
                  {typeof workout.explanation.averageRest === "number" ? (
                    <Badge variant="outline" className="rounded-xl px-3 py-1">
                      {t.workouts.averageRest}: {workout.explanation.averageRest}s
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                {workout.explanation.reasons.map((reason) => (
                  <div
                    key={reason}
                    className="rounded-2xl border border-orange-100 bg-white/80 px-3 py-2 text-sm text-slate-700 dark:border-orange-500/10 dark:bg-slate-950/40 dark:text-slate-200"
                  >
                    {reason}
                  </div>
                ))}
              </div>
              {workout.explanation.signals?.length ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {workout.explanation.signals.map((signal) => (
                    <div key={`${signal.label}-${signal.value}`} className="rounded-2xl border border-orange-100 bg-white/80 px-3 py-3 text-sm text-slate-700 dark:border-orange-500/10 dark:bg-slate-950/40 dark:text-slate-200">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{signal.label}</p>
                      <p className="mt-2 font-semibold">{signal.value}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              {workout.explanation.nextBestAction ? (
                <div className="mt-4">
                  <Button asChild className="rounded-2xl bg-gradient-to-r from-orange-500 to-pink-500 text-white hover:from-orange-600 hover:to-pink-600">
                    <Link href={workout.explanation.nextBestAction.href}>{workout.explanation.nextBestAction.label}</Link>
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
          {workout.exercises.map((workoutExercise, index) => {
            const localizedExercise = getLocalizedExerciseCopy(workoutExercise.exercise, labelLanguage)

            return (
            <div
              key={workoutExercise.id}
              className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-700/60 dark:bg-slate-900/40"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-sm font-semibold text-white">
                  {index + 1}
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    {localizedExercise.name}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {localizedExercise.description}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="secondary" className="rounded-xl px-3 py-1">
                      {workoutExercise.sets} {isSpanish ? "series" : "sets"} x {workoutExercise.reps} {isSpanish ? "reps" : "reps"}
                    </Badge>
                    <Badge variant="outline" className="rounded-xl px-3 py-1">
                      <Clock className="mr-2 h-3.5 w-3.5" />
                      {workoutExercise.rest}s {isSpanish ? "descanso" : "rest"}
                    </Badge>
                    <Badge variant="outline" className="rounded-xl px-3 py-1 capitalize">
                      {getMuscleGroupLabel(labelLanguage, workoutExercise.exercise.muscleGroup)}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

export default function WorkoutDetailPage() {
  return (
    <ProtectedDashboardPage>
      <WorkoutDetailContent />
    </ProtectedDashboardPage>
  )
}
