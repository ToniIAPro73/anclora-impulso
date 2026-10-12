/**
 * Content-Security-Policy builders (B1-F2). Pure functions used by `middleware.ts`.
 *  - buildEnforcedCsp: the policy that is ENFORCED today (P0). Keeps `'unsafe-inline'` for scripts because Next.js static pages
 *    ship inline hydration scripts without a nonce; removing it is P2 and depends on the P1 report data.
 *  - buildStrictReportOnlyCsp: the target policy (nonce + strict-dynamic, no unsafe-inline), sent as Report-Only (P1) so its
 *    violations are measured without blocking anything.
 * Design and rationale: sdd/features/impulso-pilot-review-package/40-design-csp-hardening-v1.md
 */
export const CSP_REPORT_PATH = '/api/csp-report'

interface BaseOptions {
  isDevelopment: boolean
  /** Origin of the backend API (from NEXT_PUBLIC_API_URL), or null when unknown. */
  apiOrigin: string | null
}

const NONCE_PATTERN = /^[A-Za-z0-9+/=_-]{16,64}$/

function connectSrc({ isDevelopment, apiOrigin }: BaseOptions): string {
  return [
    "'self'",
    'https://va.vercel-scripts.com',
    ...(isDevelopment ? ['http://localhost:3001'] : []),
    ...(apiOrigin ? [apiOrigin] : []),
  ].join(' ')
}

/** Directives that are identical in the enforced and in the strict policy. */
function shared(options: BaseOptions): string[] {
  return [
    "default-src 'self'",
    // Styles keep 'unsafe-inline' (Tailwind/shadcn/Radix emit inline style attributes); style injection is a lower risk than script.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https: http:",
    `connect-src ${connectSrc(options)}`,
    "form-action 'self'",
    // base-uri is not covered by default-src: without it an injected <base> rewrites every relative URL.
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ]
}

export function buildEnforcedCsp(options: BaseOptions): string {
  const script = options.isDevelopment
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com"
    : "script-src 'self' 'unsafe-inline'"
  const [defaultSrc, ...rest] = shared(options)
  return [defaultSrc, script, ...rest].join('; ')
}

export function buildStrictReportOnlyCsp(options: BaseOptions & { nonce: string }): string {
  if (!NONCE_PATTERN.test(options.nonce)) {
    throw new Error('Invalid CSP nonce')
  }
  const script = `script-src 'self' 'nonce-${options.nonce}' 'strict-dynamic'${options.isDevelopment ? " 'unsafe-eval'" : ''}`
  const [defaultSrc, ...rest] = shared(options)
  return [defaultSrc, script, ...rest, `report-uri ${CSP_REPORT_PATH}`].join('; ')
}
