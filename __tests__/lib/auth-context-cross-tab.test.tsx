/**
 * R8-C (context): legacy profile migration of A pending while ANOTHER tab signs in as B. Real client and real
 * profile API over a fake fetch; the other tab changes only the shared storage.
 */
import React from "react"
import { render, screen, waitFor, act } from "@testing-library/react"
import { AuthProvider, useAuth } from "@/lib/contexts/auth-context"
import { apiClient } from "@/lib/api/client"
import { getProfileStorageKey } from "@/lib/user-profile"

const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_")
const jwt = (sid: string) => `${b64({ alg: "none" })}.${b64({ sid })}.sig`
const TOKEN_A = jwt("sess-A")
const TOKEN_B = jwt("sess-B")

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}
const json = (status: number, body: unknown) => ({ ok: status < 300, status, json: async () => body }) as Response

let ctx: ReturnType<typeof useAuth>
function Probe() {
  ctx = useAuth()
  return <div data-testid="s">{`${ctx.user?.id ?? "none"}|${ctx.profile.age ?? "null"}`}</div>
}

describe("legacy profile migration across tabs (R8-C)", () => {
  const sent: Array<{ method: string; url: string; auth: string | null; body: string | null }> = []
  const getProfile = deferred<Response>()

  beforeEach(() => {
    sent.length = 0
    localStorage.clear()
    apiClient.setToken(TOKEN_A) // this tab's session (also stores it)
    localStorage.setItem("refreshToken", "rt1.A")
    localStorage.setItem(getProfileStorageKey("user-a"), JSON.stringify({ age: 33, sex: "male" }))
    jest.spyOn(console, "warn").mockImplementation(() => undefined)
    jest.spyOn(console, "info").mockImplementation(() => undefined)
    global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      const entry = { method: init?.method ?? "GET", url: String(url), auth: headers.get("Authorization"), body: typeof init?.body === "string" ? init.body : null }
      sent.push(entry)
      if (entry.url.endsWith("/auth/me")) return json(200, { id: "user-a", email: "a@example.test", fullName: "A" })
      if (entry.url.endsWith("/profile") && entry.method === "GET") return getProfile.promise
      if (entry.url.endsWith("/profile") && entry.method === "PUT") return json(200, { age: 33 })
      return json(404, {})
    }) as unknown as typeof fetch
  })
  afterEach(() => jest.restoreAllMocks())

  it("profile of A pending -> other tab logs in as B -> no migration of A is sent (under B or at all)", async () => {
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(sent.some((r) => r.url.endsWith("/profile") && r.method === "GET")).toBe(true))

    // another tab signs in as B: shared storage only
    localStorage.setItem("accessToken", TOKEN_B)
    localStorage.setItem("refreshToken", "rt1.B")

    await act(async () => { getProfile.resolve(json(200, {})); await Promise.resolve() }) // remote A empty -> would migrate legacy A
    await act(async () => { await new Promise((r) => setTimeout(r, 20)) })

    expect(sent.filter((r) => r.method === "PUT")).toHaveLength(0)
    expect(sent.filter((r) => r.auth === `Bearer ${TOKEN_B}`)).toHaveLength(0)
    expect(localStorage.getItem(getProfileStorageKey("user-a"))).not.toBeNull() // A's legacy copy not consumed
    expect(screen.getByTestId("s").textContent).not.toContain("33") // A's profile not published into a superseded tab
  })

  it("control: same tab, nothing else changed -> the legacy profile IS migrated under A", async () => {
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(sent.some((r) => r.url.endsWith("/profile") && r.method === "GET")).toBe(true))
    await act(async () => { getProfile.resolve(json(200, {})); await Promise.resolve() })
    await waitFor(() => expect(sent.filter((r) => r.method === "PUT")).toHaveLength(1))
    expect(sent.find((r) => r.method === "PUT")?.auth).toBe(`Bearer ${TOKEN_A}`)
  })
})
