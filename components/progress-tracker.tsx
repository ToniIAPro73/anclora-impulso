"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useProgress } from "@/hooks/use-progress"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts"
import { TrendingUp, TrendingDown, Calendar, Trophy, Target, Plus, Scale, Ruler, Activity, Clock, Loader2, Flame, BrainCircuit, DumbbellIcon } from "lucide-react"
import { useLanguage } from "@/lib/contexts/language-context"

export function ProgressTracker() {
  const { language } = useLanguage()
  const isSpanish = language === "es"
  const { progress, isLoading, error, addMeasurement } = useProgress()
  const [newMeasurement, setNewMeasurement] = useState({
    weight: "",
    bodyFat: "",
    chest: "",
    waist: "",
    hips: "",
    arms: "",
    thighs: "",
  })
  const [isAddingMeasurement, setIsAddingMeasurement] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handleAddMeasurement = async () => {
    setIsAddingMeasurement(true)

    try {
      await addMeasurement({
        weight: newMeasurement.weight ? parseFloat(newMeasurement.weight) : undefined,
        bodyFat: newMeasurement.bodyFat ? parseFloat(newMeasurement.bodyFat) : undefined,
        chest: newMeasurement.chest ? parseFloat(newMeasurement.chest) : undefined,
        waist: newMeasurement.waist ? parseFloat(newMeasurement.waist) : undefined,
        hips: newMeasurement.hips ? parseFloat(newMeasurement.hips) : undefined,
        arms: newMeasurement.arms ? parseFloat(newMeasurement.arms) : undefined,
        thighs: newMeasurement.thighs ? parseFloat(newMeasurement.thighs) : undefined,
      })

      // Reset form
      setNewMeasurement({
        weight: "",
        bodyFat: "",
        chest: "",
        waist: "",
        hips: "",
        arms: "",
        thighs: "",
      })
      setIsDialogOpen(false)
    } catch (error) {
      console.error("Error adding measurement:", error)
      alert(isSpanish ? "Error al agregar la medida" : "Error adding measurement")
    } finally {
      setIsAddingMeasurement(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">{isSpanish ? "Cargando progreso..." : "Loading progress..."}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm dark:bg-gray-800/80">
        <CardContent className="text-center py-12">
          <Activity className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {isSpanish ? "Error al cargar el progreso" : "Error loading progress"}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>{isSpanish ? "Reintentar" : "Retry"}</Button>
        </CardContent>
      </Card>
    )
  }

  if (!progress) {
    return null
  }

  const { stats, strength, measurements, charts, insights } = progress
  const topRecord = strength.personalRecords[0]
  const topMuscleVolume = strength.muscleVolume[0]

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-50 to-pink-50 dark:from-orange-900/20 dark:to-pink-900/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {isSpanish ? "Entrenamientos Totales" : "Total Workouts"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalWorkouts}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {stats.workoutsThisWeek} {isSpanish ? "esta semana" : "this week"}
                </p>
              </div>
              <Trophy className="w-12 h-12 text-orange-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {isSpanish ? "Este Mes" : "This Month"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.workoutsThisMonth}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{isSpanish ? "entrenamientos" : "workouts"}</p>
              </div>
              <Calendar className="w-12 h-12 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {isSpanish ? "Tiempo Total" : "Total Time"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {Math.round(stats.totalDuration / 60)}h
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  ~{Math.round(stats.avgDuration / 60)}h {isSpanish ? "de promedio" : "average"}
                </p>
              </div>
              <Clock className="w-12 h-12 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {isSpanish ? "Récords Personales" : "Personal Records"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.personalRecords.length}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{isSpanish ? "ejercicios" : "exercises"}</p>
              </div>
              <Target className="w-12 h-12 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm dark:bg-gray-800/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DumbbellIcon className="h-5 w-5 text-orange-500" />
            {isSpanish ? "Tracking avanzado de fuerza" : "Advanced strength tracking"}
          </CardTitle>
          <CardDescription>
            {isSpanish ? "Volumen, récords y carga efectiva desde las series registradas." : "Volume, records and effective load from logged sets."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-slate-50/90 p-4 dark:bg-slate-900/50">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{isSpanish ? "Volumen total" : "Total volume"}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{Math.round(strength.totalVolume)} kg</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{isSpanish ? "Últimas sesiones registradas" : "Latest logged sessions"}</p>
          </div>
          <div className="rounded-2xl bg-slate-50/90 p-4 dark:bg-slate-900/50">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{isSpanish ? "Mejor PR" : "Best PR"}</p>
            <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{topRecord?.exerciseName ?? "--"}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {topRecord ? `${topRecord.maxWeight} kg · e1RM ${topRecord.bestEstimatedOneRepMax} kg` : isSpanish ? "Sin registros todavía" : "No records yet"}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50/90 p-4 dark:bg-slate-900/50">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{isSpanish ? "Grupo dominante" : "Top muscle group"}</p>
            <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{topMuscleVolume?.muscleGroup ?? "--"}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {topMuscleVolume ? `${Math.round(topMuscleVolume.totalVolume)} kg · ${topMuscleVolume.setCount} sets` : isSpanish ? "Sin volumen acumulado" : "No accumulated volume"}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <Card className="border-0 shadow-lg bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BrainCircuit className="h-5 w-5 text-orange-400" />
              {isSpanish ? "Resumen de progreso" : "Progress summary"}
            </CardTitle>
            <CardDescription className="text-slate-300">
              {isSpanish
                ? "Señales de adherencia, tendencia y recomendación operativa."
                : "Adherence, trend and next-step guidance."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                {isSpanish ? "Adherencia semanal" : "Weekly adherence"}
              </p>
              <p className="mt-2 text-3xl font-semibold">
                {insights.adherenceRate !== null ? `${Math.round(insights.adherenceRate * 100)}%` : "--"}
              </p>
              <p className="mt-2 text-sm text-slate-300">
                {insights.weeklyTarget
                  ? `${insights.workoutsLast7Days}/${insights.weeklyTarget} ${isSpanish ? "sesiones" : "sessions"}`
                  : isSpanish ? "Define un objetivo semanal en onboarding." : "Set a weekly target in onboarding."}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                {isSpanish ? "Tendencia de peso" : "Weight trend"}
              </p>
              <p className="mt-2 text-3xl font-semibold">
                {insights.weightTrend.deltaKg !== null ? `${insights.weightTrend.deltaKg > 0 ? "+" : ""}${insights.weightTrend.deltaKg} kg` : "--"}
              </p>
              <p className="mt-2 text-sm text-slate-300">
                {insights.weightTrend.direction === "down"
                  ? isSpanish ? "La tendencia reciente va hacia abajo." : "Recent trend is moving down."
                  : insights.weightTrend.direction === "up"
                    ? isSpanish ? "La tendencia reciente va hacia arriba." : "Recent trend is moving up."
                    : insights.weightTrend.direction === "stable"
                      ? isSpanish ? "La tendencia reciente está estable." : "Recent trend is stable."
                      : isSpanish ? "Aún faltan datos recientes." : "You still need more recent data."}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                {isSpanish ? "Riesgo de estancamiento" : "Stagnation risk"}
              </p>
              <p className="mt-2 text-3xl font-semibold">
                {insights.stagnationRisk === "high" ? (isSpanish ? "Alto" : "High") : insights.stagnationRisk === "medium" ? (isSpanish ? "Medio" : "Medium") : (isSpanish ? "Bajo" : "Low")}
              </p>
              <p className="mt-2 text-sm text-slate-300">
                {insights.stagnationRisk === "high"
                  ? isSpanish ? "Conviene simplificar o ajustar volumen y nutrición." : "It is worth simplifying or adjusting volume and nutrition."
                  : isSpanish ? "La señal actual no apunta a bloqueo fuerte." : "Current signals do not show a strong plateau."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm dark:bg-gray-800/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              {isSpanish ? "Acción recomendada" : "Recommended action"}
            </CardTitle>
            <CardDescription>
              {isSpanish ? "Lo siguiente que más sentido tiene hacer con tus datos actuales." : "The next move that makes the most sense from your current signals."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl bg-slate-50/90 p-4 dark:bg-slate-900/50">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {insights.explanation?.summary ??
                  (insights.workoutAdjustment === "reduce"
                    ? isSpanish ? "Baja fricción: sesiones más cortas y sostenibles." : "Reduce friction: shorter, more sustainable sessions."
                    : insights.workoutAdjustment === "increase"
                      ? isSpanish ? "Puedes escalar un poco carga o duración." : "You can scale load or duration slightly."
                      : isSpanish ? "Mantén el ritmo y consolida consistencia." : "Maintain the current pace and consolidate consistency.")}
              </p>
            </div>
            {insights.explanation?.reasons?.map((reason) => (
              <div key={reason} className="rounded-2xl bg-slate-50/90 p-4 dark:bg-slate-900/50">
                <p className="text-sm text-slate-600 dark:text-slate-300">{reason}</p>
              </div>
            ))}
            {insights.explanation?.signals?.length ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {insights.explanation.signals.map((signal) => (
                  <div key={`${signal.label}-${signal.value}`} className="rounded-2xl bg-slate-50/90 p-4 dark:bg-slate-900/50">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{signal.label}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{signal.value}</p>
                  </div>
                ))}
              </div>
            ) : null}
            {insights.explanation?.nextBestAction ? (
              <Button asChild className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-pink-500 text-white hover:from-orange-600 hover:to-pink-600">
                <Link href={insights.explanation.nextBestAction.href}>{insights.explanation.nextBestAction.label}</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="charts" className="space-y-6">
        <TabsList className="flex w-full gap-2 overflow-x-auto whitespace-nowrap">
          <TabsTrigger value="charts" className="shrink-0">{isSpanish ? "Gráficos" : "Charts"}</TabsTrigger>
          <TabsTrigger value="measurements" className="shrink-0">{isSpanish ? "Medidas" : "Measurements"}</TabsTrigger>
          <TabsTrigger value="records" className="shrink-0">{isSpanish ? "Récords" : "Records"}</TabsTrigger>
        </TabsList>

        {/* Charts Tab */}
        <TabsContent value="charts" className="space-y-6">
          {/* Weight Chart */}
          {charts.weight.length > 0 && (
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm dark:bg-gray-800/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="w-5 h-5" />
                  {isSpanish ? "Progreso de Peso" : "Weight Progress"}
                </CardTitle>
                <CardDescription>{isSpanish ? "Seguimiento de tu peso corporal en el tiempo" : "Track your body weight over time"}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-60 sm:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={charts.weight}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis width={36} />
                      <Tooltip />
                      <Line type="monotone" dataKey="weight" stroke="#f97316" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Body Fat Chart */}
          {charts.bodyFat.length > 0 && (
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm dark:bg-gray-800/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  {isSpanish ? "Porcentaje de Grasa Corporal" : "Body Fat Percentage"}
                </CardTitle>
                <CardDescription>{isSpanish ? "Seguimiento de tu composición corporal" : "Track your body composition"}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-60 sm:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={charts.bodyFat}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis width={36} />
                      <Tooltip />
                      <Line type="monotone" dataKey="bodyFat" stroke="#3b82f6" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Workout Frequency Chart */}
          {charts.frequency.length > 0 && (
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm dark:bg-gray-800/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  {isSpanish ? "Frecuencia de Entrenamientos" : "Workout Frequency"}
                </CardTitle>
                <CardDescription>{isSpanish ? "Entrenamientos por semana" : "Workouts per week"}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-60 sm:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.frequency}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" />
                      <YAxis width={36} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Measurements Tab */}
        <TabsContent value="measurements" className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold">{isSpanish ? "Medidas Corporales" : "Body Measurements"}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {isSpanish ? "Registra tus medidas para seguir tu evolución" : "Log your measurements to track your evolution"}
              </p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full bg-gradient-to-r from-orange-500 to-pink-500 sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  {isSpanish ? "Agregar Medida" : "Add Measurement"}
                </Button>
              </DialogTrigger>
              <DialogContent
                showCloseButton={false}
                className="grid max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden border-slate-200/90 bg-white p-0 sm:max-h-[calc(100dvh-1.5rem)] sm:w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)] lg:max-h-[calc(100dvh-2rem)] lg:max-w-[880px] dark:border-slate-800/90 dark:bg-slate-950"
              >
                <div className="flex items-start justify-between gap-4 p-4 sm:p-5 lg:p-6">
                <DialogHeader className="text-left">
                  <DialogTitle>{isSpanish ? "Nueva Medida Corporal" : "New Body Measurement"}</DialogTitle>
                  <DialogDescription>{isSpanish ? "Registra tus medidas actuales" : "Log your current measurements"}</DialogDescription>
                </DialogHeader>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 rounded-full border-orange-300/80 bg-white/90 px-4 text-slate-600 hover:border-orange-400 hover:text-slate-900 dark:border-orange-400/20 dark:bg-slate-950 dark:text-slate-300 dark:hover:text-white"
                  onClick={() => setIsDialogOpen(false)}
                >
                  {isSpanish ? "Cerrar" : "Close"}
                </Button>
                </div>
                <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain px-4 pb-4 [scrollbar-gutter:stable] sm:px-5 lg:px-6">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{isSpanish ? "Peso (kg)" : "Weight (kg)"}</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={newMeasurement.weight}
                        onChange={(e) => setNewMeasurement({ ...newMeasurement, weight: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{isSpanish ? "Grasa Corporal (%)" : "Body Fat (%)"}</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={newMeasurement.bodyFat}
                        onChange={(e) => setNewMeasurement({ ...newMeasurement, bodyFat: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{isSpanish ? "Pecho (cm)" : "Chest (cm)"}</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={newMeasurement.chest}
                        onChange={(e) => setNewMeasurement({ ...newMeasurement, chest: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{isSpanish ? "Cintura (cm)" : "Waist (cm)"}</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={newMeasurement.waist}
                        onChange={(e) => setNewMeasurement({ ...newMeasurement, waist: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{isSpanish ? "Caderas (cm)" : "Hips (cm)"}</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={newMeasurement.hips}
                        onChange={(e) => setNewMeasurement({ ...newMeasurement, hips: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{isSpanish ? "Brazos (cm)" : "Arms (cm)"}</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={newMeasurement.arms}
                        onChange={(e) => setNewMeasurement({ ...newMeasurement, arms: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>{isSpanish ? "Muslos (cm)" : "Thighs (cm)"}</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={newMeasurement.thighs}
                        onChange={(e) => setNewMeasurement({ ...newMeasurement, thighs: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                  <div className="grid shrink-0 grid-cols-1 gap-2 border-t border-slate-200/70 bg-white/95 p-4 dark:border-slate-800/80 dark:bg-slate-950/95 sm:grid-cols-2 sm:p-5 lg:p-6">
                    <Button
                      variant="outline"
                      className="h-10 rounded-2xl border-slate-700/60 bg-slate-800/40 text-slate-100 hover:bg-slate-800/55 dark:border-slate-700/80 dark:bg-slate-900/45"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      {isSpanish ? "Cancelar" : "Cancel"}
                    </Button>
                    <Button
                      onClick={handleAddMeasurement}
                      disabled={isAddingMeasurement}
                      className="h-10 rounded-2xl bg-gradient-to-r from-orange-500 to-pink-500"
                    >
                      {isAddingMeasurement ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {isSpanish ? "Guardando..." : "Saving..."}
                        </>
                      ) : (
                        isSpanish ? "Guardar" : "Save"
                      )}
                    </Button>
                  </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {measurements.length === 0 ? (
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm dark:bg-gray-800/80">
                <CardContent className="text-center py-12">
                  <Ruler className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {isSpanish ? "No hay medidas registradas" : "No measurements recorded"}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {isSpanish ? "Comienza a registrar tus medidas para seguir tu progreso" : "Start logging your measurements to track your progress"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              measurements.slice(0, 10).map((measurement) => (
                <Card key={measurement.id} className="border-0 shadow-lg bg-white/80 backdrop-blur-sm dark:bg-gray-800/80">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {new Date(measurement.date).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {measurement.weight && (
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">{isSpanish ? "Peso" : "Weight"}</p>
                          <p className="text-lg font-semibold">{measurement.weight} kg</p>
                        </div>
                      )}
                      {measurement.bodyFat && (
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">{isSpanish ? "Grasa" : "Fat"}</p>
                          <p className="text-lg font-semibold">{measurement.bodyFat}%</p>
                        </div>
                      )}
                      {measurement.chest && (
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">{isSpanish ? "Pecho" : "Chest"}</p>
                          <p className="text-lg font-semibold">{measurement.chest} cm</p>
                        </div>
                      )}
                      {measurement.waist && (
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">{isSpanish ? "Cintura" : "Waist"}</p>
                          <p className="text-lg font-semibold">{measurement.waist} cm</p>
                        </div>
                      )}
                      {measurement.hips && (
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">{isSpanish ? "Caderas" : "Hips"}</p>
                          <p className="text-lg font-semibold">{measurement.hips} cm</p>
                        </div>
                      )}
                      {measurement.arms && (
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">{isSpanish ? "Brazos" : "Arms"}</p>
                          <p className="text-lg font-semibold">{measurement.arms} cm</p>
                        </div>
                      )}
                      {measurement.thighs && (
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">{isSpanish ? "Muslos" : "Thighs"}</p>
                          <p className="text-lg font-semibold">{measurement.thighs} cm</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Records Tab */}
        <TabsContent value="records" className="space-y-6">
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm dark:bg-gray-800/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-orange-500" />
                {isSpanish ? "Récords Personales" : "Personal Records"}
              </CardTitle>
              <CardDescription>{isSpanish ? "Tus mejores marcas en cada ejercicio" : "Your best marks for each exercise"}</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.personalRecords.length === 0 ? (
                <div className="text-center py-12">
                  <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {isSpanish ? "No hay récords registrados" : "No records registered"}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {isSpanish ? "Completa entrenamientos para establecer tus récords personales" : "Complete workouts to set your personal records"}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {stats.personalRecords.map((record) => (
                    <div
                      key={record.exercise_id}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg"
                    >
                      <div>
                        <h4 className="font-semibold">{record.exercise_name}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date(record.date).toLocaleDateString('es-ES')}
                        </p>
                      </div>
                      <Badge className="text-lg px-4 py-2 bg-gradient-to-r from-orange-500 to-pink-500">
                        {record.max_weight} kg
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
