/**
 * R8-B: a profile request (or legacy migration) started under identity A must not publish into, or write on
 * behalf of, a later identity. Controlled promises; assertions on rendered state and on the update calls.
 */
import React from "react"
import { render, screen, waitFor, act } from "@testing-library/react"

jest.mock("@/lib/api/auth", () => ({
  authApi: { getCurrentUser: jest.fn(), login: jest.fn(), logout: jest.fn(), discardRejectedSession: jest.fn() },
}))
jest.mock("@/lib/api", () => ({ profileApi: { get: jest.fn(), update: jest.fn() } }))

import { apiClient } from "@/lib/api/client"
import { authApi } from "@/lib/api/auth"
import { profileApi } from "@/lib/api"
import { AuthProvider, useAuth } from "@/lib/contexts/auth-context"
import { getProfileStorageKey } from "@/lib/user-profile"

const auth = authApi as unknown as Record<string, jest.Mock>
const profiles = profileApi as unknown as Record<string, jest.Mock>

const A = { id: "user-a", email: "a@example.test", fullName: "A" }
const B = { id: "user-b", email: "b@example.test", fullName: "B" }

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}

let ctx: ReturnType<typeof useAuth>
function Probe() {
  ctx = useAuth()
  return <div data-testid="s">{`${ctx.isLoading ? "loading" : "ready"}|${ctx.user?.id ?? "none"}|${ctx.profile.age ?? "null"}`}</div>
}
const state = () => screen.getByTestId("s").textContent

/** Mimics storeSession: logging in changes the client's session identity. */
const loginAs = (user: typeof A, token: string) =>
  auth.login.mockImplementationOnce(async () => {
    apiClient.setToken(token)
    return { user, accessToken: token, refreshToken: `rt1.${token}` }
  })

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  apiClient.setToken("access-A")
  localStorage.setItem("accessToken", "access-A")
  localStorage.setItem("refreshToken", "rt1.A")
  auth.getCurrentUser.mockResolvedValue(A)
  jest.spyOn(console, "warn").mockImplementation(() => undefined)
  jest.spyOn(console, "info").mockImplementation(() => undefined)
  jest.spyOn(console, "error").mockImplementation(() => undefined)
})
afterEach(() => jest.restoreAllMocks())

describe("profile publication is bound to the identity that requested it (R8-B)", () => {
  it("profile A pending -> login B (profile B) -> A answers: profile B remains", async () => {
    const pendingA = deferred<Record<string, unknown>>()
    profiles.get.mockReturnValueOnce(pendingA.promise).mockResolvedValueOnce({ age: 40 })
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(profiles.get).toHaveBeenCalledTimes(1))

    loginAs(B, "access-B")
    await act(async () => { await ctx.login("b@example.test", "synthetic") })
    expect(state()).toBe("ready|user-b|40")

    await act(async () => { pendingA.resolve({ age: 30 }); await Promise.resolve() })
    expect(state()).toBe("ready|user-b|40")
  })

  it("profile pending -> logout -> late answer: the old profile does not reappear", async () => {
    const pendingA = deferred<Record<string, unknown>>()
    profiles.get.mockReturnValueOnce(pendingA.promise)
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(profiles.get).toHaveBeenCalledTimes(1))

    auth.logout.mockImplementationOnce(() => { apiClient.setToken(null) })
    act(() => ctx.logout())
    expect(state()).toBe("ready|none|null")

    await act(async () => { pendingA.resolve({ age: 30 }); await Promise.resolve() })
    expect(state()).toBe("ready|none|null")
  })

  it("legacy profile of A pending -> switch to B: no legacy update is sent under B", async () => {
    localStorage.setItem(getProfileStorageKey(A.id), JSON.stringify({ age: 33, sex: "male" }))
    const pendingA = deferred<Record<string, unknown>>()
    profiles.get.mockReturnValueOnce(pendingA.promise).mockResolvedValueOnce({ age: 40 })
    profiles.update.mockResolvedValue({ age: 33 })
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(profiles.get).toHaveBeenCalledTimes(1))

    loginAs(B, "access-B")
    await act(async () => { await ctx.login("b@example.test", "synthetic") })
    await act(async () => { pendingA.resolve({}); await Promise.resolve() }) // remote A is empty -> would migrate legacy A
    await act(async () => { await Promise.resolve() })

    expect(profiles.update).not.toHaveBeenCalled()
    expect(state()).toBe("ready|user-b|40")
    expect(localStorage.getItem(getProfileStorageKey(A.id))).not.toBeNull() // A's legacy data was not consumed by B
  })

  it("control: without a change of identity the legacy profile IS migrated and published", async () => {
    localStorage.setItem(getProfileStorageKey(A.id), JSON.stringify({ age: 33, sex: "male" }))
    profiles.get.mockResolvedValueOnce({})
    profiles.update.mockResolvedValue({ age: 33 })
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(state()).toBe("ready|user-a|33"))
    expect(profiles.update).toHaveBeenCalledTimes(1)
  })
})
