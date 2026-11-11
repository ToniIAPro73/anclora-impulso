/**
 * API base resolution (TASK-002, option A: same-origin proxy).
 *
 * When NEXT_PUBLIC_API_PROXY=true (build time), browser requests use the same origin as the frontend
 * ("/api"). next.config.mjs rewrites them to the Express backend (API_PROXY_TARGET). The refresh cookie is
 * then first-party, so SameSite=Lax works without third-party cookies.
 *
 * Otherwise the direct backend URL is used (previous behaviour, kept during the transition).
 * Literal `process.env.NEXT_PUBLIC_*` accesses are required so Next inlines them into the client bundle.
 */
const DEFAULT_DIRECT_API_URL = 'http://localhost:3001/api';

export function resolveApiBase(proxyEnabled: boolean, directUrl: string | undefined): string {
  if (proxyEnabled) return '/api';
  return directUrl || DEFAULT_DIRECT_API_URL;
}

/** Base for every authenticated/session call: same-origin when the proxy is enabled. */
export const API_BASE = resolveApiBase(
  process.env.NEXT_PUBLIC_API_PROXY === 'true',
  process.env.NEXT_PUBLIC_API_URL,
);

/** Direct backend base, for top-level navigations that must stay on the backend origin (OAuth start). */
export const DIRECT_API_BASE = resolveApiBase(false, process.env.NEXT_PUBLIC_API_URL);
