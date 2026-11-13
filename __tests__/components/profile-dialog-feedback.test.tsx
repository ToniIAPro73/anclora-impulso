import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { ProfileDialog } from "@/components/profile-dialog"

const mockUpdateProfile = jest.fn()
// Stable references: the dialog re-syncs its form whenever the profile identity changes.
const mockProfile = { limitations: [], onboardingCompletedAt: null }
const mockUser = { id: "user-1", email: "test@example.com", fullName: "Test User", isAdmin: false }

jest.mock("@/lib/contexts/language-context", () => ({
  useLanguage: () => ({
    language: "es",
    setLanguage: jest.fn(),
    t: {},
  }),
}))

jest.mock("@/lib/contexts/auth-context", () => ({
  useAuth: () => ({
    user: mockUser,
    profile: mockProfile,
    updateProfile: mockUpdateProfile,
    logout: jest.fn(),
    isLoading: false,
  }),
}))

describe("ProfileDialog save feedback", () => {
  beforeEach(() => {
    mockUpdateProfile.mockReset()
  })

  it("shows an error and stays open when saving fails, then closes on a successful retry", async () => {
    const user = userEvent.setup()
    const onOpenChange = jest.fn()
    mockUpdateProfile.mockRejectedValueOnce(new Error("network down"))
    render(<ProfileDialog open onOpenChange={onOpenChange} />)

    await user.click(screen.getByRole("button", { name: "Guardar" }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("No se pudo guardar tu perfil")
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled()

    mockUpdateProfile.mockResolvedValueOnce(undefined)
    await user.click(screen.getByRole("button", { name: "Guardar" }))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })
})
