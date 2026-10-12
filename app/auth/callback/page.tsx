"use client"

import { Suspense, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { apiClient } from "@/lib/api/client"
import { replaceWith } from "@/lib/auth/navigate"
import { redeemOAuthHandoff, storedIdentity, takeOAuthAttempt } from "@/lib/auth/oauth"

/**
 * F-4. This page installs a session ONLY if (a) this very tab started an OAuth flow, (b) the URL carries that flow's
 * one-time handoff code and (c) the backend accepts the code together with this tab's verifier. Tokens in the URL
 * (fragment or query, from older backends or from an attacker) are never read, and the URL is cleaned first.
 */
function OAuthCallbackHandler() {
  const router = useRouter()
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return // React StrictMode runs effects twice in development
    started.current = true

    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""))
    const code = fragment.get("code")
    const provider = fragment.get("provider")

    // Remove everything from the address bar and history immediately, success or failure.
    window.history.replaceState(null, "", window.location.pathname)

    const fail = () => router.replace("/auth/error?provider=unknown")

    const attempt = takeOAuthAttempt() // single use: removed from sessionStorage whatever happens next
    if (!code || !attempt || attempt.provider !== provider) {
      fail()
      return
    }
    // The session this tab holds must be the one it held when the flow started (another tab may have signed in/out).
    if (storedIdentity() !== attempt.identity) {
      fail()
      return
    }

    const generation = apiClient.getSessionGeneration()
    void (async () => {
      try {
        const auth = await redeemOAuthHandoff(code, attempt)
        // A login/logout in this tab while the exchange was in flight wins: a late result must not replace it.
        if (apiClient.getSessionGeneration() !== generation || storedIdentity() !== attempt.identity) {
          fail()
          return
        }
        apiClient.setToken(auth.accessToken)
        localStorage.setItem("refreshToken", auth.refreshToken)
        // Full reload so AuthProvider re-reads the stored session.
        replaceWith("/dashboard")
      } catch {
        fail()
      }
    })()
  }, [router])

  return null
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <OAuthCallbackHandler />
    </Suspense>
  )
}
