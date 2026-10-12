const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

export function describeDatabaseTarget(url: string | undefined) {
  if (!url) return { ok: false as const, reason: 'DATABASE_URL is not set' };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false as const, reason: 'DATABASE_URL is not a valid URL' };
  }
  // NF-1: same closed policy as scripts/validate-db-url.py. Only the postgresql scheme and a single schema=public query
  // parameter are admitted: host/hostaddr/port/options could change the effective destination without changing the
  // authority, and duplicated or encoded parameter names are rejected for the same reason.
  if (parsed.protocol !== 'postgresql:') {
    return { ok: false as const, reason: 'database URL scheme is not postgresql' };
  }
  if (parsed.hash) {
    return { ok: false as const, reason: 'database URL carries a fragment' };
  }
  if (parsed.search && parsed.search !== '?schema=public') {
    return { ok: false as const, reason: 'database URL query is restricted to schema=public' };
  }
  if (!LOOPBACK.has(parsed.hostname)) {
    return { ok: false as const, reason: `database host is not loopback (${parsed.hostname === '' ? 'empty' : 'remote'})` };
  }
  return {
    ok: true as const,
    host: parsed.hostname,
    port: parsed.port || '5432',
    database: parsed.pathname.replace(/^\//, ''),
    user: decodeURIComponent(parsed.username),
  };
}

export interface IntegrationAccessInput {
  databaseUrl: string | undefined;
  scriptPort?: string;
  scriptName?: string;
  scriptUser?: string;
  ci?: string;
}

export const CI_DATABASE = { port: '5432', database: 'impulso_test' } as const;

/**
 * Decides whether integration tests may run under the DEFAULT jest config. Presence of the runner variables is
 * not proof of anything: when they are set, the URL must itself be loopback and match BOTH of them. In CI the
 * URL must be loopback and match the CI service identity (port 5432, database impulso_test).
 */
export function evaluateIntegrationAccess(input: IntegrationAccessInput): { allowed: boolean; reason: string } {
  const target = describeDatabaseTarget(input.databaseUrl);
  if (!target.ok) return { allowed: false, reason: `DATABASE_URL rejected: ${target.reason}` };

  if (input.scriptPort || input.scriptName) {
    if (!input.scriptPort || !input.scriptName) return { allowed: false, reason: 'runner variables are incomplete' };
    if (target.port !== input.scriptPort || target.database !== input.scriptName) {
      return { allowed: false, reason: 'DATABASE_URL port/name do not match the runner variables' };
    }
    if (input.scriptUser && target.user !== input.scriptUser) {
      return { allowed: false, reason: 'DATABASE_URL user does not match the runner variables' };
    }
    return { allowed: true, reason: 'runner variables match a loopback URL (the full guard still checks the live marker)' };
  }

  if (input.ci === 'true') {
    if (target.port === CI_DATABASE.port && target.database === CI_DATABASE.database) {
      return { allowed: true, reason: 'CI service database on loopback' };
    }
    return { allowed: false, reason: 'CI database identity mismatch (expected loopback :5432/impulso_test)' };
  }

  return { allowed: false, reason: 'neither the isolated runner nor CI' };
}
