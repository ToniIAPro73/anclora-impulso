/**
 * O-3: PREVENTIVE network policy for browser contexts of the isolated E2E. Every request of the context (pages opened
 * later, redirect hops, sub-resources, fetch/XHR) is decided BEFORE it leaves the browser: only the local stack is
 * allowed, everything else is aborted and recorded. A listener that throws after seeing a request is not a barrier.
 * Service workers are blocked by the Playwright config (`serviceWorkers: 'block'`), which would otherwise bypass routing.
 */
import type { APIRequestContext, BrowserContext } from '@playwright/test';

export interface NetworkPolicy {
  /** Allowed origins, exactly `http://host:port`. */
  allowedOrigins: string[];
}

const DEFAULT_ORIGINS = () => {
  const web = new URL(process.env.BASE_URL ?? 'http://127.0.0.1:3100').origin;
  const api = new URL(process.env.API_URL ?? 'http://127.0.0.1:3101/api').origin;
  return [web, api];
};

export const blockedByContext = new WeakMap<BrowserContext, string[]>();

/** A 200 page that navigates to `target` (a fresh, routed request) and keeps the Set-Cookie headers of the redirect. */
export function htmlRedirect(target: string, setCookie?: string): { status: number; headers: Record<string, string>; body: string } {
  const headers: Record<string, string> = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' };
  if (setCookie) headers['set-cookie'] = setCookie;
  return { status: 200, headers, body: `<!doctype html><meta charset="utf-8"><script>location.replace(${JSON.stringify(target)})</script>` };
}

export function isAllowed(rawUrl: string, allowedOrigins: string[]): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol === 'data:' || url.protocol === 'blob:' || url.protocol === 'about:') return true;
  return allowedOrigins.includes(url.origin);
}

/** Install BEFORE the first navigation of the context. */
export async function installNetworkPolicy(context: BrowserContext, policy?: Partial<NetworkPolicy>): Promise<string[]> {
  const allowed = policy?.allowedOrigins ?? DEFAULT_ORIGINS();
  const blocked: string[] = [];
  blockedByContext.set(context, blocked);
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();
    if (!isAllowed(url, allowed)) {
      blocked.push(`${request.method()} ${new URL(url).origin}`);
      await route.abort('blockedbyclient');
      return;
    }
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('about:')) {
      await route.fallback();
      return;
    }
    // Chromium does NOT re-route the hops that FOLLOW a delivered 3xx (observed: a second hop reached a forbidden
    // sentinel). So a redirect is never delivered to the browser's network stack:
    //  - every allowed request is performed with redirects disabled;
    //  - a 3xx whose Location is not allowed is aborted;
    //  - a 3xx of a NAVIGATION to an allowed Location becomes a 200 page that performs `location.replace(target)`, keeping
    //    the original Set-Cookie headers, so the next hop is a brand-new request that is routed and checked again;
    //  - a 3xx of any other request (fetch/XHR/sub-resource) is blocked.
    let response;
    try {
      response = await route.fetch({ maxRedirects: 0 });
    } catch {
      blocked.push(`${request.method()} fetch-failed ${new URL(url).origin}`);
      await route.abort('failed').catch(() => undefined);
      return;
    }
    const status = response.status();
    if (status >= 300 && status < 400) {
      const location = response.headers()['location'];
      const target = location ? new URL(location, url).toString() : null;
      if (!target || !isAllowed(target, allowed)) {
        blocked.push(`${request.method()} redirect-to ${target ? new URL(target).origin : '(none)'}`);
        await route.abort('blockedbyclient');
        return;
      }
      if (!request.isNavigationRequest()) {
        blocked.push(`${request.method()} non-navigation redirect`);
        await route.abort('blockedbyclient');
        return;
      }
      await route.fulfill(htmlRedirect(target, response.headers()['set-cookie'])).catch(() => undefined);
      return;
    }
    // The page may have navigated away (request cancelled, response disposed) while the fetch was in flight.
    await route.fulfill({ response }).catch(() => undefined);
  });
  return blocked;
}

/**
 * APIRequestContext calls are made by the Node test process, not by the browser, so they cannot be routed: this wrapper
 * refuses any URL outside the allowed origins before the call is made.
 */
export function guardApiRequests(request: APIRequestContext, allowedOrigins: string[] = DEFAULT_ORIGINS()): APIRequestContext {
  const methods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'fetch']);
  return new Proxy(request, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop === 'string' && methods.has(prop) && typeof value === 'function') {
        return (url: unknown, ...rest: unknown[]) => {
          const raw = typeof url === 'string' ? url : (url as { url?: () => string })?.url?.() ?? '';
          if (!isAllowed(raw, allowedOrigins)) {
            throw new Error(`blocked API request to a non-allowed origin: ${raw ? new URL(raw).origin : '(unknown)'}`);
          }
          return (value as (...a: unknown[]) => unknown).call(target, url, ...rest);
        };
      }
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
    },
  });
}
