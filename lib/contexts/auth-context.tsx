"use client"

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { profileApi } from "@/lib/api"
import { authApi, type User } from "@/lib/api/auth"
import { ApiError, apiClient } from "@/lib/api/client"
import {
  buildRecommendedPlan,
  getProfileStorageKey,
  mergeUserProfile,
  type UserProfile,
} from "@/lib/user-profile"

interface AuthContextType {
  user: User | null
  profile: UserProfile
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, fullName: string) => Promise<void>
  updateProfile: (nextProfile: Partial<UserProfile>) => Promise<void>
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function normalizeProfile(source?: Partial<UserProfile> | null) {
  const mergedProfile = mergeUserProfile(source)
  mergedProfile.recommendedPlan = buildRecommendedPlan(mergedProfile)
  return mergedProfile
}

function hasPersistedProfileData(source?: Partial<UserProfile> | null) {
  if (!source) {
    return false
  }

  const { recommendedPlan: _recommendedPlan, ...persistedFields } = source
  return Object.values(persistedFields).some((value) => value !== null && value !== undefined && value !== "")
}

function readLegacyProfile(userId: string) {
  if (typeof window === "undefined") {
    return null
  }

  const stored = window.localStorage.getItem(getProfileStorageKey(userId))
  if (!stored) {
    return null
  }

  try {
    return mergeUserProfile(JSON.parse(stored))
  } catch {
    return null
  }
}

/** Only a definitive server rejection of the session (401) invalidates it. 5xx, network errors and aborts do not. */
function isRejectedSession(error: unknown) {
  return error instanceof ApiError && error.status === 401
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile>(mergeUserProfile())
  const [isLoading, setIsLoading] = useState(true)
  const hasCheckedSession = useRef(false)

  /**
   * Loads (and, if needed, migrates) the profile of `nextUser`. `isStale()` tells whether the session identity this
   * work was started for is still the active one; it is re-evaluated after every await and BEFORE every effect
   * (state publication, legacy migration request, legacy key removal). An operation of an older identity is inert.
   */
  const loadProfile = async (nextUser: User | null, isStale: () => boolean = () => false) => {
    if (!nextUser) {
      setProfile(mergeUserProfile())
      return
    }

    const remoteProfile = await profileApi.get()
    if (isStale()) return
    const legacyProfile = readLegacyProfile(nextUser.id)

    if (!hasPersistedProfileData(remoteProfile) && hasPersistedProfileData(legacyProfile)) {
      // The update below is sent with whatever credentials the client holds NOW: identity must still be ours.
      if (isStale()) return
      const migratedProfile = await profileApi.update({
        avatarDataUrl: legacyProfile?.avatarDataUrl ?? null,
        sex: legacyProfile?.sex ?? null,
        age: legacyProfile?.age ?? null,
        heightCm: legacyProfile?.heightCm ?? null,
        weightKg: legacyProfile?.weightKg ?? null,
        targetWeightKg: legacyProfile?.targetWeightKg ?? null,
        timeframeWeeks: legacyProfile?.timeframeWeeks ?? null,
        trainingDaysPerWeek: legacyProfile?.trainingDaysPerWeek ?? null,
        trainingGoal: legacyProfile?.trainingGoal ?? null,
        preferredTrainingEnvironment: legacyProfile?.preferredTrainingEnvironment ?? null,
        experienceLevel: legacyProfile?.experienceLevel ?? null,
        limitations: legacyProfile?.limitations ?? [],
        onboardingCompletedAt: legacyProfile?.onboardingCompletedAt ?? null,
      })

      // The request was built and sent under our identity, so the legacy copy of THIS user is migrated:
      // consuming it is correct even if the session changed while the answer was in flight.
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(getProfileStorageKey(nextUser.id))
      }
      if (isStale()) return

      setProfile(normalizeProfile(migratedProfile))
      return
    }

    setProfile(normalizeProfile(remoteProfile))
  }

  useEffect(() => {
    if (hasCheckedSession.current) {
      return
    }

    hasCheckedSession.current = true

    const checkSession = async () => {
      const token = localStorage.getItem("accessToken")
      if (!token) {
        setIsLoading(false)
        return
      }

      // Session identity of THIS check = the client's session generation at its start (login/logout/discard bump it).
      const generation = apiClient.getSessionGeneration()
      // Stale = another login/logout in this tab, OR another tab replaced the shared credentials with a different identity.
      const isStale = () => apiClient.getSessionGeneration() !== generation || apiClient.hasIdentityDrifted()
      const refreshTokenAtStart = localStorage.getItem("refreshToken")

      // 1) Is the SESSION valid? Only this step may end it, and only on a definitive 401.
      let currentUser: User
      try {
        currentUser = await authApi.getCurrentUser()
      } catch (error) {
        // A check of an older identity is inert: no state, no warnings, no loading flag, no discard.
        if (isStale()) return
        if (isRejectedSession(error)) {
          authApi.discardRejectedSession(refreshTokenAtStart, "auth-context.checkSession.me")
          setUser(null)
          setProfile(mergeUserProfile())
        } else {
          // server error, network failure or abort: the session may be perfectly valid. Keep tokens and server session.
          console.warn("[auth] session check inconclusive; session kept", {
            kind: error instanceof ApiError ? `http_${error.status}` : error instanceof Error ? error.name : "unknown",
          })
        }
        setIsLoading(false)
        return
      }

      if (isStale()) return
      setUser(currentUser)

      // 2) The PROFILE is a separate concern: its failure never touches the session.
      try {
        await loadProfile(currentUser, isStale)
      } catch (error) {
        if (isStale()) return
        console.warn("[auth] profile load failed; session kept", {
          kind: error instanceof ApiError ? `http_${error.status}` : error instanceof Error ? error.name : "unknown",
        })
      }
      if (!isStale()) setIsLoading(false)
    }

    checkSession()
  }, [])

  const login = async (email: string, password: string) => {
    const response = await authApi.login({ email, password })
    // storeSession already moved the client to the new session generation; any older check is now inert.
    const generation = apiClient.getSessionGeneration()

    localStorage.setItem("refreshToken", response.refreshToken)
    setUser(response.user)
    setIsLoading(false)
    await loadProfile(response.user, () => apiClient.getSessionGeneration() !== generation || apiClient.hasIdentityDrifted())
  }

  const signup = async (email: string, password: string, fullName: string) => {
    const response = await authApi.register({ email, password, fullName })
    const generation = apiClient.getSessionGeneration()

    localStorage.setItem("refreshToken", response.refreshToken)
    setUser(response.user)
    setIsLoading(false)
    await loadProfile(response.user, () => apiClient.getSessionGeneration() !== generation || apiClient.hasIdentityDrifted())
  }

  const updateProfile = async (nextProfile: Partial<UserProfile>) => {
    const { recommendedPlan: _recommendedPlan, ...persistedFields } = nextProfile

    if (!user) {
      setProfile((currentProfile) => normalizeProfile({ ...currentProfile, ...persistedFields }))
      return
    }

    const updatedProfile = await profileApi.update(persistedFields)
    setProfile(normalizeProfile(updatedProfile))

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(getProfileStorageKey(user.id))
    }
  }

  const logout = () => {
    authApi.logout({ reason: "user_action", origin: "auth-context.logout" })
    setIsLoading(false)
    setUser(null)
    setProfile(mergeUserProfile())
  }

  return (
    <AuthContext.Provider value={{ user, profile, login, signup, updateProfile, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
