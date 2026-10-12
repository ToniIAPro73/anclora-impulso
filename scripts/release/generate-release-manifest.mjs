#!/usr/bin/env node
/** Writes scripts/release/release-manifest.json from the migrations of the working tree (run, review and commit it with the migration). */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] ?? process.cwd();
const dir = join(root, 'backend', 'prisma', 'migrations');
const names = readdirSync(dir).filter((n) => /^[0-9]{14}_[a-z0-9_]+$/.test(n) && statSync(join(dir, n)).isDirectory()).sort();
const migrations = names.map((name) => ({
  name,
  sha256: createHash('sha256').update(readFileSync(join(dir, name, 'migration.sql'))).digest('hex'),
}));
writeFileSync(join(root, 'scripts', 'release', 'release-manifest.json'), JSON.stringify({ version: 1, migrations }, null, 2) + '\n');
console.log(`wrote manifest with ${migrations.length} migrations`);
