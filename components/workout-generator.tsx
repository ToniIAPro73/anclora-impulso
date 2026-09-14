"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useWorkouts } from "@/hooks/use-workouts"
import { useRouter } from "next/navigation"
import { Loader2, Zap, Clock, Target, Dumbbell, Play, CheckCircle2 } from "lucide-react"
import type { Workout } from "@/lib/api"
import { useAuth } from "@/lib/contexts/auth-context"
import { useLanguage } from "@/lib/contexts/language-context"
import { buildRecommendedPlan, isProfileReadyForPlanGeneration } from "@/lib/user-profile"
import { trackProductEvent } from "@/lib/product-events"
import {
  MUSCLE_GROUPS,
  getDifficultyLabel,
  getEquipmentLabel,
  getMuscleGroupLabel,
  isEquipment,
  isMuscleGroup,
  type AppLanguage,
  type Equipment,
  type MuscleGroup,
} from "@/lib/workout-domain-labels"

type WorkoutType = 'strength' | 'cardio' | 'hiit' | 'flexibility' | 'full_body'
type WorkoutDifficulty = 'beginner' | 'intermediate' | 'advanced'
type TrainingEnvironment = 'gym' | 'home' | 'outdoor'

interface WorkoutPreferences {
  workoutType: WorkoutType
  duration: number
  difficulty: WorkoutDifficulty
  trainingEnvironment: TrainingEnvironment
  targetMuscles: MuscleGroup[]
  equipment: Equipment[]
  workoutName: string
}

const ENVIRONMENT_EQUIPMENT_MAP: Record<TrainingEnvironment, Equipment[]> = {
  gym: ['bodyweight', 'dumbbells', 'barbell', 'kettlebell', 'resistance_bands', 'pull_up_bar', 'cables', 'machine'],
  home: ['bodyweight', 'dumbbells', 'resistance_bands'],
  outdoor: ['bodyweight', 'jump_rope', 'pull_up_bar'],
}

export function WorkoutGenerator() {
  const { profile } = useAuth()
  const { language } = useLanguage()
  const isSpanish = language === "es"
  const labelLanguage: AppLanguage = isSpanish ? "es" : "en"
  const localizedRecommendedPlan = useMemo(() => buildRecommendedPlan(profile, isSpanish ? "es" : "en"), [profile, isSpanish])
  const [preferences, setPreferences] = useState<WorkoutPreferences>({
    workoutType: 'strength',
    duration: 45,
    difficulty: 'beginner',
    trainingEnvironment: 'gym',
    targetMuscles: [],
    equipment: ['bodyweight'],
    workoutName: '',
  })
  const [generatedWorkout, setGeneratedWorkout] = useState<Workout | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { workouts, generateWorkout, deleteWorkout, isDeleting } = useWorkouts()
  const router = useRouter()
  const isProfileReady = isProfileReadyForPlanGeneration(profile)

  useEffect(() => {
    if (!localizedRecommendedPlan) {
      return
    }

    setPreferences((current) => ({
      ...current,
      workoutType: localizedRecommendedPlan.workoutType ?? current.workoutType,
      duration: localizedRecommendedPlan.duration ?? current.duration,
      difficulty: localizedRecommendedPlan.difficulty ?? current.difficulty,
      targetMuscles: (localizedRecommendedPlan.targetMuscles ?? current.targetMuscles).filter(isMuscleGroup),
      equipment: (localizedRecommendedPlan.equipment ?? current.equipment).filter(isEquipment),
      workoutName: current.workoutName || localizedRecommendedPlan.title || current.workoutName,
    }))
  }, [localizedRecommendedPlan])

  const muscleGroups = MUSCLE_GROUPS
  const equipmentTypes = ENVIRONMENT_EQUIPMENT_MAP[preferences.trainingEnvironment]

  useEffect(() => {
    setPreferences((current) => ({
      ...current,
      equipment: current.equipment.filter((equipment) => ENVIRONMENT_EQUIPMENT_MAP[current.trainingEnvironment].includes(equipment)),
    }))
  }, [preferences.trainingEnvironment])

  const handleGenerateWorkout = async () => {
    if (!isProfileReady) {
      setError(isSpanish ? "Completa el onboarding antes de generar un entrenamiento." : "Complete onboarding before generating a workout.")
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const workout = await generateWorkout({
        workoutType: preferences.workoutType,
        duration: preferences.duration,
        difficulty: preferences.difficulty,
        trainingEnvironment: preferences.trainingEnvironment,
        targetMuscles: preferences.targetMuscles.length > 0 ? preferences.targetMuscles : undefined,
        equipment: preferences.equipment.length > 0 ? preferences.equipment : undefined,
        age: profile.age ?? undefined,
        sex: profile.sex ?? undefined,
      })

      // Si se proporcionó un nombre personalizado, actualizarlo
      if (preferences.workoutName) {
        // Aquí podrías hacer un update del workout si quieres
        workout.name = preferences.workoutName
      }

      setGeneratedWorkout(workout)
      await trackProductEvent({
        action: "workout_generated",
        category: "fitness",
        source: "workout_generator",
        metadata: {
          workoutId: workout.id,
          workoutType: preferences.workoutType,
          duration: preferences.duration,
          environment: preferences.trainingEnvironment,
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : isSpanish ? "Error al generar entrenamiento" : "Error generating workout")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleStartWorkout = () => {
    if (generatedWorkout) {
      router.push(`/workouts/${generatedWorkout.id}`)
    }
  }

  const handleGenerateAnother = () => {
    setGeneratedWorkout(null)
    setError(null)
  }

  const handleDiscardGenerated = async () => {
    if (!generatedWorkout) return
    await deleteWorkout(generatedWorkout.id)
    setGeneratedWorkout(null)
  }

  const handleDeleteWorkout = async (workoutId: string) => {
    const confirmed = window.confirm(
      isSpanish ? "¿Quieres eliminar este plan de entrenamiento?" : "Do you want to delete this workout plan?"
    )
    if (!confirmed) return

    await deleteWorkout(workoutId)

    if (generatedWorkout?.id === workoutId) {
      setGeneratedWorkout(null)
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {!isProfileReady ? (
        <Card className="border border-amber-200 bg-amber-50/90 shadow-sm dark:border-amber-500/20 dark:bg-amber-500/10">
          <CardContent className="pt-6">
            <h3 className="text-base font-semibold text-amber-900 dark:text-amber-100">
              {isSpanish ? "Completa tu onboarding antes de generar planes" : "Complete your onboarding before generating plans"}
            </h3>
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
              {isSpanish
                ? "Necesitamos objetivo, entorno, nivel, sexo, edad, altura, peso actual, peso objetivo, plazo y días de entrenamiento para ajustar bien el plan."
                : "We need goal, environment, level, sex, age, height, current weight, target weight, timeframe and training days to tailor the plan correctly."}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {workouts.length > 0 ? (
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm dark:bg-gray-800/80">
          <CardHeader>
            <CardTitle>{isSpanish ? "Planes de entrenamiento creados" : "Created workout plans"}</CardTitle>
            <CardDescription>
              {isSpanish ? "Puedes eliminar un plan para crear uno nuevo cuando lo necesites." : "You can remove a plan to create a new one whenever you need."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {workouts.slice(0, 5).map((workout) => (
              <div key={workout.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-700/60 dark:bg-slate-900/40 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900 dark:text-white">{workout.name}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {new Date(workout.createdAt).toLocaleDateString(isSpanish ? "es-ES" : "en-US")} · {workout.exercises.length} {isSpanish ? "ejercicios" : "exercises"}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button variant="outline" className="w-full sm:w-auto" onClick={() => router.push(`/workouts/${workout.id}`)}>
                    {isSpanish ? "Ver" : "View"}
                  </Button>
                  <Button variant="destructive" className="w-full sm:w-auto" onClick={() => handleDeleteWorkout(workout.id)} disabled={isDeleting}>
                    {isSpanish ? "Eliminar" : "Delete"}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {!generatedWorkout ? (
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm dark:bg-gray-800/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-orange-500" />
              {isSpanish ? "Preferencias del Entrenamiento" : "Workout Preferences"}
            </CardTitle>
            <CardDescription>{isSpanish ? "Personaliza tu entrenamiento según tus objetivos y equipo disponible" : "Customize your workout based on your goals and available equipment"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {localizedRecommendedPlan ? (
              <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/80 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                  {isSpanish ? "Propuesta cargada desde tu perfil" : "Proposal loaded from your profile"}
                </p>
                <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">{localizedRecommendedPlan.summary}</p>
              </div>
            ) : null}
            {profile.age && profile.age >= 40 ? (
              <div className="rounded-2xl border border-orange-200/70 bg-orange-50/80 p-4 text-sm text-orange-800 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-200">
                {isSpanish
                  ? `Este entrenamiento se ajustará con criterios 40+: más prioridad a fuerza, movilidad, recuperación y composición corporal${profile.sex ? ` para ${profile.sex === "female" ? "mujer" : "hombre"}` : ""}.`
                  : `This workout will use 40+ rules: more emphasis on strength, mobility, recovery and body composition${profile.sex ? ` for a ${profile.sex === "female" ? "female" : "male"} profile` : ""}.`}
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
              <div className="space-y-2">
                <Label>{isSpanish ? "Nombre del Entrenamiento (Opcional)" : "Workout Name (Optional)"}</Label>
                <Input
                  placeholder={isSpanish ? "ej., Sesión de Fuerza Matutina" : "e.g., Morning Strength Session"}
                  value={preferences.workoutName}
                  onChange={(e) => setPreferences({ ...preferences, workoutName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{isSpanish ? "Tipo de Entrenamiento" : "Workout Type"}</Label>
                <Select
                  value={preferences.workoutType}
                  onValueChange={(value: WorkoutType) => setPreferences({ ...preferences, workoutType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strength">{isSpanish ? "Fuerza" : "Strength"}</SelectItem>
                    <SelectItem value="cardio">Cardio</SelectItem>
                    <SelectItem value="hiit">HIIT</SelectItem>
                    <SelectItem value="flexibility">{isSpanish ? "Flexibilidad" : "Flexibility"}</SelectItem>
                    <SelectItem value="full_body">{isSpanish ? "Cuerpo Completo" : "Full Body"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{isSpanish ? "Duración (minutos)" : "Duration (minutes)"}</Label>
                <Select
                  value={preferences.duration.toString()}
                  onValueChange={(value) => setPreferences({ ...preferences, duration: Number.parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">{isSpanish ? "20 minutos" : "20 minutes"}</SelectItem>
                    <SelectItem value="30">{isSpanish ? "30 minutos" : "30 minutes"}</SelectItem>
                    <SelectItem value="45">{isSpanish ? "45 minutos" : "45 minutes"}</SelectItem>
                    <SelectItem value="60">{isSpanish ? "60 minutos" : "60 minutes"}</SelectItem>
                    <SelectItem value="90">{isSpanish ? "90 minutos" : "90 minutes"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{isSpanish ? "Nivel de Dificultad" : "Difficulty Level"}</Label>
                <Select
                  value={preferences.difficulty}
                  onValueChange={(value: WorkoutDifficulty) => setPreferences({ ...preferences, difficulty: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">{isSpanish ? "Principiante" : "Beginner"}</SelectItem>
                    <SelectItem value="intermediate">{isSpanish ? "Intermedio" : "Intermediate"}</SelectItem>
                    <SelectItem value="advanced">{isSpanish ? "Avanzado" : "Advanced"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{isSpanish ? "Entorno de entrenamiento" : "Training environment"}</Label>
                <Select
                  value={preferences.trainingEnvironment}
                  onValueChange={(value: WorkoutPreferences["trainingEnvironment"]) =>
                    setPreferences({ ...preferences, trainingEnvironment: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gym">{isSpanish ? "Gimnasio" : "Gym"}</SelectItem>
                    <SelectItem value="home">{isSpanish ? "Casa" : "Home"}</SelectItem>
                    <SelectItem value="outdoor">{isSpanish ? "Aire libre" : "Outdoor"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <Label>{isSpanish ? "Grupos Musculares Objetivo (Opcional)" : "Target Muscle Groups (Optional)"}</Label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                {muscleGroups.map((muscle) => (
                  <div key={muscle} className="flex items-center space-x-2">
                    <Checkbox
                      id={muscle}
                      checked={preferences.targetMuscles.includes(muscle)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setPreferences({
                            ...preferences,
                            targetMuscles: [...preferences.targetMuscles, muscle],
                          })
                        } else {
                          setPreferences({
                            ...preferences,
                            targetMuscles: preferences.targetMuscles.filter((m) => m !== muscle),
                          })
                        }
                      }}
                    />
                    <label
                      htmlFor={muscle}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize cursor-pointer"
                    >
                      {getMuscleGroupLabel(labelLanguage, muscle)}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label>{isSpanish ? "Equipo Disponible" : "Available Equipment"}</Label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {preferences.trainingEnvironment === 'home'
                  ? isSpanish
                    ? "Equipamiento mínimo doméstico: peso corporal, mancuernas y bandas."
                    : "Minimal home setup: bodyweight, dumbbells and bands."
                  : preferences.trainingEnvironment === 'outdoor'
                    ? isSpanish
                      ? "Opciones compatibles con sesiones en parque o al aire libre."
                      : "Options that fit park or outdoor sessions."
                    : isSpanish
                      ? "Incluye equipamiento propio de sala de musculación."
                      : "Includes standard gym-floor equipment."}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                {equipmentTypes.map((equipment) => (
                  <div key={equipment} className="flex items-center space-x-2">
                    <Checkbox
                      id={equipment}
                      checked={preferences.equipment.includes(equipment)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setPreferences({
                            ...preferences,
                            equipment: [...preferences.equipment, equipment],
                          })
                        } else {
                          setPreferences({
                            ...preferences,
                            equipment: preferences.equipment.filter((e) => e !== equipment),
                          })
                        }
                      }}
                    />
                    <label
                      htmlFor={equipment}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize cursor-pointer"
                    >
                      {getEquipmentLabel(labelLanguage, equipment)}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <Button
              onClick={handleGenerateWorkout}
              disabled={isGenerating || !isProfileReady}
              className="w-full bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isSpanish ? "Generando Entrenamiento..." : "Generating Workout..."}
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  {isSpanish ? "Generar Entrenamiento con IA" : "Generate AI Workout"}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Success Message */}
          <Card className="border-0 shadow-lg bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                <div>
                  <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">
                    {isSpanish ? "¡Entrenamiento Generado!" : "Workout Generated!"}
                  </h3>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    {isSpanish ? "Tu entrenamiento personalizado está listo para comenzar" : "Your personalized workout is ready to start"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Generated Workout */}
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm dark:bg-gray-800/80">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <CardTitle className="text-2xl">{generatedWorkout.name}</CardTitle>
                  <CardDescription className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {preferences.duration} min
                    </span>
                    <span className="flex items-center gap-1">
                      <Target className="w-4 h-4" />
                      {getDifficultyLabel(labelLanguage, preferences.difficulty)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Dumbbell className="w-4 h-4" />
                      {generatedWorkout.exercises.length} {isSpanish ? "ejercicios" : "exercises"}
                    </span>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-orange-200/70 bg-orange-50/70 p-4 dark:border-orange-400/10 dark:bg-orange-950/20">
                <p className="text-sm font-semibold text-orange-900 dark:text-orange-200">{isSpanish ? "Por qué aparece esta propuesta" : "Why this proposal appeared"}</p>
                <p className="mt-1 text-sm text-orange-800 dark:text-orange-300">{isSpanish ? "La IA usa tu perfil y las preferencias que acabas de revisar. Puedes regenerar o descartar antes de empezar." : "The AI uses your profile and the preferences you just reviewed. You can regenerate or discard before starting."}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-orange-900 dark:text-orange-200">
                  <Badge variant="outline">{profile.age ? `${isSpanish ? "Edad" : "Age"}: ${profile.age}` : (isSpanish ? "Edad no indicada" : "Age not provided")}</Badge>
                  <Badge variant="outline">{preferences.duration} min</Badge>
                  <Badge variant="outline">{getDifficultyLabel(labelLanguage, preferences.difficulty)}</Badge>
                  <Badge variant="outline">{preferences.trainingEnvironment}</Badge>
                </div>
              </div>
              {generatedWorkout.exercises.map((workoutExercise, index) => (
                <div key={workoutExercise.id} className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-semibold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg">{workoutExercise.exercise.name}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {workoutExercise.exercise.description}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Badge variant="secondary">
                          {workoutExercise.sets} series × {workoutExercise.reps} reps
                        </Badge>
                        <Badge variant="outline">{isSpanish ? "Descanso" : "Rest"}: {workoutExercise.rest}s</Badge>
                        <Badge variant="outline" className="capitalize">
                          {getMuscleGroupLabel(labelLanguage, workoutExercise.exercise.muscleGroup)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <Separator className="my-6" />

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  onClick={handleStartWorkout}
                  className="w-full bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 sm:flex-1"
                  size="lg"
                >
                  <Play className="w-4 h-4 mr-2" />
                  {isSpanish ? "Comenzar Entrenamiento" : "Start Workout"}
                </Button>
                <Button onClick={handleGenerateAnother} variant="outline" size="lg" className="w-full sm:w-auto">
                  {isSpanish ? "Generar Otro" : "Generate Another"}
                </Button>
                <Button onClick={() => void handleDiscardGenerated()} variant="ghost" size="lg" className="w-full sm:w-auto" disabled={isDeleting}>
                  {isSpanish ? "Descartar propuesta" : "Discard proposal"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
