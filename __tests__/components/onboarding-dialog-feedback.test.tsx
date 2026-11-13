import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { OnboardingDialog } from "@/components/onboarding-dialog"

const mockUpdateProfile = jest.fn()
// Stable reference: the dialog re-syncs its form whenever the profile identity changes.
const mockProfile = { limitations: [], onboardingCompletedAt: null }

jest.mock("@/lib/contexts/language-context", () => ({
  useLanguage: () => ({ language: "es", setLanguage: jest.fn(), t: {} }),
}))

jest.mock("@/lib/contexts/auth-context", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "test@example.com", fullName: "Test User" },
    profile: mockProfile,
    updateProfile: mockUpdateProfile,
    isLoading: false,
  }),
}))

jest.mock("@/lib/product-events", () => ({
  trackProductEvent: jest.fn().mockResolvedValue(undefined),
}))

async function goToLastStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /continuar/i }))
  await user.click(screen.getByRole("button", { name: /continuar/i }))
}

describe("OnboardingDialog feedback and accessible names", () => {
  beforeEach(() => {
    mockUpdateProfile.mockReset()
  })

  it("exposes an accessible name for every form control", async () => {
    const user = userEvent.setup()
    render(<OnboardingDialog open onOpenChange={jest.fn()} />)

    expect(screen.getByRole("combobox", { name: "Entorno habitual" })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Nivel actual" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /continuar/i }))
    expect(screen.getByRole("combobox", { name: "Sexo" })).toBeInTheDocument()
    for (const name of ["Edad", "Altura (cm)", "Peso actual (kg)"]) {
      expect(screen.getByRole("textbox", { name })).toBeInTheDocument()
    }

    await user.click(screen.getByRole("button", { name: /continuar/i }))
    for (const name of ["Peso objetivo (kg)", "Plazo (semanas)", "Entrenos/semana", "Limitaciones o molestias"]) {
      expect(screen.getByRole("textbox", { name })).toBeInTheDocument()
    }
  })

  it("lets the whole dialog scroll on short viewports (200% zoom) so the footer actions stay reachable", () => {
    render(<OnboardingDialog open onOpenChange={jest.fn()} />)

    const short = "[@media(max-height:640px)]"
    const dialog = screen.getByRole("dialog")
    const body = screen.getByTestId("onboarding-step-scroll-body")
    expect(dialog.className.split(" ")).toContain(`${short}:overflow-y-auto`)
    // the inner body must stop being the only (zero-height) scroller and flow with the dialog instead
    expect(body.className.split(" ")).toEqual(expect.arrayContaining([`${short}:flex-none`, `${short}:overflow-visible`]))
    expect(body.parentElement?.className.split(" ")).toEqual(
      expect.arrayContaining([`${short}:flex-none`, `${short}:overflow-visible`]),
    )
  })

  it("shows an error and keeps the dialog open when saving fails, then recovers on retry", async () => {
    const user = userEvent.setup()
    const onOpenChange = jest.fn()
    mockUpdateProfile.mockRejectedValueOnce(new Error("network down"))
    render(<OnboardingDialog open onOpenChange={onOpenChange} />)
    await goToLastStep(user)

    await user.click(screen.getByRole("button", { name: "Finalizar onboarding" }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("No se pudo guardar tu perfil")
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect(screen.getByRole("button", { name: "Finalizar onboarding" })).toBeEnabled()

    mockUpdateProfile.mockResolvedValueOnce(undefined)
    await user.click(screen.getByRole("button", { name: "Finalizar onboarding" }))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
