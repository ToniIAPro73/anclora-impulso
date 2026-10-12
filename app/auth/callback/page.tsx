"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { apiClient } from "@/lib/api/client"

function OAuthCallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Tokens arrive in the URL fragment (never sent to servers or Referer). The query string is only read
    // for links issued by a backend that predates the fragment change.
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""))
    const accessToken = fragment.get("accessToken") ?? searchParams.get("accessToken")
    const refreshToken = fragment.get("refreshToken") ?? searchParams.get("refreshToken")

    // Remove credentials from the address bar and history immediately.
    window.history.replaceState(null, "", window.location.pathname)

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
