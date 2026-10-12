import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { buildEnforcedCsp, buildStrictReportOnlyCsp } from '@/lib/security/csp';

function getApiOrigin() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    return null;
  }

  try {
    return new URL(apiUrl).origin;
  } catch {
    return null;
  }
}

/**
 * Middleware for setting security headers on all responses
 * Implements Content Security Policy (CSP) and other security headers
 */
export function middleware(request: NextRequest) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const apiOrigin = getApiOrigin();

  // P1 (B1-F2): fresh nonce per request for the strict policy, which is only REPORTED. Handing the policy and the nonce to
  // Next.js through the request headers is the documented way for it to stamp its own inline scripts on dynamic renders.
  const nonce = btoa(crypto.randomUUID());
  const strictPolicy = buildStrictReportOnlyCsp({ isDevelopment, apiOrigin, nonce });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', strictPolicy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // P0: the policy that is ENFORCED (no public package CDNs; base-uri and object-src restricted).
  response.headers.set('Content-Security-Policy', buildEnforcedCsp({ isDevelopment, apiOrigin }));
  // P1: the target policy, measured only. Violations are POSTed to /api/csp-report and logged there.
  response.headers.set('Content-Security-Policy-Report-Only', strictPolicy);

  // Additional security headers
  // X-Content-Type-Options prevents MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // X-Frame-Options prevents clickjacking
  response.headers.set('X-Frame-Options', 'DENY');

  // X-XSS-Protection enables XSS protection in older browsers
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Referrer-Policy controls how much referrer information is shared
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions-Policy restricts browser features
  response.headers.set(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
  );

  // Strict-Transport-Security enforces HTTPS
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  return response;
}

// Configure which routes the middleware applies to
export const config = {
  matcher: [
    // Apply only to application pages, never to API or static/public assets
    '/((?!api|_next/static|_next/image|.*\\..*).*)',
  ],
};
