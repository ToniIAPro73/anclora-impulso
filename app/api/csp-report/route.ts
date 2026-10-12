import { NextRequest, NextResponse } from 'next/server'
import { sanitizeCspReport } from '@/lib/security/csp-report'

const MAX_BODY_BYTES = 8 * 1024

/**
 * POST /api/csp-report — receives legacy `report-uri` violation reports (B1-F2, P1).
 * It only writes a sanitized, bounded line to the server log (visible in Vercel function logs). It stores nothing,
 * never echoes the body and always answers 204 so a report can never be used to probe the application.
 */
export async function POST(request: NextRequest) {
  try {
    const text = await request.text()
    if (text.length > 0 && text.length <= MAX_BODY_BYTES) {
      const report = sanitizeCspReport(JSON.parse(text))
      if (report) {
        console.warn(`[csp-report] ${JSON.stringify(report)}`)
      }
    }
  } catch {
    // malformed body: ignore
  }
  return new NextResponse(null, { status: 204 })
}
