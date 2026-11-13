import type { ReactNode } from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"

import { DashboardUserMenu } from "@/components/dashboard-user-menu"

// Stable references so the component under test does not re-run effects on every render.
const mockUser = { id: "user-1", email: "test@example.com", fullName: "Test User", isAdmin: false }

jest.mock("@/lib/contexts/language-context", () => ({
  useLanguage: () => ({ language: "es", t: { navigation: { profile: "Perfil", logout: "Cerrar Sesión" } } }),
}))

jest.mock("@/lib/contexts/auth-context", () => ({
  useAuth: () => ({ user: mockUser, logout: jest.fn() }),
}))

jest.mock("@/components/user-avatar", () => ({
  UserAvatar: () => <span data-testid="avatar" />,
}))

// The Radix menu and the real profile dialog are replaced by plain elements: this test is about the hand-off
// implemented in DashboardUserMenu (focus goes back to the menu button), not about third-party overlays, whose
// portals, pointer-event guards and animation frames make the flow timing-dependent under jsdom.
jest.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuItem: ({ children, onSelect, onClick }: { children: ReactNode; onSelect?: (event: Event) => void; onClick?: () => void }) => (
    <button
      type="button"
      onClick={() => {
        onSelect?.(new Event("select", { cancelable: true }))
        onClick?.()
      }}
    >
      {children}
    </button>
  ),
}))

jest.mock("@/components/profile-dialog", () => ({
  ProfileDialog: ({ open, onOpenChange }: { open?: boolean; onOpenChange?: (open: boolean) => void }) =>
    open ? (
      <div role="dialog">
        <button type="button" onClick={() => onOpenChange?.(false)}>
          close-profile
        </button>
      </div>
    ) : null,
}))

describe("DashboardUserMenu focus management", () => {
  let frames: FrameRequestCallback[] = []
  let rafSpy: jest.SpyInstance

  const flushFrames = () => {
    act(() => {
      const pending = frames
      frames = []
      pending.forEach((callback) => callback(0))
    })
  }

  beforeEach(() => {
    frames = []
    rafSpy = jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      frames.push(callback)
      return frames.length
    })
  })

  afterEach(() => {
    rafSpy.mockRestore()
  })

  it("returns focus to the user menu button after the profile dialog closes", () => {
    render(<DashboardUserMenu />)
    const trigger = screen.getByTestId("user-menu")

    fireEvent.click(screen.getByRole("button", { name: "Perfil" }))
    flushFrames()
    const close = screen.getByRole("button", { name: "close-profile" })
    close.focus()
    expect(trigger).not.toHaveFocus()

    fireEvent.click(close)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    flushFrames()

    expect(trigger).toHaveFocus()
  })
})
