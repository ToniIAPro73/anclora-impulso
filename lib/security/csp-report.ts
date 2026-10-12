/**
 * Sanitizer for legacy `report-uri` CSP violation reports (application/csp-report). The body comes from the client, so
 * it is untrusted: only a few bounded fields are kept and query strings/fragments (which can carry OAuth codes or tokens)
 * are removed before anything is logged.
 */
export interface SanitizedCspReport {
  documentPath: string
  effectiveDirective: string
  blocked: string
  disposition: string
  sourceFile?: string
  line?: number
}

const cap = (value: unknown, max: number): string => (typeof value === 'string' ? value.slice(0, max) : '')

function stripUrl(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  try {
    const url = new URL(value)
    return `${url.origin}${url.pathname}`.slice(0, max)
  } catch {
    // keywords such as "inline", "eval", "data", "blob": keep as is, bounded and without anything after ? or #
    return value.split(/[?#]/)[0].slice(0, max)
  }
}

function pathOf(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  try {
    return new URL(value).pathname.slice(0, max)
  } catch {
    return ''
  }
}

export function sanitizeCspReport(body: unknown): SanitizedCspReport | null {
  if (!body || typeof body !== 'object') return null
  const report = (body as Record<string, unknown>)['csp-report']
  if (!report || typeof report !== 'object') return null
  const r = report as Record<string, unknown>

  const disposition = cap(r.disposition, 10)
  const line = typeof r['line-number'] === 'number' && Number.isFinite(r['line-number']) ? Math.trunc(r['line-number']) : undefined
  const sourceFile = stripUrl(r['source-file'], 200)

  return {
    documentPath: pathOf(r['document-uri'], 200),
    effectiveDirective: cap(r['effective-directive'] ?? r['violated-directive'], 80),
    blocked: stripUrl(r['blocked-uri'], 200),
    disposition: disposition === 'report' || disposition === 'enforce' ? disposition : '',
    ...(sourceFile ? { sourceFile } : {}),
    ...(line !== undefined ? { line } : {}),
  }
}
