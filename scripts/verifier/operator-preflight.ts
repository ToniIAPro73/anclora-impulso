/**
 * Operator-side preflight (P1). OFFLINE: reads only local files; no network, no database, no secrets.
 *
 *   tsx scripts/verifier/operator-preflight.ts \
 *     --ledger ledger.json --backup backup.json \
 *     --project-id <neon-project-id> --source-branch <branch> \
 *     --max-backup-age-minutes <N> --baseline-count <N> [--dispatch-time <ISO>]
 *
 * ledger.json: array of {migration_name, checksum, finished_at[, rolled_back_at]} exported manually with a read-only credential.
 * backup.json: {id, projectId, sourceBranch, createdAt, status} copied from the provider console/API.
 * Run it from a clean checkout of the candidate commit. Exit code 0 only when READY_FOR_HUMAN_AUTHORIZATION.
 * It never prints ledger rows; it prints the report and its SHA-256 so the operator can attach both to the authorization.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { evaluatePreflight } from "./preflight.js";
import { computeMigrationChecksum, LedgerEntry } from "./ledger-evaluator.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}
const need = (name: string): string => {
  const v = arg(name);
  if (!v) { console.error(`missing required argument --${name}`); process.exit(2); }
  return v;
};

const root = process.cwd();
const ledgerRaw = JSON.parse(readFileSync(need("ledger"), "utf8")) as Array<Record<string, unknown>>;
const backup = JSON.parse(readFileSync(need("backup"), "utf8"));
const maxMinutes = Number(need("max-backup-age-minutes"));
const baselineCount = Number(need("baseline-count"));

const migrationsDir = join(root, "backend", "prisma", "migrations");
const candidates = readdirSync(migrationsDir)
  .filter((n) => /^[0-9]{14}_[a-z0-9_]+$/.test(n) && statSync(join(migrationsDir, n)).isDirectory())
  .sort()
  .map((name) => {
    const content = readFileSync(join(migrationsDir, name, "migration.sql"), "utf8");
    const crlf = content.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
    return { name, checksum: computeMigrationChecksum(content), alternateChecksums: [computeMigrationChecksum(crlf)] };
  });

const git = (...a: string[]) => execFileSync("git", a, { encoding: "utf8" }).trim();
const candidateSha = git("rev-parse", "HEAD");
const dirty = git("status", "--porcelain", "--", "backend/prisma", "scripts/release", ".github/workflows/production-migrations.yml");

let manifestOk = true;
let manifestReason: string | undefined;
try {
  execFileSync("node", ["scripts/release/verify-release-manifest.mjs", "."], { stdio: "pipe" });
} catch (e) {
  manifestOk = false;
  manifestReason = String((e as { stderr?: Buffer }).stderr ?? "manifest verification failed").replace(/::error::/g, "").trim();
}

const ledger: LedgerEntry[] = ledgerRaw.map((r, i) => ({
  id: String(r.id ?? i),
  migration_name: String(r.migration_name ?? ""),
  checksum: String(r.checksum ?? ""),
  finished_at: (r.finished_at as string | null | undefined) ?? null,
  rolled_back_at: (r.rolled_back_at as string | null | undefined) ?? null,
  started_at: String(r.started_at ?? ""),
  applied_steps_count: Number(r.applied_steps_count ?? 0),
  logs: null,
}));

const report = evaluatePreflight({
  candidateSha,
  workingTreeClean: dirty === "",
  manifestOk,
  manifestReason,
  candidates,
  ledger,
  baselineCount,
  backup,
  expectedProjectId: need("project-id"),
  expectedSourceBranch: need("source-branch"),
  dispatchTimeIso: arg("dispatch-time") ?? new Date().toISOString(),
  maxBackupAgeMs: Number.isFinite(maxMinutes) ? maxMinutes * 60_000 : undefined,
});

const text = JSON.stringify(report, null, 2);
console.log(text);
console.log(`report-sha256: ${createHash("sha256").update(text).digest("hex")}`);
process.exit(report.status === "READY_FOR_HUMAN_AUTHORIZATION" ? 0 : 1);
