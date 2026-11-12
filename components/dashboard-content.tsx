"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { Dumbbell, TrendingUp, Calendar, Play, Plus, Trophy, Target, Clock, Activity, Loader2, Apple, ArrowRight, CheckCircle2, Flame, Bell, Sparkles } from "lucide-react"
import { useProgress } from "@/hooks/use-progress"
import { useMealPlans, useNutritionSummary } from "@/hooks/use-nutrition"
import { useWorkouts } from "@/hooks/use-workouts"
import { useAuth } from "@/lib/contexts/auth-context"
import { useLanguage } from "@/lib/contexts/language-context"
import { uiMotion } from "@/lib/ui-motion"
import { cn } from "@/lib/utils"
import { buildRecommendedPlan, getProfileCompletion } from "@/lib/user-profile"
import { OnboardingDialog } from "@/components/onboarding-dialog"
import { buildDismissedNudgeKey, trackProductEvent } from "@/lib/product-events"
import { engagementApi, type EngagementNudge } from "@/lib/api"

export function DashboardContent() {
  const { profile, user, updateProfile } = useAuth()
  const { progress, isLoading } = useProgress()
  const { data: nutritionSummary, isLoading: isNutritionLoading } = useNutritionSummary("day")
  const { mealPlans } = useMealPlans()
  const { workouts } = useWorkouts()
  const { t, language } = useLanguage()
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const [draftWorkoutId, setDraftWorkoutId] = useState<string | null>(null)
  const [isSavingReminders, setIsSavingReminders] = useState(false)
  const [nudges, setNudges] = useState<EngagementNudge[]>([])
  const [isLoadingNudges, setIsLoadingNudges] = useState(true)
  const hasBackfilledOnboardingRef = useRef(false)
  const [reminderDraft, setReminderDraft] = useState({
    remindersEnabled: true,
    reminderTime: "20:00",
    reminderWorkout: true,
    reminderNutrition: true,
    reminderWeeklyReview: true,
    reminderReactivation: true,
  })

  const stats = progress?.stats || {
    totalWorkouts: 0,
    workoutsThisWeek: 0,
    workoutsThisMonth: 0,
    avgDuration: 0,
    personalRecords: [],
  }
  const hasNutritionData = Boolean(nutritionSummary && nutritionSummary.logCount > 0)
  const latestMealPlan = mealPlans[0]
  const nutritionCalories = nutritionSummary?.totals.calories ?? 0
  const nutritionProtein = Math.round(nutritionSummary?.totals.protein ?? 0)
  const showGettingStarted = stats.totalWorkouts === 0
  const progressInsights = progress?.insights
  const profileCompletion = useMemo(() => getProfileCompletion(profile), [profile])
  const localizedRecommendedPlan = useMemo(() => buildRecommendedPlan(profile, language === "es" ? "es" : "en"), [profile, language])
  const latestWorkout = workouts[0] ?? null
  const weeklyTarget = progressInsights?.weeklyTarget ?? profile.trainingDaysPerWeek ?? null
  const weeklyConsistency = progressInsights?.adherenceRate ? Math.round(progressInsights.adherenceRate * 100) : 0
  const nutritionConsistency = progressInsights?.nutritionConsistencyRate ? Math.round(progressInsights.nutritionConsistencyRate * 100) : 0
  const needsOnboarding = !profileCompletion.isComplete

  useEffect(() => {
    if (!user || workouts.length === 0) {
      setDraftWorkoutId(null)
      return
    }

    const foundDraft = workouts.find((workout) =>
      typeof window !== "undefined" &&
      window.localStorage.getItem(`anclora-active-workout:${user.id}:${workout.id}`),
    )

    setDraftWorkoutId(foundDraft?.id ?? null)
  }, [user, workouts])

  useEffect(() => {
    if (needsOnboarding) {
      setOnboardingOpen(true)
    }
  }, [needsOnboarding])

  useEffect(() => {
    if (!user || profile.onboardingCompletedAt || !profileCompletion.isComplete || hasBackfilledOnboardingRef.current) {
      return
    }

    hasBackfilledOnboardingRef.current = true
    void updateProfile({ onboardingCompletedAt: new Date().toISOString() })
  }, [profile.onboardingCompletedAt, profileCompletion.isComplete, updateProfile, user])

  useEffect(() => {
    setReminderDraft({
      remindersEnabled: profile.remindersEnabled ?? true,
      reminderTime: profile.reminderTime ?? "20:00",
      reminderWorkout: profile.reminderWorkout ?? true,
      reminderNutrition: profile.reminderNutrition ?? true,
      reminderWeeklyReview: profile.reminderWeeklyReview ?? true,
      reminderReactivation: profile.reminderReactivation ?? true,
    })
  }, [
    profile.remindersEnabled,
    profile.reminderTime,
    profile.reminderWorkout,
    profile.reminderNutrition,
    profile.reminderWeeklyReview,
    profile.reminderReactivation,
  ])

  const primaryAction = needsOnboarding
    ? {
        href: null,
        label: language === "es" ? "Completar onboarding" : "Complete onboarding",
        description:
          language === "es"
            ? "Rellena tu perfil para desbloquear recomendaciones y un dashboard más útil."
            : "Complete your profile to unlock better recommendations and a more useful dashboard.",
        icon: CheckCircle2,
        onClick: () => setOnboardingOpen(true),
      }
    : draftWorkoutId
      ? {
          href: `/workouts/${draftWorkoutId}/start`,
          label: language === "es" ? "Reanudar entrenamiento" : "Resume workout",
          description:
            language === "es"
              ? "Tienes una sesión guardada parcialmente y lista para continuar."
              : "You have a partially saved session ready to resume.",
          icon: Play,
          onClick: undefined,
        }
      : latestWorkout
        ? {
            href: `/workouts/${latestWorkout.id}/start`,
            label: language === "es" ? "Empezar entrenamiento" : "Start workout",
            description:
              language === "es"
                ? "Tu siguiente mejor acción es ejecutar el plan más reciente."
                : "Your next best action is to run your most recent plan.",
            icon: Flame,
            onClick: undefined,
          }
        : {
            href: "/workouts/generate",
            label: language === "es" ? "Generar entrenamiento" : "Generate workout",
            description:
              language === "es"
                ? "No tienes un plan activo. Genera uno adaptado a tu perfil."
                : "You do not have an active plan yet. Generate one for your profile.",
            icon: Plus,
            onClick: undefined,
          }
  const PrimaryActionIcon = primaryAction.icon
  const latestRecommendation = latestWorkout?.explanation ?? latestMealPlan?.explanation ?? null
  const saveReminderPreferences = async () => {
    setIsSavingReminders(true)
    try {
      await updateProfile(reminderDraft)
      await trackProductEvent({
        action: "reminder_preferences_updated",
        category: "engagement",
        source: "dashboard",
        metadata: reminderDraft,
      })
    } finally {
      setIsSavingReminders(false)
    }
  }

  useEffect(() => {
    if (!user) {
      setNudges([])
      setIsLoadingNudges(false)
      return
    }

    let isMounted = true
    const loadNudges = async () => {
      setIsLoadingNudges(true)
      try {
        const response = await engagementApi.getNudges()
        const activeNudges = response.nudges.filter((nudge) => {
          if (typeof window === "undefined") {
            return true
          }
          return !window.localStorage.getItem(buildDismissedNudgeKey(user.id, nudge.id))
        })

        if (isMounted) {
          setNudges(activeNudges)
        }
      } finally {
        if (isMounted) {
          setIsLoadingNudges(false)
        }
      }
    }

    void loadNudges()
    return () => {
      isMounted = false
    }
  }, [user, profile.remindersEnabled, profile.reminderTime, profile.reminderWorkout, profile.reminderNutrition, profile.reminderWeeklyReview, profile.reminderReactivation])

  const dismissNudge = async (nudge: EngagementNudge) => {
    if (!user || typeof window === "undefined") return
    window.localStorage.setItem(buildDismissedNudgeKey(user.id, nudge.id), "1")
    setNudges((current) => current.filter((item) => item.id !== nudge.id))
    await trackProductEvent({
      action: "nudge_dismissed",
      category: "engagement",
      source: "dashboard_nudges",
      metadata: { nudgeId: nudge.id, kind: nudge.kind, priority: nudge.priority },
    })
  }

  const handleNudgeClick = async (nudge: EngagementNudge) => {
    await trackProductEvent({
      action: "nudge_clicked",
      category: "engagement",
      source: "dashboard_nudges",
      metadata: { nudgeId: nudge.id, kind: nudge.kind, priority: nudge.priority, href: nudge.href },
    })
  }

  const priorityLabel = (priority: EngagementNudge["priority"]) => {
    if (priority === "high") return t.dashboard.highPriority
    if (priority === "medium") return t.dashboard.mediumPriority
    return t.dashboard.lowPriority
  }

  const interpolate = (template: string, values: Record<string, string | number | boolean | null | undefined>) =>
    Object.entries(values).reduce(
      (current, [key, value]) => current.replace(`{{${key}}}`, String(value ?? "")),
      template,
    )

  const resolveNudgeCopy = (nudge: EngagementNudge) => {
    switch (nudge.kind) {
      case "onboarding":
        return {
          title: t.dashboard.nudgeOnboardingTitle,
          body: t.dashboard.nudgeOnboardingBody,
          ctaLabel: t.dashboard.nudgeOnboardingCta,
          reason: interpolate(t.dashboard.nudgeReasonOnboarding, {
            count: nudge.context?.missingFieldsCount ?? 0,
          }),
        }
      case "workout":
        return {
          title: t.dashboard.nudgeWorkoutTitle,
          body: t.dashboard.nudgeWorkoutBody,
          ctaLabel: t.dashboard.nudgeWorkoutCta,
          reason: interpolate(t.dashboard.nudgeReasonWorkout, {
            done: nudge.context?.workoutsLast7Days ?? 0,
            target: nudge.context?.weeklyTarget ?? 0,
          }),
        }
      case "nutrition":
        return {
          title: t.dashboard.nudgeNutritionTitle,
          body: t.dashboard.nudgeNutritionBody,
          ctaLabel: t.dashboard.nudgeNutritionCta,
          reason: t.dashboard.nudgeReasonNutrition,
        }
      case "weekly_review":
        return {
          title: t.dashboard.nudgeWeeklyTitle,
          body: t.dashboard.nudgeWeeklyBody,
          ctaLabel: t.dashboard.nudgeWeeklyCta,
          reason:
            nudge.context?.stagnationRisk === "high"
              ? t.dashboard.nudgeReasonWeeklyHigh
              : t.dashboard.nudgeReasonWeeklyLow,
        }
      case "reactivation":
        return {
          title: t.dashboard.nudgeReactivationTitle,
          body: t.dashboard.nudgeReactivationBody,
          ctaLabel: nudge.context?.hasWorkout ? t.dashboard.nudgeReactivationCtaWorkout : t.dashboard.nudgeReactivationCtaDashboard,
          reason: t.dashboard.nudgeReasonReactivation,
        }
      default:
        return {
          title: "",
          body: "",
          ctaLabel: "",
          reason: "",
        }
    }
  }

  const quickActions = [
    {
      href: "/workouts/generate",
      title: t.dashboard.startWorkout,
      description: t.dashboard.startWorkoutDesc,
      cta: t.dashboard.startNow,
      icon: Play,
      className: "from-orange-500 to-red-500",
      textClassName: "text-orange-100",
    },
    {
      href: "/exercises",
      title: t.dashboard.exerciseLibrary,
      description: t.dashboard.exerciseLibraryDesc,
      cta: t.dashboard.viewExercises,
      icon: Dumbbell,
      className: "from-blue-500 to-cyan-500",
      textClassName: "text-blue-100",
    },
    {
      href: "/progress",
      title: t.dashboard.viewProgress,
      description: t.dashboard.viewProgressDesc,
      cta: t.dashboard.viewProgress,
      icon: TrendingUp,
      className: "from-purple-500 to-pink-500",
      textClassName: "text-purple-100",
    },
    {
      href: "/nutrition",
      title: t.dashboard.nutritionHub,
      description: latestMealPlan ? t.dashboard.nutritionHubPlanDesc : t.dashboard.nutritionHubEmptyDesc,
      cta: latestMealPlan ? t.dashboard.viewNutrition : t.dashboard.startNutrition,
      icon: Apple,
      className: "from-emerald-500 to-teal-500",
      textClassName: "text-emerald-100",
    },
  ]

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">{t.dashboard.loading}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5 p-3 sm:gap-3 sm:p-4 lg:gap-2">
      <OnboardingDialog open={onboardingOpen} onOpenChange={setOnboardingOpen} />

      <Card className="ui-motion-card-subtle border-0 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-white shadow-xl">
        <CardContent className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)] lg:items-center">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full border-0 bg-white/12 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white">
                {language === "es" ? "Centro de acción" : "Action hub"}
              </Badge>
              <Badge className="rounded-full border-0 bg-orange-500/20 px-3 py-1 text-[11px] text-orange-100">
                {weeklyTarget ? `${stats.workoutsThisWeek}/${weeklyTarget} ${language === "es" ? "sesiones esta semana" : "sessions this week"}` : (language === "es" ? "Sin objetivo semanal" : "No weekly target")}
              </Badge>
            </div>

            <div>
              <h3 className="text-2xl font-semibold tracking-tight">
                {needsOnboarding
                  ? language === "es"
                    ? "Completa tu base para activar la personalización real"
                    : "Complete your base profile to unlock real personalization"
                  : language === "es"
                    ? "Tu siguiente mejor acción ya está preparada"
                    : "Your next best action is ready"}
              </h3>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                {primaryAction.description}
              </p>
            </div>

            {primaryAction.href ? (
              <Button asChild className="h-11 rounded-2xl bg-gradient-to-r from-orange-500 to-pink-500 px-5 text-sm font-semibold hover:from-orange-600 hover:to-pink-600">
                <Link href={primaryAction.href}>
                  <PrimaryActionIcon className="mr-2 h-4 w-4" />
                  {primaryAction.label}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button onClick={primaryAction.onClick} className="h-11 rounded-2xl bg-gradient-to-r from-orange-500 to-pink-500 px-5 text-sm font-semibold hover:from-orange-600 hover:to-pink-600">
                <PrimaryActionIcon className="mr-2 h-4 w-4" />
                {primaryAction.label}
              </Button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {language === "es" ? "Perfil" : "Profile"}
              </p>
              <p className="mt-2 text-3xl font-semibold">{profileCompletion.percentage}%</p>
              <Progress value={profileCompletion.percentage} className="mt-3 h-2.5 bg-white/10" />
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {language === "es" ? "Adherencia semanal" : "Weekly adherence"}
              </p>
              <p className="mt-2 text-3xl font-semibold">{weeklyConsistency}%</p>
              <p className="mt-2 text-xs text-slate-300">
                {language === "es"
                  ? "Mide si tu ritmo reciente coincide con el objetivo semanal."
                  : "Measures whether your recent pace matches your weekly target."}
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {language === "es" ? "Registro nutricional" : "Nutrition logging"}
              </p>
              <p className="mt-2 text-3xl font-semibold">{nutritionConsistency}%</p>
              <p className="mt-2 text-xs text-slate-300">
                {language === "es"
                  ? "Días con registros en la última semana."
                  : "Days with logs during the last week."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5 lg:gap-2 lg:flex-none">
        <Card className="min-w-0 min-h-[86px] border-0 bg-gradient-to-br from-blue-50 to-cyan-50 py-0 shadow-lg dark:from-blue-900/20 dark:to-cyan-900/20 lg:min-h-[78px]">
          <CardHeader className="gap-1 px-4 pb-1 pt-3 lg:px-3 lg:pb-0.5 lg:pt-2.5">
            <CardTitle className="flex min-w-0 items-center gap-2 text-[0.74rem] leading-tight md:text-[0.82rem]">
              <Activity className="h-3.5 w-3.5 text-blue-500" />
              <span className="line-clamp-2">{t.dashboard.totalWorkouts}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pt-0 pb-3 lg:px-3 lg:pb-2.5">
            <div className="text-[1.25rem] font-bold leading-none text-gray-900 dark:text-white md:text-[1.45rem] lg:text-[1.15rem]">{stats.totalWorkouts}</div>
            <p className="text-xs text-gray-600 dark:text-gray-400">{stats.workoutsThisWeek} {t.dashboard.thisWeek}</p>
          </CardContent>
        </Card>

        <Card className="min-w-0 min-h-[86px] border-0 bg-gradient-to-br from-green-50 to-emerald-50 py-0 shadow-lg dark:from-green-900/20 dark:to-emerald-900/20 lg:min-h-[78px]">
          <CardHeader className="gap-1 px-4 pb-1 pt-3 lg:px-3 lg:pb-0.5 lg:pt-2.5">
            <CardTitle className="flex min-w-0 items-center gap-2 text-[0.74rem] leading-tight md:text-[0.82rem]">
              <Clock className="h-3.5 w-3.5 text-green-500" />
              <span className="line-clamp-2">{t.dashboard.avgWorkoutTime}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pt-0 pb-3 lg:px-3 lg:pb-2.5">
            <div className="text-[1.25rem] font-bold leading-none text-gray-900 dark:text-white md:text-[1.45rem] lg:text-[1.15rem]">
              {Math.round(stats.avgDuration / 60)}min
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">{t.dashboard.perWorkout}</p>
          </CardContent>
        </Card>

        <Card className="min-w-0 min-h-[86px] border-0 bg-gradient-to-br from-yellow-50 to-orange-50 py-0 shadow-lg dark:from-yellow-900/20 dark:to-orange-900/20 lg:min-h-[78px]">
          <CardHeader className="gap-1 px-4 pb-1 pt-3 lg:px-3 lg:pb-0.5 lg:pt-2.5">
            <CardTitle className="flex min-w-0 items-center gap-2 text-[0.74rem] leading-tight md:text-[0.82rem]">
              <Trophy className="h-3.5 w-3.5 text-yellow-500" />
              <span className="line-clamp-2">{t.dashboard.personalRecords}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pt-0 pb-3 lg:px-3 lg:pb-2.5">
            <div className="text-[1.25rem] font-bold leading-none text-gray-900 dark:text-white md:text-[1.45rem] lg:text-[1.15rem]">{stats.personalRecords.length}</div>
            <p className="text-xs text-gray-600 dark:text-gray-400">{t.dashboard.achievementsLabel}</p>
          </CardContent>
        </Card>

        <Card className="min-w-0 min-h-[86px] border-0 bg-gradient-to-br from-purple-50 to-pink-50 py-0 shadow-lg dark:from-purple-900/20 dark:to-pink-900/20 lg:min-h-[78px]">
          <CardHeader className="gap-1 px-4 pb-1 pt-3 lg:px-3 lg:pb-0.5 lg:pt-2.5">
            <CardTitle className="flex min-w-0 items-center gap-2 text-[0.74rem] leading-tight md:text-[0.82rem]">
              <Calendar className="h-3.5 w-3.5 text-purple-500" />
              <span className="line-clamp-2">{t.dashboard.thisMonth}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pt-0 pb-3 lg:px-3 lg:pb-2.5">
            <div className="text-[1.25rem] font-bold leading-none text-gray-900 dark:text-white md:text-[1.45rem] lg:text-[1.15rem]">{stats.workoutsThisMonth}</div>
            <p className="text-xs text-gray-600 dark:text-gray-400">{t.dashboard.thisMonthWorkouts}</p>
          </CardContent>
        </Card>

        <Card className="min-w-0 min-h-[86px] border-0 bg-gradient-to-br from-emerald-50 to-lime-50 py-0 shadow-lg dark:from-emerald-900/20 dark:to-lime-900/20 lg:min-h-[78px]">
          <CardHeader className="gap-1 px-4 pb-1 pt-3 lg:px-3 lg:pb-0.5 lg:pt-2.5">
            <CardTitle className="flex min-w-0 items-center gap-2 text-[0.74rem] leading-tight md:text-[0.82rem]">
              <Apple className="h-3.5 w-3.5 text-emerald-500" />
              <span className="line-clamp-2">{t.dashboard.nutritionToday}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pt-0 pb-3 lg:px-3 lg:pb-2.5">
            <div className="text-[1.25rem] font-bold leading-none text-gray-900 dark:text-white md:text-[1.45rem] lg:text-[1.15rem]">
              {isNutritionLoading ? "..." : nutritionCalories}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {hasNutritionData ? `${nutritionProtein}g ${t.dashboard.proteinLabel}` : t.dashboard.noMealsLogged}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-4 lg:gap-2 lg:flex-none">
        {quickActions.map((action) => {
          const Icon = action.icon
          return (
            <Card key={action.href} className={`min-w-0 min-h-[102px] border-0 bg-gradient-to-r ${action.className} py-0 text-white hover:shadow-xl transition-shadow lg:min-h-[96px]`}>
              <CardHeader className="gap-1 px-4 pb-1 pt-3 lg:px-3 lg:pb-0.5 lg:pt-2.5">
                <CardTitle className="flex min-w-0 items-center gap-2 text-[0.88rem] leading-tight lg:text-[0.8rem]">
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{action.title}</span>
                </CardTitle>
                <CardDescription className={cn("line-clamp-2 text-[0.78rem] lg:text-[0.72rem]", action.textClassName)}>
                  {action.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pt-0 pb-3 lg:px-3 lg:pb-2.5">
                <Button asChild variant="secondary" className="h-8 w-full rounded-xl bg-white/20 px-3 text-sm text-white border-0 hover:bg-white/30 lg:h-7 lg:px-2 lg:text-[0.78rem]">
                  <Link href={action.href}>
                    <Icon className="mr-2 h-4 w-4 lg:h-3.5 lg:w-3.5" />
                    {action.cta}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Personal Records */}
      {localizedRecommendedPlan ? (
        <Card className="ui-motion-card-subtle border-0 shadow-lg bg-gradient-to-r from-orange-50 to-rose-50 backdrop-blur-sm dark:from-orange-900/20 dark:to-rose-900/20">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-orange-500" />
                  {localizedRecommendedPlan.title}
                </CardTitle>
                <CardDescription>{localizedRecommendedPlan.summary}</CardDescription>
              </div>
              <Button asChild className="rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600">
                <Link href="/workouts/generate">{t.dashboard.startNow}</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {localizedRecommendedPlan.weeklySplit.map((session) => (
              <div key={session} className={cn("rounded-2xl bg-white/75 p-4 text-sm text-slate-700 shadow-sm dark:bg-slate-950/45 dark:text-slate-200", uiMotion.frame)}>
                {session}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.95fr)]">
        <Card className="ui-motion-card-subtle border-0 bg-white/80 shadow-lg backdrop-blur-sm dark:bg-gray-800/80">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-orange-500" />
                  {t.dashboard.remindersTitle}
                </CardTitle>
                <CardDescription>{t.dashboard.remindersDesc}</CardDescription>
              </div>
              <Badge variant="secondary" className="rounded-xl px-3 py-1">
                {reminderDraft.remindersEnabled ? t.dashboard.remindersActive : t.dashboard.remindersPaused}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                ["reminderWorkout", t.dashboard.reminderWorkout],
                ["reminderNutrition", t.dashboard.reminderNutrition],
                ["reminderWeeklyReview", t.dashboard.reminderWeeklyReview],
                ["reminderReactivation", t.dashboard.reminderReactivation],
              ].map(([field, label]) => {
                const isActive = reminderDraft[field as keyof typeof reminderDraft] as boolean
                return (
                  <button
                    key={field}
                    type="button"
                    onClick={() =>
                      setReminderDraft((current) => ({
                        ...current,
                        [field]: !isActive,
                      }))
                    }
                    className={cn(
                      "ui-motion-frame flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors",
                      isActive
                        ? "border-orange-300/70 bg-orange-50 text-orange-900 dark:border-orange-500/30 dark:bg-orange-950/20 dark:text-orange-100"
                        : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300"
                    )}
                  >
                    <span className="text-sm font-medium">{label}</span>
                    <Badge className={cn("rounded-lg", isActive ? "bg-orange-500 text-white" : "bg-slate-600 text-white dark:bg-slate-700")}>
                      {isActive ? t.dashboard.remindersActive : t.dashboard.remindersPaused}
                    </Badge>
                  </button>
                )
              })}
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,180px)_auto] sm:items-end">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {t.dashboard.reminderTimeLabel}
                </label>
                <Input
                  type="time"
                  value={reminderDraft.reminderTime}
                  onChange={(event) =>
                    setReminderDraft((current) => ({
                      ...current,
                      reminderTime: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant={reminderDraft.remindersEnabled ? "outline" : "default"}
                  className="rounded-2xl"
                  onClick={() =>
                    setReminderDraft((current) => ({
                      ...current,
                      remindersEnabled: !current.remindersEnabled,
                    }))
                  }
                >
                  {reminderDraft.remindersEnabled ? t.dashboard.remindersActive : t.dashboard.remindersPaused}
                </Button>
                <Button
                  type="button"
                  className="rounded-2xl bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600"
                  onClick={saveReminderPreferences}
                  disabled={isSavingReminders}
                >
                  {isSavingReminders ? t.dashboard.savingReminders : t.dashboard.saveReminders}
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/50">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{t.dashboard.nudgesTitle}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t.dashboard.nudgesDesc}</p>
              </div>
              <div className="mt-3 space-y-3">
                {!reminderDraft.remindersEnabled ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t.dashboard.reminderPreviewPaused}</p>
                ) : isLoadingNudges ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t.dashboard.nudgesLoading}</p>
                ) : nudges.length > 0 ? (
                  nudges.map((nudge) => (
                    <div key={nudge.id} className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-950/40">
                      {(() => {
                        const copy = resolveNudgeCopy(nudge)
                        return (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-900 dark:text-white">{copy.title}</p>
                            <Badge className={cn(
                              "rounded-full px-2.5 py-0.5 text-[11px]",
                              nudge.priority === "high"
                                ? "bg-red-500 text-white"
                                : nudge.priority === "medium"
                                  ? "bg-orange-500 text-white"
                                  : "bg-slate-600 text-white"
                            )}>
                              {priorityLabel(nudge.priority)}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{copy.body}</p>
                          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            {t.dashboard.nudgeReason}: {copy.reason}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-2 sm:w-[180px]">
                          <Button asChild className="rounded-2xl bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600" onClick={() => void handleNudgeClick(nudge)}>
                            <Link href={nudge.href}>{copy.ctaLabel}</Link>
                          </Button>
                          <Button type="button" variant="outline" className="rounded-2xl" onClick={() => void dismissNudge(nudge)}>
                            {t.dashboard.dismissNudge}
                          </Button>
                        </div>
                      </div>
                        )
                      })()}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t.dashboard.nudgesEmpty}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {latestRecommendation ? (
          <Card className="ui-motion-card-subtle border-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-orange-300" />
                {t.dashboard.latestRecommendation}
              </CardTitle>
              <CardDescription className="text-slate-300">{latestRecommendation.summary}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {t.dashboard.recommendationWhy}
                </p>
                <div className="mt-3 space-y-2">
                  {latestRecommendation.reasons.map((reason) => (
                    <div key={reason} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100">
                      {reason}
                    </div>
                  ))}
                </div>
              </div>
              {latestRecommendation.signals?.length ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  {latestRecommendation.signals.map((signal) => (
                    <div key={`${signal.label}-${signal.value}`} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{signal.label}</p>
                      <p className="mt-2 text-sm font-semibold text-white">{signal.value}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              {latestRecommendation.adjustment ? (
                <div className="rounded-2xl border border-orange-400/20 bg-orange-500/10 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-200">
                    {t.dashboard.recommendationAdjustment}
                  </p>
                  <p className="mt-2 text-sm text-orange-50">{latestRecommendation.adjustment}</p>
                </div>
              ) : null}
              {latestRecommendation.nextBestAction ? (
                <Button asChild className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-pink-500 text-white hover:from-orange-600 hover:to-pink-600">
                  <Link href={latestRecommendation.nextBestAction.href}>
                    {latestRecommendation.nextBestAction.label}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* Personal Records */}
      {stats.personalRecords.length > 0 && (
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm dark:bg-gray-800/80">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-orange-500" />
                  {t.dashboard.recentPersonalRecords}
                </CardTitle>
                <CardDescription>{t.dashboard.bestMarks}</CardDescription>
              </div>
              <Button asChild variant="outline">
                <Link href="/progress">{t.dashboard.viewAll}</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.personalRecords.slice(0, 5).map((record: any) => (
                <div
                  key={record.exercise_id}
                  className={cn("flex items-center justify-between rounded-2xl bg-gray-50 p-4 dark:bg-gray-900/50", uiMotion.frame)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-pink-500 rounded-full flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">{record.exercise_name}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {new Date(record.date).toLocaleDateString(language === "es" ? "es-ES" : "en-US")}
                      </p>
                    </div>
                  </div>
                  <Badge className="text-lg px-4 py-2 bg-gradient-to-r from-orange-500 to-pink-500">
                    {record.max_weight} kg
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Getting Started */}
      {showGettingStarted && (
        <Card className="ui-motion-card-subtle min-h-0 border-0 bg-gradient-to-r from-orange-50 to-pink-50 py-0 shadow-lg dark:from-orange-900/20 dark:to-pink-900/20">
          <CardHeader className="gap-1 px-4 pb-1 pt-3 lg:px-4 lg:pb-0 lg:pt-2.5">
            <CardTitle className="flex items-center gap-2 text-[0.98rem] md:text-[1.02rem] lg:text-[0.96rem]">
              <Target className="h-4 w-4 text-orange-500" />
              {t.dashboard.getStartedTitle}
            </CardTitle>
            <CardDescription className="text-[0.8rem] lg:text-[0.74rem]">{t.dashboard.getStartedDesc}</CardDescription>
          </CardHeader>
          <CardContent className="flex h-full min-h-0 flex-col gap-3 px-4 pt-1 pb-4 lg:grid lg:grid-cols-[minmax(0,1.7fr)_minmax(220px,0.85fr)] lg:grid-rows-[1fr] lg:gap-2 lg:px-4 lg:pb-3">
            <div className="grid min-h-0 grid-cols-1 gap-2.5 sm:grid-cols-2 lg:gap-2">
              <div className={cn("flex min-h-[84px] items-start gap-3 rounded-2xl border border-orange-100/80 bg-white/60 px-4 py-3 dark:border-orange-400/10 dark:bg-slate-900/30 lg:min-h-[72px] lg:px-3 lg:py-2.5", uiMotion.frame)}>
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-orange-500 text-xs font-semibold text-white">1</div>
                <div className="min-w-0">
                  <h4 className="text-[0.9rem] font-semibold leading-tight text-gray-900 dark:text-white lg:text-[0.82rem]">{t.dashboard.stepOneTitle}</h4>
                  <p className="line-clamp-2 text-xs text-gray-600 dark:text-gray-400 lg:text-[0.72rem]">{t.dashboard.stepOneDesc}</p>
                </div>
              </div>
              <div className={cn("flex min-h-[84px] items-start gap-3 rounded-2xl border border-orange-100/80 bg-white/60 px-4 py-3 dark:border-orange-400/10 dark:bg-slate-900/30 lg:min-h-[72px] lg:px-3 lg:py-2.5", uiMotion.frame)}>
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-orange-500 text-xs font-semibold text-white">2</div>
                <div className="min-w-0">
                  <h4 className="text-[0.9rem] font-semibold leading-tight text-gray-900 dark:text-white lg:text-[0.82rem]">{t.dashboard.stepTwoTitle}</h4>
                  <p className="line-clamp-2 text-xs text-gray-600 dark:text-gray-400 lg:text-[0.72rem]">{t.dashboard.stepTwoDesc}</p>
                </div>
              </div>
              <div className={cn("flex min-h-[84px] items-start gap-3 rounded-2xl border border-orange-100/80 bg-white/60 px-4 py-3 dark:border-orange-400/10 dark:bg-slate-900/30 lg:min-h-[72px] lg:px-3 lg:py-2.5", uiMotion.frame)}>
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-orange-500 text-xs font-semibold text-white">3</div>
                <div className="min-w-0">
                  <h4 className="text-[0.9rem] font-semibold leading-tight text-gray-900 dark:text-white lg:text-[0.82rem]">{t.dashboard.stepThreeTitle}</h4>
                  <p className="line-clamp-2 text-xs text-gray-600 dark:text-gray-400 lg:text-[0.72rem]">{t.dashboard.stepThreeDesc}</p>
                </div>
              </div>
              <div className={cn("flex min-h-[84px] items-start gap-3 rounded-2xl border border-orange-100/80 bg-white/60 px-4 py-3 dark:border-orange-400/10 dark:bg-slate-900/30 lg:min-h-[72px] lg:px-3 lg:py-2.5", uiMotion.frame)}>
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-orange-500 text-xs font-semibold text-white">4</div>
                <div className="min-w-0">
                  <h4 className="text-[0.9rem] font-semibold leading-tight text-gray-900 dark:text-white lg:text-[0.82rem]">{t.dashboard.stepFourTitle}</h4>
                  <p className="line-clamp-2 text-xs text-gray-600 dark:text-gray-400 lg:text-[0.72rem]">{t.dashboard.stepFourDesc}</p>
                </div>
              </div>
            </div>
            <div className="grid gap-2.5 lg:grid-rows-2 lg:gap-2">
              <div className={cn("flex min-h-[84px] flex-col justify-between rounded-2xl border border-orange-200/70 bg-white/65 px-4 py-3 dark:border-orange-400/15 dark:bg-slate-900/30 lg:min-h-[72px] lg:px-3 lg:py-2.5", uiMotion.frame)}>
                <div>
                  <h4 className="text-[0.92rem] font-semibold text-gray-900 dark:text-white lg:text-[0.82rem]">{t.dashboard.generateFirstWorkout}</h4>
                  <p className="line-clamp-2 text-xs text-gray-600 dark:text-gray-400 lg:text-[0.72rem]">{t.dashboard.stepTwoDesc}</p>
                </div>
                <Button asChild className="mt-3 h-8 w-full rounded-2xl bg-gradient-to-r from-orange-500 to-pink-500 px-4 text-sm hover:from-orange-600 hover:to-pink-600 lg:mt-2 lg:h-7 lg:px-3 lg:text-[0.78rem]">
                  <Link href="/workouts/generate" className="whitespace-nowrap">
                    <Plus className="mr-2 h-4 w-4 lg:h-3.5 lg:w-3.5" />
                    {t.dashboard.startNow}
                  </Link>
                </Button>
              </div>
              <div className={cn("flex min-h-[84px] flex-col justify-between rounded-2xl border border-emerald-300/70 bg-white/65 px-4 py-3 dark:border-emerald-500/20 dark:bg-slate-900/30 lg:min-h-[72px] lg:px-3 lg:py-2.5", uiMotion.frame)}>
                <div>
                  <h4 className="text-[0.92rem] font-semibold text-gray-900 dark:text-white lg:text-[0.82rem]">{t.dashboard.generateFirstMealPlan}</h4>
                  <p className="line-clamp-2 text-xs text-gray-600 dark:text-gray-400 lg:text-[0.72rem]">{t.dashboard.stepFourDesc}</p>
                </div>
                <Button asChild variant="outline" className="mt-3 h-8 w-full rounded-2xl border-emerald-300/70 bg-white/60 px-4 text-sm text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/30 dark:bg-slate-900/20 dark:text-emerald-300 dark:hover:bg-emerald-950/30 lg:mt-2 lg:h-7 lg:px-3 lg:text-[0.78rem]">
                  <Link href="/nutrition" className="whitespace-nowrap">
                    <Apple className="mr-2 h-4 w-4 lg:h-3.5 lg:w-3.5" />
                    {t.dashboard.viewNutrition}
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
