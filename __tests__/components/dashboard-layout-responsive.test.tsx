import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DashboardLayout } from "@/components/dashboard-layout"

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/dashboard"),
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() })),
}))

jest.mock("@/lib/contexts/language-context", () => ({
  useLanguage: jest.fn(() => ({
    language: "es",
    setLanguage: jest.fn(),
    t: {
      navigation: {
        dashboard: "Panel",
        nutrition: "Nutrición",
        generateWorkout: "Generar",
        exercises: "Ejercicios",
        progress: "Progreso",
        achievements: "Logros",
        healthPlans: "Planes",
        expandSidebar: "Expandir barra lateral",
        collapseSidebar: "Contraer barra lateral",
      },
      dashboard: {
        welcome: "Bienvenido",
        readyMessage: "Listo para entrenar",
        autoTheme: "Auto",
      },
      settings: {
        light: "Claro",
        dark: "Oscuro",
        system: "Sistema",
        spanish: "Español",
        english: "Inglés",
      },
    },
  })),
}))

jest.mock("@/lib/contexts/auth-context", () => ({
  useAuth: jest.fn(() => ({
    user: { id: "u1", email: "toni@anclora.com", fullName: "Toni" },
  })),
}))

jest.mock("@/lib/contexts/theme-context", () => ({
  useTheme: jest.fn(() => ({ theme: "dark", setTheme: jest.fn() })),
}))

jest.mock("@/components/dashboard-user-menu", () => ({
  DashboardUserMenu: () => <div data-testid="user-menu" />,
}))

describe("DashboardLayout responsive", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("permite scroll vertical en /dashboard y alinea el footer en sidebar expandido, contraído y móvil", async () => {
    const user = userEvent.setup()
    const { container } = render(
      <DashboardLayout>
        <section data-testid="plan-definicion">Plan de definición</section>
      </DashboardLayout>,
    )

    const main = container.querySelector("main")
    expect(main).toBeTruthy()
    expect(main?.className).toContain("lg:overflow-y-auto")
    expect(main?.className).not.toContain("lg:overflow-hidden")

    const footer = container.querySelector("footer")
    expect(footer).toBeTruthy()
    expect(main?.contains(footer)).toBe(true)

    const contentColumn = main?.parentElement
    expect(contentColumn?.className).toContain("lg:pl-64")
    expect(contentColumn?.className).not.toContain("lg:pl-24")

    // Contraer sidebar en escritorio: el footer y el contenido pasan a lg:pl-24
    const collapseButtons = screen.getAllByRole("button", { name: "Contraer barra lateral" })
    await user.click(collapseButtons[0])
    expect(contentColumn?.className).toContain("lg:pl-24")
    expect(contentColumn?.className).not.toContain("lg:pl-64")

    // Expandir de nuevo
    const expandButtons = screen.getAllByRole("button", { name: "Expandir barra lateral" })
    await user.click(expandButtons[0])
    expect(contentColumn?.className).toContain("lg:pl-64")

    // Toggle menú móvil
    const mobileToggle = expandButtons[1] ?? screen.getAllByRole("button", { name: "Expandir barra lateral" })[1]
    expect(mobileToggle).toHaveAttribute("aria-expanded", "false")
    await user.click(mobileToggle)
    expect(mobileToggle).toHaveAttribute("aria-expanded", "true")
  })
})

