#!/usr/bin/env node
/**
 * Checks DATABASE_URL (direct, not pooled, supported scheme, no newlines) and emits GitHub `::add-mask::` commands for host,
 * user, password and database name BEFORE anything prints them (the repository is public, run logs are public).
 * Prints nothing else and never prints the URL.
 */
let u;
try { u = new URL(process.env.DATABASE_URL ?? ''); } catch { console.error('::error::database URL is missing or malformed'); process.exit(1); }
if (!/^postgres(ql)?:$/.test(u.protocol)) { console.error('::error::unsupported database scheme'); process.exit(1); }
if (u.hostname.includes('-pooler')) { console.error('::error::a pooled connection string was provided; use the direct (non-pooler) connection'); process.exit(1); }
const values = [u.hostname, decodeURIComponent(u.username), decodeURIComponent(u.password), u.pathname.replace(/^\//, '')];
for (const v of values) {
  if (v && /[\r\n]/.test(v)) { console.error('::error::connection parameter contains newline characters'); process.exit(1); }
}
for (const v of values) {
  if (v && v.length >= 3) console.log('::add-mask::' + v);
}
