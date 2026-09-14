"use client"

import { useEffect } from "react"
import { useLanguage } from "@/lib/contexts/language-context"

export function DocumentLanguageSync() {
  const { language } = useLanguage()
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])
  return null
}
