/**
 * CORS origin policy (B1-F1). Credentials are enabled, so an origin is trusted only when it is one of:
 *  1. an exact configured frontend origin (scheme + host + port), or
 *  2. a Vercel preview of a configured `*.vercel.app` project whose host ends with an explicitly configured TEAM suffix
 *     (e.g. `-myteam-projects.vercel.app`). With no suffix configured there are NO wildcards: a prefix match on the project
 *     name alone would let anyone create `<project>-x.vercel.app` and be trusted.
 * Residual risk of (2): project names share one global namespace, so a name that literally ends with the team suffix is
 * not provably foreign. Prefer listing exact preview aliases in FRONTEND_URL and leaving the suffix list empty.
 */
const VERCEL_SUFFIX = '.vercel.app';

function parse(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isValidTeamSuffix(suffix: string): boolean {
  return suffix.startsWith('-') && suffix.endsWith(VERCEL_SUFFIX) && /^-[a-z0-9-]+\.vercel\.app$/.test(suffix);
}

export function isAllowedOrigin(origin: string, allowedFrontendUrls: string[], previewTeamSuffixes: string[]): boolean {
  const requested = parse(origin);
  if (!requested || !/^https?:$/.test(requested.protocol)) return false;

  const allowed = allowedFrontendUrls.map(parse).filter((url): url is URL => url !== null);
  if (allowed.some((url) => url.origin === requested.origin)) return true;

  // Preview wildcard: https, default port, and only under a configured, well-formed team suffix.
  if (requested.protocol !== 'https:' || requested.port !== '') return false;
  const host = requested.hostname.toLowerCase();

  for (const suffix of previewTeamSuffixes.map((s) => s.trim().toLowerCase()).filter(isValidTeamSuffix)) {
    if (!host.endsWith(suffix)) continue;
    const core = host.slice(0, host.length - suffix.length); // "<project>-<hash-or-git-branch>"
    if (!/^[a-z0-9-]+$/.test(core)) continue;

    for (const url of allowed) {
      if (url.protocol !== 'https:' || !url.hostname.endsWith(VERCEL_SUFFIX)) continue;
      const project = url.hostname.slice(0, -VERCEL_SUFFIX.length);
      if (core.startsWith(`${project}-`) && core.length > project.length + 1) return true;
    }
  }
  return false;
}
