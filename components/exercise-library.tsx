"use client"

import Image from "next/image"
import { useMemo, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Search, Filter, Play, Target, Zap, Loader2, ChevronUp, ChevronDown } from "lucide-react"
import { useExercises } from "@/hooks/use-exercises"
import { useLanguage } from "@/lib/contexts/language-context"
import { getLocalizedExerciseCopy } from "@/lib/localized-exercise-copy"
import {
  getCategoryLabel,
  getDifficultyLabel,
  getEquipmentLabel,
  getMuscleGroupLabel,
  type AppLanguage,
} from "@/lib/workout-domain-labels"

function resolveExerciseImageUrl(imageUrl?: string | null) {
  if (!imageUrl) {
    return null
  }

  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  if (!apiUrl) {
    return imageUrl
  }

  const assetBase = apiUrl.replace(/\/api\/?$/, "")
  return `${assetBase}${imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`}`
}

export function ExerciseLibrary() {
  const { language } = useLanguage()
  const isSpanish = language === "es"
  const labelLanguage: AppLanguage = isSpanish ? "es" : "en"
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [equipmentFilter, setEquipmentFilter] = useState("all")
  const [environmentFilter, setEnvironmentFilter] = useState("all")
  const [difficultyFilter, setDifficultyFilter] = useState("all")
  const exerciseCardRefs = useRef<Array<HTMLDivElement | null>>([])

  // Usar el hook para obtener ejercicios de la API
  const { exercises, isLoading, error } = useExercises({
    search: searchTerm,
    category: categoryFilter !== "all" ? categoryFilter : undefined,
    equipment: equipmentFilter !== "all" ? equipmentFilter : undefined,
    environment: environmentFilter !== "all" ? environmentFilter : undefined,
    difficulty: difficultyFilter !== "all" ? difficultyFilter : undefined,
  })

  // Obtener categorías y equipos únicos
  const categories = useMemo(() => {
    return [...new Set(exercises.map((e) => e.category))]
  }, [exercises])

  const equipmentTypes = useMemo(() => {
    return [...new Set(exercises.map((e) => e.equipment).filter(Boolean))]
  }, [exercises])

  const environmentTypes = useMemo(() => {
    return [...new Set(exercises.flatMap((e) => e.trainingEnvironments ?? []).filter(Boolean))]
  }, [exercises])

  const formatEnvironment = (environment: string) => {
    if (environment === "gym") return isSpanish ? "Gimnasio" : "Gym"
    if (environment === "home") return isSpanish ? "Casa" : "Home"
    if (environment === "outdoor") return isSpanish ? "Aire libre" : "Outdoor"
    return environment
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "beginner":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
      case "intermediate":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
      case "advanced":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400"
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "strength":
        return "💪"
      case "cardio":
        return "❤️"
      case "flexibility":
        return "🤸"
      case "balance":
        return "⚖️"
      default:
        return "⚡"
    }
  }

  const renderExerciseMedia = (exercise: { name: string; imageUrl?: string | null }, compact = false) => {
    const resolvedImageUrl = resolveExerciseImageUrl(exercise.imageUrl)

    if (resolvedImageUrl) {
      return (
        <div
          className={`flex items-center justify-center overflow-hidden rounded-[24px] border border-orange-100/70 bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.12),_transparent_48%),linear-gradient(145deg,_rgba(255,247,237,0.95),_rgba(255,255,255,0.9))] shadow-inner dark:border-orange-500/10 dark:bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.18),_transparent_46%),linear-gradient(145deg,_rgba(15,23,42,0.92),_rgba(2,6,23,0.92))] ${compact ? "h-48 p-3" : "h-72 p-4" } ${compact ? "mb-4" : "mb-6"}`}
        >
          <Image
            src={resolvedImageUrl}
            alt={exercise.name}
            className="h-full w-full object-contain object-center"
            width={800}
            height={800}
            unoptimized
          />
        </div>
      )
    }

    return (
      <div
        className={`flex items-center justify-center overflow-hidden rounded-[24px] border border-slate-200/70 bg-[linear-gradient(145deg,_rgba(248,250,252,0.95),_rgba(255,255,255,0.9))] text-center shadow-inner dark:border-slate-700/60 dark:bg-[linear-gradient(145deg,_rgba(15,23,42,0.92),_rgba(2,6,23,0.92))] ${compact ? "mb-4 h-48" : "mb-6 h-72"}`}
      >
        <div className="px-6">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {isSpanish ? "Imagen no disponible todavía" : "Image not available yet"}
          </p>
        </div>
      </div>
    )
  }

  const scrollByExerciseStep = (direction: "up" | "down") => {
    if (typeof window === "undefined") {
      return
    }

    const cards = exerciseCardRefs.current.filter((card): card is HTMLDivElement => card !== null)
    if (cards.length === 0) {
      return
    }

    const viewportAnchor = window.innerHeight * 0.2
    const currentIndex = cards.findIndex((card) => card.getBoundingClientRect().bottom >= viewportAnchor)
    const safeCurrentIndex = currentIndex === -1 ? 0 : currentIndex
    const targetIndex =
      direction === "down"
        ? Math.min(safeCurrentIndex + 10, cards.length - 1)
        : Math.max(safeCurrentIndex - 10, 0)

    cards[targetIndex]?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  // Mostrar loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">{isSpanish ? "Cargando ejercicios..." : "Loading exercises..."}</p>
        </div>
      </div>
    )
  }

  // Mostrar error
  if (error) {
    return (
      <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm dark:bg-gray-800/80">
        <CardContent className="text-center py-12">
          <Zap className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{isSpanish ? "Error al cargar ejercicios" : "Error loading exercises"}</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>{isSpanish ? "Reintentar" : "Retry"}</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Filters */}
      <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm dark:bg-gray-800/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            {isSpanish ? "Filtros" : "Filters"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{isSpanish ? "Buscar" : "Search"}</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder={isSpanish ? "Buscar ejercicios..." : "Search exercises..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{isSpanish ? "Categoría" : "Category"}</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={isSpanish ? "Todas las categorías" : "All categories"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isSpanish ? "Todas las categorías" : "All categories"}</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1).replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{isSpanish ? "Equipo" : "Equipment"}</label>
              <Select value={equipmentFilter} onValueChange={setEquipmentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={isSpanish ? "Todo el equipo" : "All equipment"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isSpanish ? "Todo el equipo" : "All equipment"}</SelectItem>
                  {equipmentTypes.map((equipment) => (
                    <SelectItem key={equipment} value={equipment}>
                      {equipment.charAt(0).toUpperCase() + equipment.slice(1).replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{isSpanish ? "Dificultad" : "Difficulty"}</label>
              <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={isSpanish ? "Todos los niveles" : "All levels"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isSpanish ? "Todos los niveles" : "All levels"}</SelectItem>
                  <SelectItem value="beginner">{isSpanish ? "Principiante" : "Beginner"}</SelectItem>
                  <SelectItem value="intermediate">{isSpanish ? "Intermedio" : "Intermediate"}</SelectItem>
                  <SelectItem value="advanced">{isSpanish ? "Avanzado" : "Advanced"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{isSpanish ? "Entorno" : "Environment"}</label>
              <Select value={environmentFilter} onValueChange={setEnvironmentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={isSpanish ? "Todos los entornos" : "All environments"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isSpanish ? "Todos los entornos" : "All environments"}</SelectItem>
                  {environmentTypes.map((environment) => (
                    <SelectItem key={environment} value={environment}>
                      {formatEnvironment(environment)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {isSpanish
            ? `Mostrando ${exercises.length} ejercicio${exercises.length !== 1 ? "s" : ""}`
            : `Showing ${exercises.length} exercise${exercises.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      {exercises.length > 10 ? (
        <div className="pointer-events-none fixed right-3 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-2 sm:flex sm:right-4">
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => scrollByExerciseStep("up")}
            className="pointer-events-auto h-11 w-11 rounded-2xl border border-slate-200/80 bg-white/72 text-slate-600 shadow-[0_16px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white hover:text-slate-900 dark:border-slate-700/80 dark:bg-slate-950/70 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
            aria-label={isSpanish ? "Subir 10 ejercicios" : "Go up 10 exercises"}
          >
            <ChevronUp className="h-4.5 w-4.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => scrollByExerciseStep("down")}
            className="pointer-events-auto h-11 w-11 rounded-2xl border border-slate-200/80 bg-white/72 text-slate-600 shadow-[0_16px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl transition hover:translate-y-0.5 hover:bg-white hover:text-slate-900 dark:border-slate-700/80 dark:bg-slate-950/70 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
            aria-label={isSpanish ? "Bajar 10 ejercicios" : "Go down 10 exercises"}
          >
            <ChevronDown className="h-4.5 w-4.5" />
          </Button>
        </div>
      ) : null}

      {/* Exercise Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {exercises.map((exercise, index) => {
          const localizedExercise = getLocalizedExerciseCopy(exercise, labelLanguage)

          return (
          <Dialog key={exercise.id}>
            <DialogTrigger asChild>
              <div
                ref={(element) => {
                  exerciseCardRefs.current[index] = element
                }}
              >
                <Card className="group cursor-pointer border-0 bg-white/80 shadow-lg backdrop-blur-sm transition-all duration-200 hover:shadow-xl dark:bg-gray-800/80">
                <CardHeader className="pb-3">
                  {renderExerciseMedia({ ...exercise, name: localizedExercise.name }, true)}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{getCategoryIcon(exercise.category)}</span>
                      <div>
                        <CardTitle className="text-lg group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                          {localizedExercise.name}
                        </CardTitle>
                        <CardDescription className="text-sm">
                          {getCategoryLabel(labelLanguage, exercise.category)}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge className={getDifficultyColor(exercise.difficulty)}>
                      {getDifficultyLabel(labelLanguage, exercise.difficulty)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{localizedExercise.description}</p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary" className="text-xs">
                      {getMuscleGroupLabel(labelLanguage, exercise.muscleGroup)}
                    </Badge>
                    {exercise.trainingEnvironments?.map((environment) => (
                      <Badge key={environment} variant="outline" className="text-xs">
                        {formatEnvironment(environment)}
                      </Badge>
                    ))}
                  </div>
                  {exercise.equipment && (
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <Target className="w-4 h-4" />
                      {getEquipmentLabel(labelLanguage, exercise.equipment)}
                    </div>
                  )}
                </CardContent>
              </Card>
              </div>
            </DialogTrigger>
            <DialogContent
              showCloseButton={false}
              className="grid max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden border-slate-200/90 bg-white p-0 sm:max-h-[calc(100dvh-1.5rem)] sm:w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)] lg:max-h-[calc(100dvh-2rem)] lg:w-[calc(100vw-3rem)] lg:max-w-[1120px] dark:border-slate-800/90 dark:bg-slate-950"
            >
              <DialogHeader className="space-y-4 p-4 text-left sm:p-5 lg:p-6">
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{getCategoryIcon(exercise.category)}</span>
                  <div>
                    <DialogTitle className="text-2xl">{localizedExercise.name}</DialogTitle>
                    <DialogDescription className="text-base">
                      {getCategoryLabel(labelLanguage, exercise.category)}{" "}
                      {isSpanish ? "Ejercicio" : "Exercise"}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div
                data-testid="exercise-detail-scroll-body"
                className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-4 [scrollbar-gutter:stable] sm:px-5 lg:px-6"
              >
                {renderExerciseMedia({ ...exercise, name: localizedExercise.name })}
                <div className="space-y-6">
                <div className="flex flex-wrap gap-2">
                  <Badge className={getDifficultyColor(exercise.difficulty)}>
                    {getDifficultyLabel(labelLanguage, exercise.difficulty)}
                  </Badge>
                  {exercise.equipment && (
                    <Badge variant="outline">
                      {getEquipmentLabel(labelLanguage, exercise.equipment)}
                    </Badge>
                  )}
                  {exercise.trainingEnvironments?.map((environment) => (
                    <Badge key={environment} variant="secondary">
                      {formatEnvironment(environment)}
                    </Badge>
                  ))}
                </div>

                {localizedExercise.description && (
                  <div>
                    <h4 className="font-semibold mb-2">{isSpanish ? "Descripción" : "Description"}</h4>
                    <p className="text-gray-600 dark:text-gray-400">{localizedExercise.description}</p>
                  </div>
                )}

                <div>
                  <h4 className="font-semibold mb-2">{isSpanish ? "Músculos Objetivo" : "Target Muscles"}</h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {getMuscleGroupLabel(labelLanguage, exercise.muscleGroup)}
                    </Badge>
                  </div>
                </div>

                {localizedExercise.instructions.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">{isSpanish ? "Instrucciones" : "Instructions"}</h4>
                    <ol className="list-decimal list-inside space-y-2">
                      {localizedExercise.instructions.map((instruction, index) => (
                        <li key={index} className="text-gray-600 dark:text-gray-400">
                          {instruction}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                </div>
              </div>
              <div className="flex shrink-0 justify-end border-t border-slate-200/80 bg-white/95 p-4 dark:border-slate-800/80 dark:bg-slate-950/95 sm:p-5 lg:p-6">
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 rounded-full border-orange-300/80 bg-white/90 px-4 text-slate-600 hover:border-orange-400 hover:text-slate-900 dark:border-orange-400/20 dark:bg-slate-950 dark:text-slate-300 dark:hover:text-white"
                  >
                    {isSpanish ? "Cerrar" : "Close"}
                  </Button>
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>
          )
        })}
      </div>

      {exercises.length === 0 && (
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm dark:bg-gray-800/80">
          <CardContent className="text-center py-12">
            <Zap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{isSpanish ? "No se encontraron ejercicios" : "No exercises found"}</h3>
            <p className="text-gray-600 dark:text-gray-400">
              {isSpanish
                ? "Intenta ajustar tus filtros o términos de búsqueda para encontrar ejercicios."
                : "Try adjusting your filters or search terms to find exercises."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
