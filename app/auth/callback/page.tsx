"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { apiClient } from "@/lib/api/client"

function OAuthCallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const accessToken = searchParams.get("accessToken")
    const refreshToken = searchParams.get("refreshToken")

    if (!accessToken || !refreshToken) {
      router.replace("/auth/error?provider=unknown")
      return
    }

    apiClient.setToken(accessToken)
    localStorage.setItem("refreshToken", refreshToken)
    // Recarga completa para que AuthProvider re-lea el token recién guardado.
    window.location.replace("/dashboard")
  }, [router, searchParams])

  return null
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <OAuthCallbackHandler />
    </Suspense>
  )
}
