"use client"

import { Github, Mail } from "lucide-react"
import { useLanguage } from "@/lib/contexts/language-context"
import { isGithubAuthEnabled, isGoogleAuthEnabled, signInWithGithub, signInWithGoogle } from "@/lib/auth/oauth"

export function SocialAuthButtons() {
  const { t } = useLanguage()
  return <div className="grid grid-cols-2 gap-2" aria-label={t.auth.socialAccess}>
    <button type="button" disabled={!isGoogleAuthEnabled()} title={isGoogleAuthEnabled() ? undefined : t.auth.socialComingSoon} onClick={signInWithGoogle} className="flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-orange-200/50 text-xs font-medium text-gray-600 hover:bg-orange-50/60 disabled:cursor-not-allowed disabled:opacity-50 dark:border-orange-400/10 dark:text-gray-300 dark:hover:bg-orange-400/5"><Mail size={14} aria-hidden="true" />{t.auth.google}</button>
    <button type="button" disabled={!isGithubAuthEnabled()} title={isGithubAuthEnabled() ? undefined : t.auth.socialComingSoon} onClick={signInWithGithub} className="flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-orange-200/50 text-xs font-medium text-gray-600 hover:bg-orange-50/60 disabled:cursor-not-allowed disabled:opacity-50 dark:border-orange-400/10 dark:text-gray-300 dark:hover:bg-orange-400/5"><Github size={14} aria-hidden="true" />{t.auth.github}</button>
  </div>
}
