# Spec v1 — Refresh Token in HttpOnly Cookie (`TASK-002`)

- **Status:** Draft (Pending Toni validation in `development`)
- **Task covered:** `TASK-002`
- **Origin:** `AUD-001`

## 1. Problem & Objective

Currently (`AUD-001`), `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, and `POST /api/auth/oauth/exchange` return `refreshToken` in the JSON body, and the frontend (`lib/api/auth.ts`, `lib/api/client.ts`, `lib/contexts/auth-context.tsx`, `app/auth/callback/page.tsx`) persists `refreshToken` in `window.localStorage`. Any XSS payload able to read `localStorage` can exfiltrate a 30-day refresh token.

This spec moves the refresh token to an `HttpOnly` cookie (`refreshToken`) scoped to `/api/auth`, with a 1-window transition in the backend so existing clients or integration tests sending `req.body.refreshToken` continue to work while the browser frontend stops reading or writing `refreshToken` in `localStorage`.

## 2. Technical Design

### 2.1 Backend (`backend/src/utils/refresh-cookie.ts`, `auth.controller.ts`, `oauth.controller.ts`)
- Cookie name: `refreshToken`
- Cookie attributes:
  - `httpOnly: true`
  - `secure: env.nodeEnv === 'production'`
  - `sameSite: 'lax'`
  - `path: '/api/auth'`
  - `maxAge: env.authRefreshSessionDays * 24 * 60 * 60 * 1000`
- Endpoints setting the cookie:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/refresh`
  - `POST /api/auth/oauth/exchange`
- Transition window on `POST /api/auth/refresh` and `POST /api/auth/logout`:
  - Read token from `req.cookies?.refreshToken` first, falling back to `req.body?.refreshToken`.
  - `POST /api/auth/logout` always clears the `refreshToken` cookie (`res.clearCookie('refreshToken', { path: '/api/auth', httpOnly: true, sameSite: 'lax', secure: env.nodeEnv === 'production' })`).

### 2.2 Frontend (`lib/api/auth.ts`, `lib/api/client.ts`, `lib/contexts/auth-context.tsx`, `app/auth/callback/page.tsx`, `lib/auth/oauth.ts`)
- Never write `refreshToken` to `localStorage` on login, signup, refresh, or OAuth callback; defensively remove any legacy `localStorage.getItem('refreshToken')`.
- Send `credentials: 'include'` on API requests (`/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/logout`, `/auth/oauth/exchange`) so the browser automatically stores and attaches the `HttpOnly` cookie.
- Preserve single-flight refresh, session generation tracking, and cross-tab `accessToken` identity (`sid`) isolation (R8-A, R8-B, R8-C).

## 3. Acceptance Criteria

- **AC-01:** Backend sets `Set-Cookie: refreshToken=...; Path=/api/auth; HttpOnly; SameSite=Lax` (and `Secure` in production) on register, login, refresh, and OAuth exchange, and clears it on logout.
- **AC-02:** Backend `refreshToken` and `logout` handlers accept the refresh token from `req.cookies.refreshToken` (primary) or `req.body.refreshToken` (transition fallback).
- **AC-03:** Frontend never stores `refreshToken` in `localStorage` (`localStorage.getItem('refreshToken') === null` after login, signup, refresh, and OAuth callback).
- **AC-04:** All unit tests for backend cookie handling and frontend session/refresh/cross-tab behavior pass.
