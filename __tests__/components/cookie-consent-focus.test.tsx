import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { CookieConsent } from "@/components/cookie-consent"

jest.mock("@/lib/contexts/language-context", () => ({
  useLanguage: () => ({ language: "es", t: {} }),
}))

const STORED_CONSENT = JSON.stringify({ necessary: true, analytics: false, marketing: false, updatedAt: "2026-01-01T00:00:00.000Z", version: "v1" })

describe("CookieConsent preferences dialog focus management", () => {
  // jsdom performs no layout, so `offsetParent` is always null and the focus trap would treat every control as hidden.
  const originalOffsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetParent")
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "offsetParent", {
      configurable: true,
      get() {
        return this.parentNode
      },
    })
  })
  afterAll(() => {
    if (originalOffsetParent) Object.defineProperty(HTMLElement.prototype, "offsetParent", originalOffsetParent)
  })

  beforeEach(() => {
    localStorage.clear()
  })

  it("moves focus into the preferences dialog and keeps Tab inside it", async () => {
    const user = userEvent.setup()
    render(<CookieConsent />)

    await user.click(screen.getByRole("button", { name: "Configuración" }))
    const dialog = await screen.findByRole("dialog")
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))

    for (let i = 0; i < 8; i += 1) {
      await user.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
  })

  it("returns to the pending banner on Escape when no choice has been stored yet", async () => {
    const user = userEvent.setup()
    render(<CookieConsent />)

    await user.click(screen.getByRole("button", { name: "Configuración" }))
    await screen.findByRole("dialog")
    await user.keyboard("{Escape}")

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(screen.getByRole("button", { name: "Aceptar todas" })).toBeInTheDocument()
    // focus goes back to the control that opened the preferences, not to <body>
    await waitFor(() => expect(screen.getByRole("button", { name: "Configuración" })).toHaveFocus())
  })

  it("treats the Back button like Escape: back to the banner when pending, fully closed when a choice exists", async () => {
    const user = userEvent.setup()
    const { unmount } = render(<CookieConsent />)
    await user.click(screen.getByRole("button", { name: "Configuración" }))
    await user.click(await screen.findByRole("button", { name: "Volver" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Configuración" })).toHaveFocus())
    unmount()

    localStorage.setItem("anclora-cookie-consent-v1", STORED_CONSENT)
    render(<CookieConsent />)
    await user.click(screen.getByRole("button", { name: "Preferencias de cookies" }))
    await user.click(await screen.findByRole("button", { name: "Volver" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(screen.queryByRole("button", { name: "Aceptar todas" })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole("button", { name: "Preferencias de cookies" })).toHaveFocus())
  })

  it("closes completely on Escape and refocuses the floating button when a choice already exists", async () => {
    localStorage.setItem("anclora-cookie-consent-v1", STORED_CONSENT)
    const user = userEvent.setup()
    render(<CookieConsent />)

    await user.click(screen.getByRole("button", { name: "Preferencias de cookies" }))
    await screen.findByRole("dialog")
    await user.keyboard("{Escape}")

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    // the consent prompt must not reappear for a user who already decided
    expect(screen.queryByRole("button", { name: "Aceptar todas" })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole("button", { name: "Preferencias de cookies" })).toHaveFocus())
    expect(localStorage.getItem("anclora-cookie-consent-v1")).toBe(STORED_CONSENT)
  })
})
