import { authApi } from "@/lib/api/auth"
import { apiClient } from "@/lib/api/client"

describe("authApi.discardRejectedSession / logout (R8)", () => {
  const realFetch = (globalThis as { fetch?: unknown }).fetch
  const installFetch = () => {
    const fn = jest.fn().mockResolvedValue({ ok: true })
    ;(globalThis as { fetch?: unknown }).fetch = fn
    return fn
  }
  afterEach(() => { (globalThis as { fetch?: unknown }).fetch = realFetch })

  beforeEach(() => {
    localStorage.clear()
    jest.restoreAllMocks()
    jest.spyOn(console, "info").mockImplementation(() => undefined)
  })

  it("clears the local session without sending any logout request", () => {
    const fetchMock = installFetch()
    localStorage.setItem("accessToken", "a"); localStorage.setItem("refreshToken", "r1")
    expect(authApi.discardRejectedSession("r1", "test")).toBe(true)
    expect(localStorage.getItem("refreshToken")).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("does NOT clear a session that another tab created since the failed check", () => {
    localStorage.setItem("accessToken", "a-new"); localStorage.setItem("refreshToken", "r-new")
    expect(authApi.discardRejectedSession("r-old", "test")).toBe(false)
    expect(localStorage.getItem("refreshToken")).toBe("r-new")
  })

  it("explicit logout posts reason and origin (no token fields beyond the refresh token being revoked)", async () => {
    const fetchMock = installFetch()
    localStorage.setItem("refreshToken", "r1"); apiClient.setToken("a1")
    authApi.logout({ reason: "user_action", origin: "unit-test" })
    await Promise.resolve(); await Promise.resolve()
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, { body: string }])[1].body)
    expect(body).toMatchObject({ reason: "user_action", origin: "unit-test", refreshToken: "r1" })
  })
})
