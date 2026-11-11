#!/usr/bin/env node
/** Writes scripts/release/release-manifest.json from the migrations of the working tree (run, review and commit it with the migration). */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  computeCrlfSqlSha256,
  validateHistoricalChecksumEquivalences,
} from './emit-migration-attestation.mjs';

const root = process.argv[2] ?? process.cwd();
const dir = join(root, 'backend', 'prisma', 'migrations');
const manifestPath = join(root, 'scripts', 'release', 'release-manifest.json');
const names = readdirSync(dir).filter((n) => /^[0-9]{14}_[a-z0-9_]+$/.test(n) && statSync(join(dir, n)).isDirectory()).sort();
const diskWithCrlf = names.map((name) => {
  const bytes = readFileSync(join(dir, name, 'migration.sql'));
  return {
    name,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    crlfSha256: computeCrlfSqlSha256(bytes),
  };
});
const migrations = diskWithCrlf.map(({ name, sha256 }) => ({ name, sha256 }));
const output = { version: 1, migrations };
if (existsSync(manifestPath)) {
  const existing = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const verifiedEqs = validateHistoricalChecksumEquivalences(existing.historicalChecksumEquivalences, diskWithCrlf);
  if (verifiedEqs.length > 0) {
    output.historicalChecksumEquivalences = verifiedEqs;
  }
}
writeFileSync(manifestPath, JSON.stringify(output, null, 2) + '\n');
console.log(`wrote manifest with ${migrations.length} migrations`);
