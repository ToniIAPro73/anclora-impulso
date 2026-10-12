#!/usr/bin/env node
/**
 * Verifies scripts/release/release-manifest.json against the migrations of the CURRENT checkout (the commit under review).
 * The manifest lives in the commit itself, so what is declared and what is migrated are bound by Git, not by a form field.
 * Exit 0 only if names and SHA-256 of every migration.sql match exactly (no extra, no missing, same order).
 *   node verify-release-manifest.mjs [repoRoot]
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] ?? process.cwd();
const dir = join(root, 'backend', 'prisma', 'migrations');
const manifestPath = join(root, 'scripts', 'release', 'release-manifest.json');
const fail = (msg) => { console.error(`::error::${msg}`); process.exit(1); };

if (!existsSync(manifestPath)) fail('release manifest is missing in this commit');
let manifest;
try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch { fail('release manifest is not valid JSON'); }
if (manifest.version !== 1 || !Array.isArray(manifest.migrations) || manifest.migrations.length === 0) fail('release manifest has an unsupported shape');

if (!existsSync(dir)) fail('migrations directory is missing');
const actual = readdirSync(dir)
  .filter((n) => /^[0-9]{14}_[a-z0-9_]+$/.test(n) && statSync(join(dir, n)).isDirectory())
  .sort();
const declared = manifest.migrations.map((m) => m.name);

if (JSON.stringify(actual) !== JSON.stringify(declared)) {
  const missing = declared.filter((n) => !actual.includes(n));
  const extra = actual.filter((n) => !declared.includes(n));
  fail(`manifest and migrations differ (declared-only: ${missing.length}, present-only: ${extra.length})`);
}
for (const m of manifest.migrations) {
  if (!/^[0-9a-f]{64}$/.test(m.sha256 ?? '')) fail(`manifest entry ${m.name} has no valid sha256`);
  const sql = join(dir, m.name, 'migration.sql');
  if (!existsSync(sql)) fail(`migration.sql missing for ${m.name}`);
  const sum = createHash('sha256').update(readFileSync(sql)).digest('hex');
  if (sum !== m.sha256) fail(`checksum mismatch for ${m.name}`);
}
console.log(`manifest ok: ${actual.length} migrations; newest is ${actual[actual.length - 1]}`);
