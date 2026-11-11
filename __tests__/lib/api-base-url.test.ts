import { resolveApiBase } from '@/lib/api/base-url'

describe('resolveApiBase (TASK-002 same-origin proxy)', () => {
  it('uses the same origin when the proxy is enabled, regardless of the direct URL', () => {
    expect(resolveApiBase(true, 'https://backend.example.test/api')).toBe('/api')
    expect(resolveApiBase(true, undefined)).toBe('/api')
  })

  it('uses the configured direct backend URL when the proxy is disabled', () => {
    expect(resolveApiBase(false, 'https://backend.example.test/api')).toBe('https://backend.example.test/api')
  })

  it('falls back to the local backend when no URL is configured', () => {
    expect(resolveApiBase(false, undefined)).toBe('http://localhost:3001/api')
    expect(resolveApiBase(false, '')).toBe('http://localhost:3001/api')
  })
})
