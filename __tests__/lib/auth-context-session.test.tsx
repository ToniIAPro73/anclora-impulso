/**
 * R8: the session check and the profile load are separate. A valid session is never ended by a 500, a network
 * failure, an abort or the failure of a stale check; a definitive 401 still ends it; explicit logout still revokes.
 */
import React from "react"
import { render, screen, waitFor, act } from "@testing-library/react"

jest.mock("@/lib/api/auth", () => ({
  authApi: { getCurrentUser: jest.fn(), login: jest.fn(), logout: jest.fn(), discardRejectedSession: jest.fn() },
}))
jest.mock("@/lib/api", () => ({ profileApi: { get: jest.fn(), update: jest.fn() } }))

import { ApiError, apiClient } from "@/lib/api/client"
import { authApi } from "@/lib/api/auth"
import { profileApi } from "@/lib/api"
import { AuthProvider, useAuth } from "@/lib/contexts/auth-context"

const authApiMock = authApi as unknown as Record<string, jest.Mock>
const profileApiMock = profileApi as unknown as Record<string, jest.Mock>

const USER = { id: "u1", email: "u1@example.test", fullName: "U One" }
let ctx: ReturnType<typeof useAuth>

function Probe() {
  ctx = useAuth()
  return <div data-testid="state">{ctx.isLoading ? "loading" : ctx.user ? `user:${ctx.user.id}` : "anonymous"}</div>
}
const mount = () => render(<AuthProvider><Probe /></AuthProvider>)
const settled = () => waitFor(() => expect(screen.getByTestId("state").textContent).not.toBe("loading"))

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  apiClient.setToken("access-decoy") // the client holds the same session as the storage (as after a real page load)
  localStorage.setItem("refreshToken", "refresh-decoy")
  profileApiMock.get.mockResolvedValue({})
  jest.spyOn(console, "warn").mockImplementation(() => undefined)
  jest.spyOn(console, "info").mockImplementation(() => undefined)
  jest.spyOn(console, "error").mockImplementation(() => undefined)
})
afterEach(() => jest.restoreAllMocks())

describe("session check vs profile load (R8)", () => {
  it("valid session + profile 500: user stays signed in, no logout, no discard", async () => {
    authApiMock.getCurrentUser.mockResolvedValue(USER)
    profileApiMock.get.mockRejectedValue(new ApiError("boom", 500))
    mount(); await settled()
    expect(screen.getByTestId("state").textContent).toBe("user:u1")
    expect(authApiMock.logout).not.toHaveBeenCalled()
    expect(authApiMock.discardRejectedSession).not.toHaveBeenCalled()
    expect(localStorage.getItem("refreshToken")).toBe("refresh-decoy")
  })

  it("valid session + network failure while loading the profile: session kept", async () => {
    authApiMock.getCurrentUser.mockResolvedValue(USER)
    profileApiMock.get.mockRejectedValue(new TypeError("Failed to fetch"))
    mount(); await settled()
    expect(screen.getByTestId("state").textContent).toBe("user:u1")
    expect(authApiMock.logout).not.toHaveBeenCalled()
  })

  it("aborted profile request (navigation): session kept", async () => {
    authApiMock.getCurrentUser.mockResolvedValue(USER)
    profileApiMock.get.mockRejectedValue(new DOMException("aborted", "AbortError"))
    mount(); await settled()
    expect(authApiMock.logout).not.toHaveBeenCalled()
    expect(authApiMock.discardRejectedSession).not.toHaveBeenCalled()
  })

  it("/auth/me 500: inconclusive, tokens and server session untouched", async () => {
    authApiMock.getCurrentUser.mockRejectedValue(new ApiError("boom", 500))
    mount(); await settled()
    expect(authApiMock.logout).not.toHaveBeenCalled()
    expect(authApiMock.discardRejectedSession).not.toHaveBeenCalled()
    expect(localStorage.getItem("accessToken")).toBe("access-decoy")
    expect(localStorage.getItem("refreshToken")).toBe("refresh-decoy")
  })

  it("/auth/me network failure or abort: tokens untouched", async () => {
    authApiMock.getCurrentUser.mockRejectedValue(new TypeError("Failed to fetch"))
    mount(); await settled()
    expect(authApiMock.logout).not.toHaveBeenCalled()
    expect(authApiMock.discardRejectedSession).not.toHaveBeenCalled()
  })

  it("definitive 401 on /auth/me: the invalid session IS discarded locally, without a server logout request", async () => {
    authApiMock.getCurrentUser.mockRejectedValue(new ApiError("Sesión revocada", 401))
    mount(); await settled()
    expect(screen.getByTestId("state").textContent).toBe("anonymous")
    expect(authApiMock.discardRejectedSession).toHaveBeenCalledWith("refresh-decoy", "auth-context.checkSession.me")
    expect(authApiMock.logout).not.toHaveBeenCalled()
  })

  it("a stale check that fails AFTER a newer login does not touch the newer session", async () => {
    let rejectCheck!: (e: unknown) => void
    authApiMock.getCurrentUser.mockReturnValue(new Promise((_, rej) => { rejectCheck = rej }))
    // like the real storeSession: a login moves the client to a new session generation
    authApiMock.login.mockImplementation(async () => {
      apiClient.setToken("a2")
      return { user: USER, accessToken: "a2", refreshToken: "r2" }
    })
    mount()
    await waitFor(() => expect(authApiMock.getCurrentUser).toHaveBeenCalled())

    await act(async () => { await ctx.login("u1@example.test", "synthetic-pw") })
    expect(ctx.user?.id).toBe("u1")

    await act(async () => { rejectCheck(new ApiError("old token", 401)) })
    await settled()
    expect(screen.getByTestId("state").textContent).toBe("user:u1")
    expect(authApiMock.discardRejectedSession).not.toHaveBeenCalled()
    expect(authApiMock.logout).not.toHaveBeenCalled()
  })

  it("explicit logout still revokes the server session and records reason + origin", async () => {
    authApiMock.getCurrentUser.mockResolvedValue(USER)
    mount(); await settled()
    act(() => ctx.logout())
    expect(authApiMock.logout).toHaveBeenCalledWith({ reason: "user_action", origin: "auth-context.logout" })
    expect(screen.getByTestId("state").textContent).toBe("anonymous")
  })
})
