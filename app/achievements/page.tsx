"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ProtectedDashboardPage } from "@/components/protected-dashboard-page"
import { useGamificationStatus, useAchievements, useXPHistory } from "@/hooks/use-gamification"
import { useLanguage } from "@/lib/contexts/language-context"
import { Trophy, Star, Flame, Zap, Lock, Award, TrendingUp } from "lucide-react"
import { HealthPlanCrossLink } from "@/components/health-plan-cross-link"
import * as LucideIcons from "lucide-react"

function DynamicIcon({ name, className }: { name: string; className?: string }) {
  const IconComponent = (LucideIcons as any)[name]
  if (!IconComponent) return <Star className={className} />
  return <IconComponent className={className} />
}

function AchievementsPageContent() {
  const { language } = useLanguage()
  const t = language === 'es'
  const { data: status, isLoading: statusLoading } = useGamificationStatus()
  const { data: achievements, isLoading: achievementsLoading } = useAchievements()
  const { data: xpHistory } = useXPHistory(10)

  const isLoading = statusLoading || achievementsLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    )
  }

  const unlocked = achievements?.filter((a) => a.unlocked) ?? []
  const locked = achievements?.filter((a) => !a.unlocked) ?? []

  return (
    <div className="space-y-5 px-3 py-4 pb-8 sm:space-y-6 sm:px-5 sm:py-5 lg:px-8">
      <div className="min-w-0">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
          {t ? 'Gamificación' : 'Gamification'}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t ? 'Niveles, XP, rachas y logros desbloqueados' : 'Levels, XP, streaks, and unlocked achievements'}
        </p>
      </div>
      <HealthPlanCrossLink context="gamification" />

      {/* Status Cards */}
      {status && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800">
            <CardContent className="pt-4 text-center">
              <Star className="w-8 h-8 mx-auto text-amber-500 mb-2" />
              <p className="text-3xl font-bold">{status.level}</p>
              <p className="text-xs text-muted-foreground">{t ? 'Nivel' : 'Level'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Zap className="w-8 h-8 mx-auto text-purple-500 mb-2" />
              <p className="text-3xl font-bold">{status.xp.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">XP {t ? 'Total' : 'Total'}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30 border-orange-200 dark:border-orange-800">
            <CardContent className="pt-4 text-center">
              <Flame className="w-8 h-8 mx-auto text-orange-500 mb-2" />
              <p className="text-3xl font-bold">{status.currentStreak}</p>
              <p className="text-xs text-muted-foreground">{t ? 'Racha Actual' : 'Current Streak'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Trophy className="w-8 h-8 mx-auto text-green-500 mb-2" />
              <p className="text-3xl font-bold">{unlocked.length}/{achievements?.length || 0}</p>
              <p className="text-xs text-muted-foreground">{t ? 'Logros' : 'Achievements'}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* XP Progress Bar */}
      {status && (
        <Card>
          <CardContent className="pt-6">
            <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-medium">
                {t ? 'Nivel' : 'Level'} {status.level}
              </span>
              <span className="text-sm text-muted-foreground">
                {status.xpProgress} / {status.xpToNextLevel} XP
              </span>
            </div>
            <Progress value={status.progressPercent} className="h-3" />
            <p className="text-xs text-muted-foreground mt-1 text-right">
              {status.xpToNextLevel - status.xpProgress} XP {t ? 'para nivel' : 'to level'} {status.level + 1}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Unlocked Achievements */}
      {unlocked.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            {t ? 'Desbloqueados' : 'Unlocked'} ({unlocked.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {unlocked.map((achievement) => (
              <Card key={achievement.id} className="border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20">
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0">
                    <DynamicIcon name={achievement.icon} className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{t ? achievement.nameEs : achievement.nameEn}</p>
                    <p className="text-sm text-muted-foreground">{t ? achievement.descEs : achievement.descEn}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">+{achievement.xpReward} XP</Badge>
                      {achievement.unlockedAt && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(achievement.unlockedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Locked Achievements */}
      {locked.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Lock className="w-5 h-5 text-muted-foreground" />
            {t ? 'Por Desbloquear' : 'Locked'} ({locked.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {locked.map((achievement) => (
              <Card key={achievement.id} className="opacity-60">
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-4">
                  <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <Lock className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{t ? achievement.nameEs : achievement.nameEn}</p>
                    <p className="text-sm text-muted-foreground">{t ? achievement.descEs : achievement.descEn}</p>
                    <Badge variant="outline" className="text-xs mt-1">+{achievement.xpReward} XP</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* XP History */}
      {xpHistory && xpHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              {t ? 'Historial de XP' : 'XP History'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {xpHistory.map((event) => (
                <div key={event.id} className="flex flex-col gap-1 py-2 border-b last:border-0 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <span className="text-sm font-medium capitalize">
                      {event.action.replace(/_/g, ' ')}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {new Date(event.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-green-600">+{event.xp} XP</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function AchievementsPage() {
  return (
    <ProtectedDashboardPage>
      <AchievementsPageContent />
    </ProtectedDashboardPage>
  )
}
