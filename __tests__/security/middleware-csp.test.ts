/**
 * B1-F2 P0/P1 wiring: the real middleware emits the enforced policy, the strict report-only policy with a fresh nonce
 * per request, and keeps the other security headers.
 *
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { middleware, config } from '@/middleware'

const call = (path = '/dashboard') => middleware(new NextRequest(`https://impulso.anclora.com${path}`))

describe('security headers middleware', () => {
  it('emits the enforced policy without public CDNs and with base-uri/object-src', () => {
    const csp = call().headers.get('content-security-policy') ?? ''
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).not.toMatch(/jsdelivr|unpkg/)
  })

  it('emits the strict policy in report-only mode with a nonce and a report endpoint', () => {
    const ro = call().headers.get('content-security-policy-report-only') ?? ''
    expect(ro).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=_-]{16,}' 'strict-dynamic'/)
    expect(ro).toContain('report-uri /api/csp-report')
    expect(ro).not.toMatch(/script-src[^;]*'unsafe-inline'/)
  })

  it('uses a different nonce on every request', () => {
    const nonce = (r: Response) => /'nonce-([^']+)'/.exec(r.headers.get('content-security-policy-report-only') ?? '')?.[1]
    const a = nonce(call())
    const b = nonce(call())
    expect(a).toBeTruthy()
    expect(a).not.toBe(b)
  })

  it('keeps the other security headers', () => {
    const h = call().headers
    expect(h.get('x-frame-options')).toBe('DENY')
    expect(h.get('x-content-type-options')).toBe('nosniff')
    expect(h.get('strict-transport-security')).toContain('max-age=')
    expect(h.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
  })

  it('does not apply to API routes or static assets (so the report endpoint is never blocked by its own policy)', () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`)
    expect(matcher.test('/dashboard')).toBe(true)
    expect(matcher.test('/api/csp-report')).toBe(false)
    expect(matcher.test('/_next/static/chunks/app.js')).toBe(false)
  })
})
