"use client"

import { useEffect, useRef, useState } from "react"
import { Cookie } from "lucide-react"
import { useFocusTrap } from "@/hooks/use-focus-trap"
import { useLanguage } from "@/lib/contexts/language-context"

type CookiePreferences = {
  necessary: true
  analytics: boolean
  marketing: boolean
  updatedAt: string
  version: "v1"
}

const STORAGE_KEY = "anclora-cookie-consent-v1"
const defaults: CookiePreferences = { necessary: true, analytics: false, marketing: false, updatedAt: "", version: "v1" }

export function CookieConsent() {
  const { language } = useLanguage()
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useState(false)
  const [preferences, setPreferences] = useState(defaults)
  // The preferences view is a modal dialog: focus moves in, Tab stays inside, and focus is handed back on close.
  const settingsPanelRef = useFocusTrap(open && settings)
  const floatingButtonRef = useRef<HTMLButtonElement>(null)
  const refocusFloatingButton = useRef(false)
  const settingsButtonRef = useRef<HTMLButtonElement>(null)
  const refocusSettingsButton = useRef(false)

  // Leaving the preferences view without saving (Escape or "Back").
  const leaveSettings = () => {
    setSettings(false)
    if (preferences.updatedAt) {
      // A stored choice means nothing is pending: close entirely instead of re-prompting with the banner.
      refocusFloatingButton.current = true
      setOpen(false)
    } else {
      // The decision is still pending: back to the banner, on the control that opened the preferences.
      refocusSettingsButton.current = true
    }
  }
  const copy = language === "en"
    ? {
        title: "Cookie preferences",
        body: "This app uses necessary cookies for operation and can store optional analytics or marketing preferences if you allow them.",
        accept: "Accept all",
        settings: "Settings",
        reject: "Reject optional",
        manage: "Manage cookies",
        necessary: "Necessary cookies",
        necessaryBody: "Essential for security, session and app operation. They cannot be disabled.",
        analytics: "Analytics cookies",
        analyticsBody: "Help us understand product usage and improve the experience.",
        marketing: "Marketing cookies",
        marketingBody: "Reserved for relevant communications. They do not enable scripts that are not present.",
        save: "Save preferences",
        back: "Back",
      }
    : {
        title: "Preferencias de cookies",
        body: "Esta app utiliza cookies necesarias para operar y puede guardar preferencias opcionales de análisis o marketing si las autorizas.",
        accept: "Aceptar todas",
        settings: "Configuración",
        reject: "Rechazar opcionales",
        manage: "Gestionar cookies",
        necessary: "Cookies necesarias",
        necessaryBody: "Esenciales para seguridad, sesión y funcionamiento. No se pueden desactivar.",
        analytics: "Cookies de análisis",
        analyticsBody: "Ayudan a comprender el uso del producto y mejorar la experiencia.",
        marketing: "Cookies de marketing",
        marketingBody: "Reservadas para comunicaciones relevantes. No activan scripts inexistentes.",
        save: "Guardar preferencias",
        back: "Volver",
      }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CookiePreferences>
        setPreferences({ necessary: true, analytics: Boolean(parsed.analytics), marketing: Boolean(parsed.marketing), updatedAt: parsed.updatedAt ?? "", version: "v1" })
        return
      }
    } catch {}
    setOpen(true)
  }, [])

  useEffect(() => {
    const listener = () => { setOpen(true); setSettings(true) }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && settings) leaveSettings()
    }
    window.addEventListener("anclora:open-cookie-preferences", listener)
    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("anclora:open-cookie-preferences", listener)
      window.removeEventListener("keydown", onKeyDown)
    }
    // leaveSettings only reads `preferences.updatedAt`, which is listed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, preferences.updatedAt])

  useEffect(() => {
    if (open && !settings && refocusSettingsButton.current) {
      refocusSettingsButton.current = false
      // After the focus trap's own deferred restore, which targets a node that no longer exists.
      const timer = window.setTimeout(() => settingsButtonRef.current?.focus(), 0)
      return () => window.clearTimeout(timer)
    }
  }, [open, settings])

  useEffect(() => {
    if (!open && refocusFloatingButton.current) {
      refocusFloatingButton.current = false
      floatingButtonRef.current?.focus()
    }
  }, [open])

  function persist(next: CookiePreferences) {
    const value = { ...next, necessary: true as const, updatedAt: new Date().toISOString(), version: "v1" as const }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    setPreferences(value)
    refocusFloatingButton.current = settings
    setOpen(false)
    setSettings(false)
  }

  return (
    <>
      {!open ? (
        <button ref={floatingButtonRef} type="button" aria-label={copy.title} onClick={() => { setOpen(true); setSettings(true) }} className="fixed bottom-4 right-4 z-40 inline-flex h-10 w-10 items-center justify-center rounded-full border border-orange-400/40 bg-white/95 text-orange-600 shadow-lg backdrop-blur transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 dark:bg-slate-950/90 dark:text-orange-300">
          <Cookie className="h-4.5 w-4.5" aria-hidden="true" />
        </button>
      ) : null}
      {open ? (
        <div
          className={settings ? "fixed inset-0 z-50 flex items-end justify-center bg-black/55 px-4 py-6 backdrop-blur-sm sm:items-center" : "pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-end p-3 sm:p-4"}
          role={settings ? "dialog" : "region"}
          aria-modal={settings ? "true" : undefined}
          aria-labelledby="impulso-cookie-title"
        >
          <div ref={settings ? settingsPanelRef : undefined} className={settings ? "pointer-events-auto w-full max-w-lg rounded-3xl border border-orange-200/80 bg-white p-5 text-slate-900 shadow-2xl dark:border-orange-400/20 dark:bg-slate-950 dark:text-white sm:p-6" : "pointer-events-auto w-full max-w-md rounded-2xl border border-slate-200/90 bg-white/95 p-3.5 text-slate-900 shadow-xl backdrop-blur-md dark:border-white/15 dark:bg-slate-950/95 dark:text-white sm:p-4"}>
            {!settings ? (
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-600 dark:text-orange-300">Anclora Group</p>
                  <h2 id="impulso-cookie-title" className="mt-0.5 text-sm font-semibold sm:text-base">{copy.title}</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">{copy.body}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => persist({ ...defaults, analytics: true, marketing: true })} className="whitespace-nowrap rounded-full border border-slate-300 bg-slate-100 px-3.5 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20">{copy.accept}</button>
                  <button type="button" onClick={() => persist(defaults)} className="whitespace-nowrap rounded-full border border-slate-300 bg-slate-100 px-3.5 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20">{copy.reject}</button>
                  <button ref={settingsButtonRef} type="button" onClick={() => setSettings(true)} className="whitespace-nowrap rounded-full border border-slate-300 px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10">{copy.settings}</button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h2 id="impulso-cookie-title" className="text-xl font-semibold">{copy.manage}</h2>
                <CookieRow title={copy.necessary} description={copy.necessaryBody} checked disabled onChange={() => {}} />
                <CookieRow title={copy.analytics} description={copy.analyticsBody} checked={preferences.analytics} onChange={(analytics) => setPreferences((current) => ({ ...current, analytics }))} />
                <CookieRow title={copy.marketing} description={copy.marketingBody} checked={preferences.marketing} onChange={(marketing) => setPreferences((current) => ({ ...current, marketing }))} />
                <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-between">
                  <button type="button" onClick={leaveSettings} className="rounded-full px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">{copy.back}</button>
                  <button type="button" onClick={() => persist(defaults)} className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">{copy.reject}</button>
                  <button type="button" onClick={() => persist(preferences)} className="rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:from-orange-600 hover:to-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">{copy.save}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}

function CookieRow({ title, description, checked, disabled, onChange }: { title: string; description: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <span><span className="block text-sm font-semibold">{title}</span><span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</span></span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-5 w-5 accent-orange-500" />
    </label>
  )
}
