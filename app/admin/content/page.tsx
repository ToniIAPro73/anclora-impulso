"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Search,
  Send,
  PencilLine,
  ShieldCheck,
} from "lucide-react"

import { ProtectedDashboardPage } from "@/components/protected-dashboard-page"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useEditorialExercises } from "@/hooks/use-editorial-content"
import { useAuth } from "@/lib/contexts/auth-context"
import { useLanguage } from "@/lib/contexts/language-context"
import {
  ANCLORA_MODAL_ACTIONS_CLASS,
  ANCLORA_MODAL_HEADER_CLASS,
  ANCLORA_MODAL_SECONDARY_ACTION_CLASS,
  buildResponsiveModalClass,
} from "@/lib/ui-contracts"
import { engagementApi, type NotificationDelivery } from "@/lib/api"

function AdminContentInner() {
  const { user } = useAuth()
  const { language, t } = useLanguage()
  const isSpanish = language === "es"
  const editorialStatusLabel = (status?: string | null) => {
    switch (status) {
      case "ready":
        return isSpanish ? "Listo" : "Ready"
      case "needs_work":
        return isSpanish ? "Necesita revisión" : "Needs work"
      default:
        return isSpanish ? "En revisión" : "In review"
    }
  }
  const deliveryStatusLabel = (status: NotificationDelivery["status"]) => {
    switch (status) {
      case "sent":
        return isSpanish ? "Enviado" : "Sent"
      case "failed":
        return isSpanish ? "Fallido" : "Failed"
      default:
        return isSpanish ? "Pendiente" : "Pending"
    }
  }
  const {
    summary,
    recipesSummary,
    isLoading,
    isLoadingRecipes,
    error,
    recipesError,
    updateExercise,
    updateRecipe,
    bulkUpdateExerciseEditorial,
    bulkUpdateRecipeEditorial,
    isUpdating,
    isBulkUpdating,
    isUpdatingRecipe,
    isBulkUpdatingRecipe,
    eventsSummary,
  } = useEditorialExercises()
  const [activeTab, setActiveTab] = useState<"exercises" | "recipes">("exercises")
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "ready" | "review" | "needs_work">("all")
  const [issueFilter, setIssueFilter] = useState<"all" | "missing_image" | "weak_instructions" | "few_tags" | "missing_macros">("all")
  const [sortBy, setSortBy] = useState<"score_asc" | "score_desc" | "updated_desc" | "name_asc">("score_asc")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [recentDeliveries, setRecentDeliveries] = useState<Array<NotificationDelivery & { user: { email: string; fullName: string } }>>([])
  const [isDispatchingNotifications, setIsDispatchingNotifications] = useState(false)
  const [dispatchFeedback, setDispatchFeedback] = useState<{
    tone: "neutral" | "success" | "warning" | "danger"
    title: string
    body: string
  } | null>(null)
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null)
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null)
  const exerciseItemRefs = useRef<Array<HTMLDivElement | null>>([])
  const recipeItemRefs = useRef<Array<HTMLDivElement | null>>([])

  const selectedExercise = useMemo(
    () => summary?.exercises.find((exercise) => exercise.id === selectedExerciseId) ?? null,
    [selectedExerciseId, summary],
  )
  const selectedRecipe = useMemo(
    () => recipesSummary?.recipes.find((recipe) => recipe.id === selectedRecipeId) ?? null,
    [selectedRecipeId, recipesSummary],
  )

  const [exerciseForm, setExerciseForm] = useState({
    description: "",
    instructions: "",
    editorialOverrideStatus: "review",
    editorialNotes: "",
  })
  const [recipeForm, setRecipeForm] = useState({
    description: "",
    instructions: "",
    difficulty: "",
    tags: "",
    prepTime: "",
    cookTime: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    editorialOverrideStatus: "review",
    editorialNotes: "",
  })

  useEffect(() => {
    if (!selectedExercise) return
    setExerciseForm({
      description: selectedExercise.description,
      instructions: selectedExercise.instructions.join("\n"),
      editorialOverrideStatus: selectedExercise.editorial?.editorialStatus ?? "review",
      editorialNotes: selectedExercise.editorial?.editorialNotes ?? "",
    })
  }, [selectedExercise])

  useEffect(() => {
    if (!selectedRecipe) return
    setRecipeForm({
      description: selectedRecipe.description ?? "",
      instructions: selectedRecipe.instructions.join("\n"),
      difficulty: selectedRecipe.difficulty ?? "",
      tags: selectedRecipe.tags.join("\n"),
      prepTime: selectedRecipe.prepTime ? String(selectedRecipe.prepTime) : "",
      cookTime: selectedRecipe.cookTime ? String(selectedRecipe.cookTime) : "",
      calories: selectedRecipe.calories ? String(selectedRecipe.calories) : "",
      protein: selectedRecipe.protein ? String(selectedRecipe.protein) : "",
      carbs: selectedRecipe.carbs ? String(selectedRecipe.carbs) : "",
      fat: selectedRecipe.fat ? String(selectedRecipe.fat) : "",
      editorialOverrideStatus: selectedRecipe.editorial?.editorialStatus ?? "review",
      editorialNotes: selectedRecipe.editorial?.editorialNotes ?? "",
    })
  }, [selectedRecipe])

  useEffect(() => {
    setSelectedIds([])
  }, [activeTab, searchQuery, statusFilter, issueFilter, sortBy])

  useEffect(() => {
    let isMounted = true
    const loadRecentDeliveries = async () => {
      try {
        const deliveries = await engagementApi.getRecentDeliveries()
        if (isMounted) {
          setRecentDeliveries(deliveries)
        }
      } catch {
        if (isMounted) {
          setRecentDeliveries([])
        }
      }
    }

    void loadRecentDeliveries()
    return () => {
      isMounted = false
    }
  }, [])

  const handleSaveExercise = async () => {
    if (!selectedExercise) return
    await updateExercise({
      id: selectedExercise.id,
      data: {
        description: exerciseForm.description,
        instructions: exerciseForm.instructions
          .split("\n")
          .map((instruction) => instruction.trim())
          .filter(Boolean),
        editorialOverrideStatus: exerciseForm.editorialOverrideStatus as "ready" | "review" | "needs_work",
        editorialNotes: exerciseForm.editorialNotes || null,
      },
    })
    setSelectedExerciseId(null)
  }

  const handleSaveRecipe = async () => {
    if (!selectedRecipe) return
    await updateRecipe({
      id: selectedRecipe.id,
      data: {
        description: recipeForm.description || null,
        instructions: recipeForm.instructions
          .split("\n")
          .map((instruction) => instruction.trim())
          .filter(Boolean),
        difficulty: recipeForm.difficulty || null,
        tags: recipeForm.tags
          .split("\n")
          .map((tag) => tag.trim())
          .filter(Boolean),
        prepTime: recipeForm.prepTime ? Number(recipeForm.prepTime) : null,
        cookTime: recipeForm.cookTime ? Number(recipeForm.cookTime) : null,
        calories: recipeForm.calories ? Number(recipeForm.calories) : null,
        protein: recipeForm.protein ? Number(recipeForm.protein) : null,
        carbs: recipeForm.carbs ? Number(recipeForm.carbs) : null,
        fat: recipeForm.fat ? Number(recipeForm.fat) : null,
        editorialOverrideStatus: recipeForm.editorialOverrideStatus as "ready" | "review" | "needs_work",
        editorialNotes: recipeForm.editorialNotes || null,
      },
    })
    setSelectedRecipeId(null)
  }

  const currentError = error ?? recipesError
  const loading = isLoading || isLoadingRecipes
  const normalizedQuery = searchQuery.trim().toLowerCase()

  const filteredExercises = useMemo(() => {
    const items = summary?.exercises ?? []
    return items
      .filter((exercise) => {
        const matchesStatus = statusFilter === "all" || exercise.editorial?.editorialStatus === statusFilter
        const matchesSearch = !normalizedQuery
          || [exercise.name, exercise.category, exercise.muscleGroup, exercise.equipment].join(" ").toLowerCase().includes(normalizedQuery)
        const issueMatch =
          issueFilter === "all" ||
          (issueFilter === "missing_image" && !exercise.editorial?.checks.hasImage) ||
          (issueFilter === "weak_instructions" && !exercise.editorial?.checks.hasEnoughInstructions)
        return matchesStatus && issueMatch && matchesSearch
      })
      .sort((left, right) => {
        if (sortBy === "score_desc") return (right.editorial?.qualityScore ?? 0) - (left.editorial?.qualityScore ?? 0)
        if (sortBy === "updated_desc") return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
        if (sortBy === "name_asc") return left.name.localeCompare(right.name)
        return (left.editorial?.qualityScore ?? 0) - (right.editorial?.qualityScore ?? 0)
      })
  }, [summary, normalizedQuery, statusFilter, issueFilter, sortBy])

  const filteredRecipes = useMemo(() => {
    const items = recipesSummary?.recipes ?? []
    return items
      .filter((recipe) => {
        const matchesStatus = statusFilter === "all" || recipe.editorial?.editorialStatus === statusFilter
        const matchesSearch = !normalizedQuery || [recipe.name, ...recipe.tags].join(" ").toLowerCase().includes(normalizedQuery)
        const issueMatch =
          issueFilter === "all" ||
          (issueFilter === "missing_image" && !recipe.editorial?.checks.hasImage) ||
          (issueFilter === "weak_instructions" && !recipe.editorial?.checks.hasEnoughInstructions) ||
          (issueFilter === "few_tags" && !recipe.editorial?.checks.hasTags) ||
          (issueFilter === "missing_macros" && !recipe.editorial?.checks.hasMacros)
        return matchesStatus && issueMatch && matchesSearch
      })
      .sort((left, right) => {
        if (sortBy === "score_desc") return (right.editorial?.qualityScore ?? 0) - (left.editorial?.qualityScore ?? 0)
        if (sortBy === "updated_desc") return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
        if (sortBy === "name_asc") return left.name.localeCompare(right.name)
        return (left.editorial?.qualityScore ?? 0) - (right.editorial?.qualityScore ?? 0)
      })
  }, [recipesSummary, normalizedQuery, statusFilter, issueFilter, sortBy])

  const activeItems = activeTab === "exercises" ? filteredExercises : filteredRecipes
  const editorialStep = Math.min(24, Math.max(4, Math.round(activeItems.length * 0.08)))
  const allVisibleSelected = activeItems.length > 0 && activeItems.every((item) => selectedIds.includes(item.id))

  const toggleItemSelection = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
  }

  const toggleSelectAllVisible = () => {
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !activeItems.some((item) => item.id === id))
        : Array.from(new Set([...current, ...activeItems.map((item) => item.id)])),
    )
  }

  const handleBulkStatusUpdate = async (nextStatus: "ready" | "review" | "needs_work") => {
    if (selectedIds.length === 0) return
    if (activeTab === "exercises") {
      await bulkUpdateExerciseEditorial({ ids: selectedIds, editorialOverrideStatus: nextStatus })
    } else {
      await bulkUpdateRecipeEditorial({ ids: selectedIds, editorialOverrideStatus: nextStatus })
    }
    setSelectedIds([])
  }

  const dispatchNotificationsNow = async () => {
    setIsDispatchingNotifications(true)
    setDispatchFeedback(null)
    try {
      const result = await engagementApi.dispatchNow()
      const deliveries = await engagementApi.getRecentDeliveries()
      setRecentDeliveries(deliveries)

      const smtpFailure = deliveries.find((delivery) => delivery.failureReason === "SMTP_NOT_CONFIGURED")

      if (smtpFailure) {
        setDispatchFeedback({
          tone: "warning",
          title: language === "es" ? "SMTP no configurado" : "SMTP not configured",
          body:
            language === "es"
              ? "El backend ha intentado despachar recordatorios, pero el canal email no está configurado todavía."
              : "The backend tried to dispatch reminders, but the email channel is not configured yet.",
        })
      } else if (result.sent > 0) {
        setDispatchFeedback({
          tone: "success",
          title: language === "es" ? "Despacho completado" : "Dispatch completed",
          body:
            language === "es"
              ? `Se han enviado ${result.sent} recordatorios. ${result.failed > 0 ? `${result.failed} han fallado.` : ""}`.trim()
              : `${result.sent} reminders were sent. ${result.failed > 0 ? `${result.failed} failed.` : ""}`.trim(),
        })
      } else if (result.created === 0 && result.sent === 0 && result.failed === 0) {
        setDispatchFeedback({
          tone: "neutral",
          title: language === "es" ? "Nada que enviar ahora" : "Nothing to send right now",
          body:
            language === "es"
              ? "No había recordatorios debidos en esta ventana temporal."
              : "There were no reminders due in this time window.",
        })
      } else {
        setDispatchFeedback({
          tone: "danger",
          title: language === "es" ? "Despacho incompleto" : "Dispatch incomplete",
          body:
            language === "es"
              ? `Se han intentado crear ${result.created} recordatorios, pero ${result.failed} han fallado y no se ha enviado ninguno.`
              : `${result.created} reminders were created, but ${result.failed} failed and none were sent.`,
        })
      }
    } catch (error) {
      setDispatchFeedback({
        tone: "danger",
        title: language === "es" ? "No se pudo despachar" : "Could not dispatch",
        body:
          error instanceof Error
            ? error.message
            : language === "es"
              ? "El backend no ha podido completar la acción."
              : "The backend could not complete the action.",
      })
    } finally {
      setIsDispatchingNotifications(false)
    }
  }

  if (!user?.isAdmin) {
    return (
      <div className="px-3 py-4 sm:px-5 sm:py-5 lg:px-6">
        <Card className="ui-motion-card-subtle border-0 bg-white/80 shadow-lg backdrop-blur-sm dark:bg-gray-800/80">
          <CardContent className="flex min-h-[320px] flex-col items-center justify-center gap-4 text-center">
            <ShieldCheck className="h-12 w-12 text-orange-500" />
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{t.admin.restrictedTitle}</h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t.admin.restrictedDesc}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const scrollEditorialQueue = (direction: "up" | "down") => {
    const refs = activeTab === "exercises" ? exerciseItemRefs.current : recipeItemRefs.current
    const viewportTop = 160
    const currentIndex = refs.findIndex((element) => {
      if (!element) return false
      const rect = element.getBoundingClientRect()
      return rect.bottom >= viewportTop && rect.top >= viewportTop - 24
    })
    const visibleIndex =
      currentIndex >= 0
        ? currentIndex
        : Math.max(
            0,
            refs.findIndex((element) => {
              if (!element) return false
              return element.getBoundingClientRect().bottom >= viewportTop
            }),
          )
    const targetIndex =
      direction === "down"
        ? Math.min(activeItems.length - 1, visibleIndex + editorialStep)
        : Math.max(0, visibleIndex - editorialStep)

    refs[targetIndex]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    })
  }

  return (
    <div className="space-y-6 px-3 py-4 sm:px-5 sm:py-5 lg:px-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{t.admin.title}</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">{t.admin.subtitle}</p>
      </div>

      {loading ? (
        <Card className="ui-motion-card-subtle border-0 bg-white/80 shadow-lg backdrop-blur-sm dark:bg-gray-800/80">
          <CardContent className="py-12 text-center text-slate-500 dark:text-slate-400">{t.admin.loading}</CardContent>
        </Card>
      ) : currentError || !summary || !recipesSummary ? (
        <Card className="ui-motion-card-subtle border-0 bg-white/80 shadow-lg backdrop-blur-sm dark:bg-gray-800/80">
          <CardContent className="py-12 text-center text-red-500">{currentError ?? t.admin.loadError}</CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
            <Card className="border-0 bg-gradient-to-br from-slate-950 to-slate-800 text-white shadow-xl">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <ClipboardList className="h-4 w-4 text-orange-400" />
                  {t.admin.catalog}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-3xl font-semibold">{summary.total}</p>
                  <p className="mt-1 text-sm text-slate-300">{t.admin.catalogExercises}</p>
                </div>
                <div>
                  <p className="text-3xl font-semibold">{recipesSummary.total}</p>
                  <p className="mt-1 text-sm text-slate-300">{t.admin.catalogRecipes}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="ui-motion-card-subtle border-0 bg-white/80 shadow-lg backdrop-blur-sm dark:bg-gray-800/80">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{t.admin.averageQuality}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-slate-900 dark:text-white">{summary.averageQualityScore}%</p>
              </CardContent>
            </Card>
            <Card className="ui-motion-card-subtle border-0 bg-white/80 shadow-lg backdrop-blur-sm dark:bg-gray-800/80">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{t.admin.ready}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-emerald-600">{summary.byStatus.ready + recipesSummary.byStatus.ready}</p>
              </CardContent>
            </Card>
            <Card className="ui-motion-card-subtle border-0 bg-white/80 shadow-lg backdrop-blur-sm dark:bg-gray-800/80">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{t.admin.needsWork}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-orange-600">{summary.byStatus.needs_work + recipesSummary.byStatus.needs_work}</p>
              </CardContent>
            </Card>
            <Card className="ui-motion-card-subtle border-0 bg-white/80 shadow-lg backdrop-blur-sm dark:bg-gray-800/80">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{t.admin.eventsTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-slate-900 dark:text-white">{eventsSummary?.totalLast28Days ?? 0}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.admin.eventsLast28Days}</p>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "exercises" | "recipes")} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="exercises">{t.admin.exercisesTab}</TabsTrigger>
              <TabsTrigger value="recipes">{t.admin.recipesTab}</TabsTrigger>
            </TabsList>

            <Card className="ui-motion-card-subtle border-0 bg-white/80 shadow-lg backdrop-blur-sm dark:bg-gray-800/80">
              <CardContent className="grid gap-3 p-4 md:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(160px,1fr))]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={t.common.search}
                    className="pl-9"
                  />
                </div>
                <select
                  aria-label={isSpanish ? "Filtrar por estado" : "Filter by status"}
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                >
                  <option value="all">{language === "es" ? "Todos los estados" : "All statuses"}</option>
                  <option value="ready">{editorialStatusLabel("ready")}</option>
                  <option value="review">{editorialStatusLabel("review")}</option>
                  <option value="needs_work">{editorialStatusLabel("needs_work")}</option>
                </select>
                <select
                  aria-label={isSpanish ? "Filtrar por incidencia" : "Filter by issue"}
                  value={issueFilter}
                  onChange={(event) => setIssueFilter(event.target.value as typeof issueFilter)}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                >
                  <option value="all">{language === "es" ? "Todas las incidencias" : "All issues"}</option>
                  <option value="missing_image">{t.admin.missingImage}</option>
                  <option value="weak_instructions">{t.admin.weakInstructions}</option>
                  <option value="few_tags">{t.admin.fewTags}</option>
                  <option value="missing_macros">{t.admin.missingMacros}</option>
                </select>
                <select
                  aria-label={isSpanish ? "Ordenar" : "Sort"}
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                >
                  <option value="score_asc">{language === "es" ? "Score ascendente" : "Score ascending"}</option>
                  <option value="score_desc">{language === "es" ? "Score descendente" : "Score descending"}</option>
                  <option value="updated_desc">{language === "es" ? "Más recientes" : "Recently updated"}</option>
                  <option value="name_asc">{language === "es" ? "Nombre A-Z" : "Name A-Z"}</option>
                </select>
              </CardContent>
            </Card>

            {selectedIds.length > 0 ? (
              <Card className="ui-motion-card-static border border-orange-200/70 bg-orange-50/90 shadow-sm dark:border-orange-500/20 dark:bg-orange-950/10">
                <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={toggleSelectAllVisible}>
                      {allVisibleSelected ? (language === "es" ? "Quitar visibles" : "Clear visible") : (language === "es" ? "Seleccionar visibles" : "Select visible")}
                    </Button>
                    <p className="text-sm text-slate-700 dark:text-slate-200">
                      {selectedIds.length} {language === "es" ? "elementos seleccionados" : "selected items"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" className="rounded-xl" disabled={isBulkUpdating || isBulkUpdatingRecipe} onClick={() => void handleBulkStatusUpdate("ready")}>{editorialStatusLabel("ready")}</Button>
                    <Button type="button" size="sm" variant="outline" className="rounded-xl" disabled={isBulkUpdating || isBulkUpdatingRecipe} onClick={() => void handleBulkStatusUpdate("review")}>{editorialStatusLabel("review")}</Button>
                    <Button type="button" size="sm" variant="outline" className="rounded-xl" disabled={isBulkUpdating || isBulkUpdatingRecipe} onClick={() => void handleBulkStatusUpdate("needs_work")}>{editorialStatusLabel("needs_work")}</Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {activeItems.length > 8 ? (
              <div className="pointer-events-none fixed right-3 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-2 sm:right-4">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => scrollEditorialQueue("up")}
                  className="pointer-events-auto h-11 w-11 rounded-2xl border border-slate-200/80 bg-white/72 text-slate-600 shadow-[0_16px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white hover:text-slate-900 dark:border-slate-700/80 dark:bg-slate-950/70 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
                  aria-label={language === "es" ? `Subir ${editorialStep} elementos` : `Go up ${editorialStep} items`}
                >
                  <ChevronUp className="h-4.5 w-4.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => scrollEditorialQueue("down")}
                  className="pointer-events-auto h-11 w-11 rounded-2xl border border-slate-200/80 bg-white/72 text-slate-600 shadow-[0_16px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl transition hover:translate-y-0.5 hover:bg-white hover:text-slate-900 dark:border-slate-700/80 dark:bg-slate-950/70 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
                  aria-label={language === "es" ? `Bajar ${editorialStep} elementos` : `Go down ${editorialStep} items`}
                >
                  <ChevronDown className="h-4.5 w-4.5" />
                </Button>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
              <Card className="ui-motion-card-static overflow-hidden border-0 bg-white/95 shadow-lg backdrop-blur-sm dark:bg-slate-900">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-orange-500" />
                    {activeTab === "exercises" ? t.admin.exerciseQueueTitle : t.admin.recipeQueueTitle}
                  </CardTitle>
                  <CardDescription>
                    {activeTab === "exercises" ? t.admin.exerciseQueueDesc : t.admin.recipeQueueDesc}
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative isolate space-y-3 overflow-hidden">
                  {activeTab === "exercises"
                    ? filteredExercises.map((exercise, index) => (
                        <div
                          key={exercise.id}
                          ref={(element) => {
                            exerciseItemRefs.current[index] = element
                          }}
                          className="relative z-0 flex w-full flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left dark:border-slate-700 dark:bg-slate-900"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="line-clamp-2 break-words font-semibold text-slate-900 dark:text-white">{exercise.name}</p>
                              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                                {exercise.category} · {exercise.muscleGroup} · {exercise.equipment}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                aria-label={`${isSpanish ? "Seleccionar" : "Select"} ${exercise.name}`}
                                checked={selectedIds.includes(exercise.id)}
                                onChange={() => toggleItemSelection(exercise.id)}
                                className="h-4 w-4 rounded border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950"
                              />
                              <Badge variant="outline" className="rounded-full px-3 py-1">
                                {exercise.editorial?.qualityScore ?? 0}%
                              </Badge>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9 rounded-xl border-slate-200 bg-white/85 px-3 text-slate-700 hover:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                                onClick={() => setSelectedExerciseId(exercise.id)}
                              >
                                <PencilLine className="mr-2 h-4 w-4" />
                                {t.admin.editItem}
                              </Button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge className="rounded-full border-0 bg-slate-900/5 text-slate-700 dark:bg-white/10 dark:text-slate-200">
                              {editorialStatusLabel(exercise.editorial?.editorialStatus)}
                            </Badge>
                            {!exercise.editorial?.checks.hasImage ? (
                              <Badge variant="destructive" className="rounded-full">
                                {t.admin.missingImage}
                              </Badge>
                            ) : null}
                            {!exercise.editorial?.checks.hasEnoughInstructions ? (
                              <Badge variant="destructive" className="rounded-full">
                                {t.admin.weakInstructions}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      ))
                    : filteredRecipes.map((recipe, index) => (
                        <div
                          key={recipe.id}
                          ref={(element) => {
                            recipeItemRefs.current[index] = element
                          }}
                          className="relative z-0 flex w-full flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left dark:border-slate-700 dark:bg-slate-900"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="line-clamp-2 break-words font-semibold text-slate-900 dark:text-white">{recipe.name}</p>
                              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                                {(recipe.tags ?? []).slice(0, 3).join(" · ") || "—"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                aria-label={`${isSpanish ? "Seleccionar" : "Select"} ${recipe.name}`}
                                checked={selectedIds.includes(recipe.id)}
                                onChange={() => toggleItemSelection(recipe.id)}
                                className="h-4 w-4 rounded border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950"
                              />
                              <Badge variant="outline" className="rounded-full px-3 py-1">
                                {recipe.editorial?.qualityScore ?? 0}%
                              </Badge>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9 rounded-xl border-slate-200 bg-white/85 px-3 text-slate-700 hover:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                                onClick={() => setSelectedRecipeId(recipe.id)}
                              >
                                <PencilLine className="mr-2 h-4 w-4" />
                                {t.admin.editItem}
                              </Button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge className="rounded-full border-0 bg-slate-900/5 text-slate-700 dark:bg-white/10 dark:text-slate-200">
                              {editorialStatusLabel(recipe.editorial?.editorialStatus)}
                            </Badge>
                            {!recipe.editorial?.checks.hasImage ? (
                              <Badge variant="destructive" className="rounded-full">
                                {t.admin.missingImage}
                              </Badge>
                            ) : null}
                            {!recipe.editorial?.checks.hasEnoughInstructions ? (
                              <Badge variant="destructive" className="rounded-full">
                                {t.admin.weakInstructions}
                              </Badge>
                            ) : null}
                            {!recipe.editorial?.checks.hasTags ? (
                              <Badge variant="destructive" className="rounded-full">
                                {t.admin.fewTags}
                              </Badge>
                            ) : null}
                            {!recipe.editorial?.checks.hasMacros ? (
                              <Badge variant="destructive" className="rounded-full">
                                {t.admin.missingMacros}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      ))}
                </CardContent>
              </Card>

              <Card className="ui-motion-card-subtle border-0 bg-white/80 shadow-lg backdrop-blur-sm dark:bg-gray-800/80">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-orange-500" />
                    {t.admin.eventsTitle}
                  </CardTitle>
                  <CardDescription>{t.admin.eventsDesc}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-2xl bg-slate-50/90 p-4 dark:bg-slate-900/50">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t.admin.eventsLast28Days}</p>
                    <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{eventsSummary?.totalLast28Days ?? 0}</p>
                  </div>
                  <div className="space-y-2">
                    {(eventsSummary?.topActions ?? []).slice(0, 5).map((event) => (
                      <div key={`${event.category}-${event.action}`} className="flex items-center justify-between rounded-2xl bg-slate-50/90 px-4 py-3 dark:bg-slate-900/50">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{event.action}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{event.category}</p>
                        </div>
                        <Badge variant="outline" className="rounded-full px-3 py-1">
                          {event.count}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  {!(eventsSummary?.topActions?.length) ? (
                    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p className="text-sm">{t.admin.eventsEmpty}</p>
                    </div>
                  ) : null}
                  <div className="rounded-2xl border border-slate-200/70 bg-slate-50/90 p-4 dark:border-slate-700/70 dark:bg-slate-900/50">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{language === "es" ? "Notificaciones operativas" : "Operational notifications"}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{language === "es" ? "Despacha recordatorios y revisa el estado reciente." : "Dispatch reminders and review recent delivery status."}</p>
                      </div>
                      <Button type="button" size="sm" className="rounded-xl" disabled={isDispatchingNotifications} onClick={() => void dispatchNotificationsNow()}>
                        <Send className="mr-2 h-4 w-4" />
                        {language === "es" ? "Despachar ahora" : "Dispatch now"}
                      </Button>
                    </div>
                    {dispatchFeedback ? (
                      <div
                        className={`mt-3 rounded-2xl border px-4 py-3 text-sm ${
                          dispatchFeedback.tone === "success"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200"
                            : dispatchFeedback.tone === "warning"
                              ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
                              : dispatchFeedback.tone === "danger"
                                ? "border-red-200 bg-red-50 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200"
                                : "border-slate-200 bg-white/80 text-slate-700 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-200"
                        }`}
                      >
                        <p className="font-semibold">{dispatchFeedback.title}</p>
                        <p className="mt-1">{dispatchFeedback.body}</p>
                      </div>
                    ) : null}
                    <div className="mt-3 space-y-2">
                      {recentDeliveries.slice(0, 4).map((delivery) => (
                        <div key={delivery.id} className="flex items-center justify-between rounded-xl bg-white/85 px-3 py-2 text-sm dark:bg-slate-950/70">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900 dark:text-white">{delivery.subject}</p>
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{delivery.user.email}</p>
                          </div>
                          <Badge variant="outline" className="rounded-full px-3 py-1">{deliveryStatusLabel(delivery.status)}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </Tabs>

          <Dialog open={Boolean(selectedExerciseId && selectedExercise)} onOpenChange={(open) => !open && setSelectedExerciseId(null)}>
            <DialogContent
              className={`h-[calc(100dvh-1rem)] max-h-none sm:h-[calc(100dvh-1.5rem)] lg:h-[calc(100dvh-2rem)] ${buildResponsiveModalClass("lg:w-[calc(100vw-3rem)] lg:max-w-[1280px]")}`}
            >
              <div className="grid h-full grid-cols-1 grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-4 sm:p-5 lg:p-6">
                <div className="mb-3">
                  <DialogHeader className={ANCLORA_MODAL_HEADER_CLASS}>
                    <DialogTitle className="line-clamp-2 break-words leading-snug">{selectedExercise?.name ?? t.admin.exerciseQueueTitle}</DialogTitle>
                    <DialogDescription>{t.admin.exerciseEditorDesc}</DialogDescription>
                  </DialogHeader>
                </div>

                <div className="mb-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-800/80 dark:bg-slate-900/70">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <span>{selectedExercise?.category}</span>
                    <span>·</span>
                    <span>{selectedExercise?.muscleGroup}</span>
                    <span>·</span>
                    <span>{selectedExercise?.equipment}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline" className="rounded-full px-3 py-1">
                      {t.admin.currentScore}: {selectedExercise?.editorial?.qualityScore ?? 0}%
                    </Badge>
                    <Badge className="rounded-full border-0 bg-slate-900/5 text-slate-700 dark:bg-white/10 dark:text-slate-200">
                      {editorialStatusLabel(selectedExercise?.editorial?.editorialStatus)}
                    </Badge>
                    {!selectedExercise?.editorial?.checks.hasImage ? <Badge variant="destructive" className="rounded-full">{t.admin.missingImage}</Badge> : null}
                    {!selectedExercise?.editorial?.checks.hasEnoughInstructions ? <Badge variant="destructive" className="rounded-full">{t.admin.weakInstructions}</Badge> : null}
                  </div>
                </div>

                <div data-slot="editor-scroll-body" className="flex min-h-0 flex-col gap-3 overflow-y-auto [&>*]:shrink-0 lg:grid lg:content-start lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="grid min-h-0 gap-3">
                    <div className="min-h-0 space-y-2">
                      <Label>{t.admin.description}</Label>
                      <Textarea
                        value={exerciseForm.description}
                        onChange={(event) => setExerciseForm((current) => ({ ...current, description: event.target.value }))}
                        className="h-[clamp(120px,24vh,180px)] resize-none"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{language === "es" ? "Estado editorial" : "Editorial status"}</Label>
                        <select
                          value={exerciseForm.editorialOverrideStatus}
                          onChange={(event) => setExerciseForm((current) => ({ ...current, editorialOverrideStatus: event.target.value }))}
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                        >
                          <option value="ready">{editorialStatusLabel("ready")}</option>
                          <option value="review">{editorialStatusLabel("review")}</option>
                          <option value="needs_work">{editorialStatusLabel("needs_work")}</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>{language === "es" ? "Notas editoriales" : "Editorial notes"}</Label>
                        <Textarea
                          value={exerciseForm.editorialNotes}
                          onChange={(event) => setExerciseForm((current) => ({ ...current, editorialNotes: event.target.value }))}
                          className="h-24 resize-none"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="min-h-0 space-y-2">
                    <Label>{t.admin.instructionsOnePerLine}</Label>
                    <Textarea
                      value={exerciseForm.instructions}
                      onChange={(event) => setExerciseForm((current) => ({ ...current, instructions: event.target.value }))}
                      className="h-[clamp(180px,38vh,320px)] resize-none"
                    />
                  </div>
                </div>

                <DialogFooter className={`mt-3 ${ANCLORA_MODAL_ACTIONS_CLASS}`}>
                  <Button
                    variant="outline"
                    className={ANCLORA_MODAL_SECONDARY_ACTION_CLASS}
                    onClick={() => setSelectedExerciseId(null)}
                  >
                    {t.common.cancel}
                  </Button>
                  <Button
                    disabled={isUpdating}
                    className="h-10 rounded-2xl bg-gradient-to-r from-orange-500 to-pink-500 text-white hover:from-orange-600 hover:to-pink-600"
                    onClick={handleSaveExercise}
                  >
                    {t.common.save}
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={Boolean(selectedRecipeId && selectedRecipe)} onOpenChange={(open) => !open && setSelectedRecipeId(null)}>
            <DialogContent
              className={`h-[calc(100dvh-1rem)] max-h-none sm:h-[calc(100dvh-1.5rem)] lg:h-[calc(100dvh-2rem)] ${buildResponsiveModalClass("lg:w-[calc(100vw-3rem)] lg:max-w-[1480px]")}`}
            >
              <div className="grid h-full grid-cols-1 grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-4 sm:p-5 lg:p-6">
                <div className="mb-3">
                  <DialogHeader className={ANCLORA_MODAL_HEADER_CLASS}>
                    <DialogTitle className="line-clamp-2 break-words leading-snug">{selectedRecipe?.name ?? t.admin.recipeQueueTitle}</DialogTitle>
                    <DialogDescription>{t.admin.recipeEditorDesc}</DialogDescription>
                  </DialogHeader>
                </div>

                <div className="mb-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-800/80 dark:bg-slate-900/70">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="rounded-full px-3 py-1">
                      {t.admin.currentScore}: {selectedRecipe?.editorial?.qualityScore ?? 0}%
                    </Badge>
                    <Badge className="rounded-full border-0 bg-slate-900/5 text-slate-700 dark:bg-white/10 dark:text-slate-200">
                      {editorialStatusLabel(selectedRecipe?.editorial?.editorialStatus)}
                    </Badge>
                    {!selectedRecipe?.editorial?.checks.hasImage ? <Badge variant="destructive" className="rounded-full">{t.admin.missingImage}</Badge> : null}
                    {!selectedRecipe?.editorial?.checks.hasEnoughInstructions ? <Badge variant="destructive" className="rounded-full">{t.admin.weakInstructions}</Badge> : null}
                    {!selectedRecipe?.editorial?.checks.hasTags ? <Badge variant="destructive" className="rounded-full">{t.admin.fewTags}</Badge> : null}
                    {!selectedRecipe?.editorial?.checks.hasMacros ? <Badge variant="destructive" className="rounded-full">{t.admin.missingMacros}</Badge> : null}
                  </div>
                </div>

                <div data-slot="editor-scroll-body" className="flex min-h-0 flex-col gap-3 overflow-y-auto [&>*]:shrink-0 lg:grid lg:content-start lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
                  <div className="grid min-h-0 gap-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{t.admin.description}</Label>
                        <Textarea
                          value={recipeForm.description}
                          onChange={(event) => setRecipeForm((current) => ({ ...current, description: event.target.value }))}
                          className="h-[88px] resize-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t.admin.tagsOnePerLine}</Label>
                        <Textarea
                          value={recipeForm.tags}
                          onChange={(event) => setRecipeForm((current) => ({ ...current, tags: event.target.value }))}
                          className="h-[88px] resize-none"
                        />
                      </div>
                    </div>
                    <div className="min-h-0 space-y-2">
                      <Label>{t.admin.instructionsOnePerLine}</Label>
                      <Textarea
                        value={recipeForm.instructions}
                        onChange={(event) => setRecipeForm((current) => ({ ...current, instructions: event.target.value }))}
                        className="h-[170px] overflow-y-auto resize-none lg:h-[190px]"
                      />
                    </div>
                  </div>

                  <div className="grid content-start gap-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{language === "es" ? "Estado editorial" : "Editorial status"}</Label>
                        <select
                          value={recipeForm.editorialOverrideStatus}
                          onChange={(event) => setRecipeForm((current) => ({ ...current, editorialOverrideStatus: event.target.value }))}
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                        >
                          <option value="ready">{editorialStatusLabel("ready")}</option>
                          <option value="review">{editorialStatusLabel("review")}</option>
                          <option value="needs_work">{editorialStatusLabel("needs_work")}</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>{language === "es" ? "Notas editoriales" : "Editorial notes"}</Label>
                        <Textarea
                          value={recipeForm.editorialNotes}
                          onChange={(event) => setRecipeForm((current) => ({ ...current, editorialNotes: event.target.value }))}
                          className="h-24 resize-none"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{t.admin.difficulty}</Label>
                      <Input value={recipeForm.difficulty} onChange={(event) => setRecipeForm((current) => ({ ...current, difficulty: event.target.value }))} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{t.admin.prepTime}</Label>
                        <Input type="number" value={recipeForm.prepTime} onChange={(event) => setRecipeForm((current) => ({ ...current, prepTime: event.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t.admin.cookTime}</Label>
                        <Input type="number" value={recipeForm.cookTime} onChange={(event) => setRecipeForm((current) => ({ ...current, cookTime: event.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t.admin.calories}</Label>
                        <Input type="number" value={recipeForm.calories} onChange={(event) => setRecipeForm((current) => ({ ...current, calories: event.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t.admin.protein}</Label>
                        <Input type="number" value={recipeForm.protein} onChange={(event) => setRecipeForm((current) => ({ ...current, protein: event.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t.admin.carbs}</Label>
                        <Input type="number" value={recipeForm.carbs} onChange={(event) => setRecipeForm((current) => ({ ...current, carbs: event.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t.admin.fat}</Label>
                        <Input type="number" value={recipeForm.fat} onChange={(event) => setRecipeForm((current) => ({ ...current, fat: event.target.value }))} />
                      </div>
                    </div>
                  </div>
                </div>

                <DialogFooter className={`mt-3 ${ANCLORA_MODAL_ACTIONS_CLASS}`}>
                  <Button
                    variant="outline"
                    className={ANCLORA_MODAL_SECONDARY_ACTION_CLASS}
                    onClick={() => setSelectedRecipeId(null)}
                  >
                    {t.common.cancel}
                  </Button>
                  <Button
                    disabled={isUpdatingRecipe}
                    className="h-10 rounded-2xl bg-gradient-to-r from-orange-500 to-pink-500 text-white hover:from-orange-600 hover:to-pink-600"
                    onClick={handleSaveRecipe}
                  >
                    {t.common.save}
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}

export default function AdminContentPage() {
  return (
    <ProtectedDashboardPage>
      <AdminContentInner />
    </ProtectedDashboardPage>
  )
}
