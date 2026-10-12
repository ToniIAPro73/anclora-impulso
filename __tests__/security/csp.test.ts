/** B1-F2 P0/P1: CSP builders and the violation-report sanitizer. Pure functions, no network. */
import { buildEnforcedCsp, buildStrictReportOnlyCsp, CSP_REPORT_PATH } from '@/lib/security/csp'
import { sanitizeCspReport } from '@/lib/security/csp-report'

const API = 'https://anclora-impulso.onrender.com'
const directive = (policy: string, name: string) =>
  policy.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `) || d === name) ?? ''

describe('enforced policy (P0)', () => {
  const prod = buildEnforcedCsp({ isDevelopment: false, apiOrigin: API })

  it('no longer trusts public package CDNs for scripts', () => {
    const script = directive(prod, 'script-src')
    expect(script).not.toMatch(/jsdelivr|unpkg|perplexity/)
    expect(script).toContain("'self'")
  })

  it('adds base-uri and object-src restrictions', () => {
    expect(directive(prod, 'base-uri')).toBe("base-uri 'self'")
    expect(directive(prod, 'object-src')).toBe("object-src 'none'")
  })

  it('keeps unsafe-inline for now (P2 removes it) and the existing protections', () => {
    expect(directive(prod, 'script-src')).toContain("'unsafe-inline'")
    expect(prod).toContain("frame-ancestors 'none'")
    expect(prod).toContain("form-action 'self'")
    expect(prod).toContain('upgrade-insecure-requests')
  })

  it('allows only the configured API origin and the analytics endpoint in connect-src', () => {
    const connect = directive(prod, 'connect-src')
    expect(connect).toContain(API)
    expect(connect).not.toContain('localhost')
  })

  it('does not trust the removed font CDN either', () => {
    expect(directive(prod, 'font-src')).not.toMatch(/perplexity/)
  })

  it('development additionally allows unsafe-eval and the local API', () => {
    const dev = buildEnforcedCsp({ isDevelopment: true, apiOrigin: null })
    expect(directive(dev, 'script-src')).toContain("'unsafe-eval'")
    expect(directive(dev, 'connect-src')).toContain('http://localhost:3001')
  })
})

describe('strict report-only policy (P1)', () => {
  const nonce = 'dGVzdC1ub25jZQ=='
  const policy = buildStrictReportOnlyCsp({ isDevelopment: false, apiOrigin: API, nonce })

  it('uses a nonce with strict-dynamic and no unsafe-inline in script-src', () => {
    const script = directive(policy, 'script-src')
    expect(script).toContain(`'nonce-${nonce}'`)
    expect(script).toContain("'strict-dynamic'")
    expect(script).not.toContain("'unsafe-inline'")
  })

  it('reports to the dedicated same-origin endpoint and keeps the other restrictions', () => {
    expect(directive(policy, 'report-uri')).toBe(`report-uri ${CSP_REPORT_PATH}`)
    expect(directive(policy, 'base-uri')).toBe("base-uri 'self'")
    expect(directive(policy, 'object-src')).toBe("object-src 'none'")
    expect(policy).toContain("frame-ancestors 'none'")
  })

  it('rejects a malformed nonce instead of emitting a broken policy', () => {
    expect(() => buildStrictReportOnlyCsp({ isDevelopment: false, apiOrigin: null, nonce: "x'; script-src *" })).toThrow()
  })
})

describe('violation report sanitizer', () => {
  it('keeps only the useful, bounded fields and strips query strings and fragments', () => {
    const out = sanitizeCspReport({
      'csp-report': {
        'document-uri': 'https://impulso.anclora.com/dashboard?code=SECRET&state=S#frag',
        'effective-directive': 'script-src-elem',
        'blocked-uri': 'inline',
        disposition: 'report',
        'original-policy': 'default-src ...',
        'source-file': 'https://impulso.anclora.com/_next/static/chunks/app.js?token=SECRET',
        'line-number': 12,
      },
    })
    expect(out).toEqual({
      documentPath: '/dashboard',
      effectiveDirective: 'script-src-elem',
      blocked: 'inline',
      disposition: 'report',
      sourceFile: 'https://impulso.anclora.com/_next/static/chunks/app.js',
      line: 12,
    })
    expect(JSON.stringify(out)).not.toMatch(/SECRET|code=|token=|frag/)
  })

  it('returns null for anything that is not a report', () => {
    expect(sanitizeCspReport(null)).toBeNull()
    expect(sanitizeCspReport('x')).toBeNull()
    expect(sanitizeCspReport({})).toBeNull()
    expect(sanitizeCspReport({ 'csp-report': 'x' })).toBeNull()
  })

  it('bounds field lengths', () => {
    const long = 'a'.repeat(5000)
    const out = sanitizeCspReport({ 'csp-report': { 'effective-directive': long, 'blocked-uri': long, 'document-uri': `https://x.test/${long}` } })
    expect(out && out.blocked.length).toBeLessThanOrEqual(200)
    expect(out && out.effectiveDirective.length).toBeLessThanOrEqual(80)
    expect(out && out.documentPath.length).toBeLessThanOrEqual(200)
  })
})
