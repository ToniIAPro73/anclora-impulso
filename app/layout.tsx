import type React from "react"
import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import { LanguageProvider } from "@/lib/contexts/language-context"
import { ThemeProvider } from "@/lib/contexts/theme-context"
import { CookieConsent } from "@/components/cookie-consent"
import { IMPULSO_BRAND } from "@/lib/impulso-brand"
import "./globals.css"
import { DM_Sans, JetBrains_Mono } from 'next/font/google'

// Initialize fonts
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' })

export const metadata: Metadata = {
  title: IMPULSO_BRAND.name,
  description: IMPULSO_BRAND.description,
  icons: {
    icon: [
      { url: IMPULSO_BRAND.faviconPath, sizes: "any" },
      { url: "/impulso_favicon_32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/impulso_apple_touch_icon.png", type: "image/png", sizes: "180x180" }],
    shortcut: [IMPULSO_BRAND.faviconPath],
  },
  manifest: "/site.webmanifest",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body className={`font-sans ${dmSans.variable} ${jetbrainsMono.variable}`}>
        <ThemeProvider>
          <LanguageProvider>
            {children}
            <CookieConsent />
          </LanguageProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
