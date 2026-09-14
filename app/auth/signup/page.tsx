"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { authApi } from "@/lib/api/auth"
import { BrandLogo } from "@/components/brand-logo"
import { useLanguage } from "@/lib/contexts/language-context"
import { SocialAuthButtons } from "@/components/social-auth-buttons"

export default function SignupPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { t } = useLanguage()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (password !== confirmPassword) {
      setError(t.auth.passwordMismatch || "Passwords do not match")
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setError(t.auth.passwordTooShort || "Password must be at least 6 characters")
      setIsLoading(false)
      return
    }

    try {
      await authApi.register({ email, password, fullName })
      router.replace("/dashboard")
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : t.auth.signupError)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="h-screen overflow-y-auto flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-800 py-4 px-6">
      <div className="w-full max-w-md">
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm dark:bg-gray-900/80">
          <CardHeader className="text-center pb-3 pt-5">
            <BrandLogo size={72} priority className="mx-auto mb-3" />
            <CardTitle className="text-xl font-bold text-gray-900 dark:text-white">
              {t.auth.startJourney || "Comienza Tu Viaje"}
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400 text-xs">
              {t.auth.createAccount || "Crea tu cuenta y empieza a transformar tu fitness"}
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-5">
            <form onSubmit={handleSignup} className="space-y-3" aria-label="Signup form">
              <div className="space-y-1">
                <Label htmlFor="fullName" className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {t.auth.fullName || "Nombre Completo"}
                  <span className="text-red-500" aria-label="required">*</span>
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder={t.auth.fullNamePlaceholder || "Tu nombre completo"}
                  required
                  aria-required="true"
                  aria-describedby="fullName-error"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-9 text-sm border-gray-200 dark:border-gray-700 focus:border-orange-500 dark:focus:border-orange-400"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email" className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {t.auth.email}
                  <span className="text-red-500" aria-label="required">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  required
                  aria-required="true"
                  aria-describedby="email-error"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-9 text-sm border-gray-200 dark:border-gray-700 focus:border-orange-500 dark:focus:border-orange-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="password" className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {t.auth.password}
                    <span className="text-red-500" aria-label="required">*</span>
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mín. 6 caracteres"
                    required
                    aria-required="true"
                    aria-describedby="password-error"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-9 text-sm border-gray-200 dark:border-gray-700 focus:border-orange-500 dark:focus:border-orange-400"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="confirmPassword" className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {t.auth.confirmPassword}
                    <span className="text-red-500" aria-label="required">*</span>
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirmar"
                    required
                    aria-required="true"
                    aria-describedby="confirmPassword-error"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-9 text-sm border-gray-200 dark:border-gray-700 focus:border-orange-500 dark:focus:border-orange-400"
                  />
                </div>
              </div>
              {error && (
                <div
                  id="signup-error"
                  className="px-3 py-2 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg"
                  role="alert"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {error}
                </div>
              )}
              <Button
                type="submit"
                className="w-full h-9 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white text-sm font-medium"
                disabled={isLoading}
                aria-busy={isLoading}
              >
                {isLoading ? t.auth.creatingAccount || "Creando cuenta..." : t.auth.createAccount || "Crear Cuenta"}
              </Button>
            </form>
            <div className="mt-4 space-y-2"><div className="flex items-center gap-3"><div className="h-px flex-1 bg-orange-200/40 dark:bg-orange-400/10" /><span className="text-[10px] uppercase tracking-wider text-gray-400">{t.auth.socialAccess}</span><div className="h-px flex-1 bg-orange-200/40 dark:bg-orange-400/10" /></div><SocialAuthButtons /></div>
            <div className="mt-3 text-center">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {t.auth.alreadyHaveAccount || "¿Ya tienes cuenta?"}{" "}
                <Link
                  href="/auth/login"
                  className="font-medium text-orange-600 hover:text-orange-500 dark:text-orange-400"
                >
                  {t.auth.signIn}
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
