import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { evaluatePreflight, PreflightInput } from "./preflight.js";
import { KNOWN_MIGRATION_5_CHECKSUM, MIGRATION_5_NAME } from "./ledger-evaluator.js";

let passed = 0;
let failed = 0;
const assert = (d: string, c: boolean) => { if (c) { console.log(`  [PASS] ${d}`); passed++; } else { console.error(`  [FAIL] ${d}`); failed++; } };

const SHA = "a".repeat(40);
const candidates = [
  { name: "20251120020551_init", checksum: "c1" },
  { name: "20260101000000_second", checksum: "c2" },
  { name: MIGRATION_5_NAME, checksum: KNOWN_MIGRATION_5_CHECKSUM },
];
const ledgerRow = (name: string, checksum: string) => ({ id: name, migration_name: name, checksum, finished_at: "2026-10-01T00:00:00Z", rolled_back_at: null, started_at: "2026-10-01T00:00:00Z", applied_steps_count: 1, logs: null });
const now = new Date("2026-10-12T12:00:00Z");
const base: PreflightInput = {
  candidateSha: SHA, workingTreeClean: true, manifestOk: true, candidates,
  ledger: [ledgerRow("20251120020551_init", "c1"), ledgerRow("20260101000000_second", "c2")],
  baselineCount: 2,
  backup: { id: "snap-0001", projectId: "proj-1", sourceBranch: "main", createdAt: new Date(now.getTime() - 10 * 60_000).toISOString(), status: "ready" },
  expectedProjectId: "proj-1", expectedSourceBranch: "main", dispatchTimeIso: now.toISOString(), maxBackupAgeMs: 60 * 60_000,
};

console.log("=== Operator preflight (P1) ===");
const ok = evaluatePreflight(base);
assert("all evidence valid -> READY_FOR_HUMAN_AUTHORIZATION (not an approval)", ok.status === "READY_FOR_HUMAN_AUTHORIZATION" && ok.ledger.pendingMigrations.length === 1);
assert("limitations always include 'not an authorization'", ok.limitations.some((l) => l.includes("not an authorization")));
assert("H4: empty ledger -> NOT_READY", evaluatePreflight({ ...base, ledger: [] }).status === "NOT_READY");
assert("H4: ledger below the baseline -> NOT_READY", evaluatePreflight({ ...base, ledger: [base.ledger[0]], baselineCount: 2 }).status === "NOT_READY");
assert("H8: no freshness threshold -> NOT_READY", evaluatePreflight({ ...base, maxBackupAgeMs: undefined }).status === "NOT_READY");
assert("missing baselineCount -> NOT_READY (no default)", evaluatePreflight({ ...base, baselineCount: NaN }).status === "NOT_READY");
assert("checksum mismatch in ledger -> NOT_READY", evaluatePreflight({ ...base, ledger: [ledgerRow("20251120020551_init", "XX"), base.ledger[1]] }).status === "NOT_READY");
assert("unfinished migration -> NOT_READY", evaluatePreflight({ ...base, ledger: [{ ...base.ledger[0], finished_at: null }, base.ledger[1]] }).status === "NOT_READY");
assert("migration 5 with another checksum in the ledger -> NOT_READY", evaluatePreflight({
  ...base, ledger: [base.ledger[0], base.ledger[1], ledgerRow(MIGRATION_5_NAME, "deadbeef")],
}).status === "NOT_READY");
assert("stale backup -> NOT_READY", evaluatePreflight({ ...base, backup: { ...base.backup!, createdAt: new Date(now.getTime() - 3 * 3600_000).toISOString() } }).status === "NOT_READY");
assert("backup of another project -> NOT_READY", evaluatePreflight({ ...base, backup: { ...base.backup!, projectId: "other" } }).status === "NOT_READY");
assert("dirty working tree -> NOT_READY", evaluatePreflight({ ...base, workingTreeClean: false }).status === "NOT_READY");
assert("manifest mismatch -> NOT_READY", evaluatePreflight({ ...base, manifestOk: false, manifestReason: "x" }).status === "NOT_READY");
assert("short candidate SHA -> NOT_READY", evaluatePreflight({ ...base, candidateSha: "abc123" }).status === "NOT_READY");
assert("report never contains connection URLs", !JSON.stringify(ok).includes("postgres"));

console.log("\n=== Release manifest scripts ===");
const root = mkdtempSync(join(tmpdir(), "relmanifest-"));
try {
  mkdirSync(join(root, "backend/prisma/migrations/20260101000000_one"), { recursive: true });
  mkdirSync(join(root, "scripts/release"), { recursive: true });
  writeFileSync(join(root, "backend/prisma/migrations/20260101000000_one/migration.sql"), "-- one\n");
  const gen = join(process.cwd(), "scripts/release/generate-release-manifest.mjs");
  const ver = join(process.cwd(), "scripts/release/verify-release-manifest.mjs");
  const run = (script: string) => { try { execFileSync("node", [script, root], { stdio: "pipe" }); return true; } catch { return false; } };
  assert("generate then verify passes", run(gen) && run(ver));
  writeFileSync(join(root, "backend/prisma/migrations/20260101000000_one/migration.sql"), "-- one changed\n");
  assert("edited migration -> manifest verification fails", !run(ver));
  run(gen);
  mkdirSync(join(root, "backend/prisma/migrations/20260102000000_extra"));
  writeFileSync(join(root, "backend/prisma/migrations/20260102000000_extra/migration.sql"), "-- extra\n");
  assert("migration not in manifest -> verification fails", !run(ver));
  rmSync(join(root, "scripts/release/release-manifest.json"));
  assert("missing manifest -> verification fails", !run(ver));
} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log(`\nTotal: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
