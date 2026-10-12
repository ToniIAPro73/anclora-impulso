import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface LedgerEntry {
  id: string;
  checksum: string;
  finished_at: Date | string | null;
  migration_name: string;
  logs: string | null;
  rolled_back_at: Date | string | null;
  started_at: Date | string;
  applied_steps_count: number;
}

export interface CandidateMigration {
  name: string;
  checksum: string; // SHA-256 of migration.sql
  /**
   * Checksums of the SAME content that differ only in line endings (CRLF). Production history shows baseline migrations
   * applied on 2026-03-28 from CRLF files; the content is identical. Accepting them is reported, never silent.
   */
  alternateChecksums?: string[];
}

export interface LedgerEvaluationResult {
  valid: boolean;
  reason?: string;
  appliedCount: number;
  pendingCount: number;
  pendingMigrations: string[];
  /** Applied migrations whose ledger checksum matched only the line-ending variant (for human review). */
  lineEndingEquivalents?: string[];
  /** Unfinished rows that are explicitly rolled back (resolved) and were ignored as history. */
  ignoredRolledBackRows?: number;
}

export const KNOWN_MIGRATION_5_CHECKSUM = "4becd718c9cd71fb9222ff3ea485729030abd71c20da8ea428647f1d57039ece";
export const MIGRATION_5_NAME = "20261012050000_add_idempotency_quota_reservation";

/**
 * Computes sha256 checksum of candidate migrations in the codebase.
 */
export function computeMigrationChecksum(migrationSqlContent: string): string {
  return crypto.createHash("sha256").update(migrationSqlContent, "utf8").digest("hex");
}

/**
 * Evaluates the remote Prisma ledger against the candidate migrations from the candidate SHA.
 * Enforces:
 * 0. The ledger is not empty / below the required baseline (wrong target or unmanaged database).
 * 1. Rows are grouped by migration_name. An UNFINISHED row (finished_at null) is only history if it is explicitly rolled back
 *    (rolled_back_at set) — otherwise it is a failed migration (Prisma P3009) and the evaluation fails.
 * 2. Each applied name has exactly ONE finished, not rolled back row; a finished row that is also rolled back fails.
 * 3. The applied names are exactly the first K candidates (append-only prefix): no gaps, no unknown names.
 * 4. The finished row's checksum equals the candidate's, or its line-ending variant (reported for review).
 * 5. Migration 5, if applied, MUST have exactly KNOWN_MIGRATION_5_CHECKSUM (no alternates).
 */
export function evaluatePrismaLedger(
  ledgerEntries: LedgerEntry[],
  candidateMigrations: CandidateMigration[],
  options: { minimumAppliedMigrations?: number } = {}
): LedgerEvaluationResult {
  const fail = (reason: string, applied = 0): LedgerEvaluationResult => ({
    valid: false, reason, appliedCount: applied, pendingCount: 0, pendingMigrations: [],
  });
  const sortedCandidates = [...candidateMigrations].sort((a, b) => a.name.localeCompare(b.name));

  // 1 + 2. group by name
  const byName = new Map<string, LedgerEntry[]>();
  for (const e of ledgerEntries) {
    const list = byName.get(e.migration_name) ?? [];
    list.push(e);
    byName.set(e.migration_name, list);
  }

  const appliedRows: LedgerEntry[] = [];
  let ignoredRolledBack = 0;
  for (const [name, rows] of [...byName.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const good: LedgerEntry[] = [];
    for (const r of rows) {
      if (!r.finished_at) {
        if (!r.rolled_back_at) {
          return fail(`ledger contains unfinished migration: ${name} (finished_at is null and not rolled back: failed state)`);
        }
        ignoredRolledBack += 1;
        continue;
      }
      if (r.rolled_back_at) {
        return fail(`ledger contains rolled back migration: ${name} (finished and rolled back at once)`);
      }
      good.push(r);
    }
    if (good.length > 1) return fail(`ledger has ${good.length} finished rows for migration ${name}: ambiguous`);
    if (good.length === 1) appliedRows.push(good[0]);
  }

  // 0. floor
  const minimumApplied = Math.max(1, options.minimumAppliedMigrations ?? 1);
  if (appliedRows.length < minimumApplied) {
    return fail(`ledger has ${appliedRows.length} applied migrations; at least ${minimumApplied} (baseline) are required: wrong target or unmanaged database`, appliedRows.length);
  }
  if (appliedRows.length > sortedCandidates.length) {
    return fail(`ledger has more applied migrations (${appliedRows.length}) than candidate commit (${sortedCandidates.length})`, appliedRows.length);
  }

  // 3 + 4 + 5. prefix, checksums
  const equivalents: string[] = [];
  for (let i = 0; i < appliedRows.length; i++) {
    const entry = appliedRows[i];
    const candidate = sortedCandidates[i];
    if (entry.migration_name !== candidate.name) {
      return fail(`migration name mismatch at position ${i}: ledger=${entry.migration_name}, candidate=${candidate.name}`, i);
    }
    if (entry.migration_name === MIGRATION_5_NAME && entry.checksum !== KNOWN_MIGRATION_5_CHECKSUM) {
      return fail(`migration 5 checksum mismatch in ledger: ${entry.checksum} != expected ${KNOWN_MIGRATION_5_CHECKSUM}`, i);
    }
    if (entry.checksum === candidate.checksum) continue;
    if (entry.migration_name !== MIGRATION_5_NAME && (candidate.alternateChecksums ?? []).includes(entry.checksum)) {
      equivalents.push(entry.migration_name);
      continue;
    }
    return fail(`checksum mismatch for migration ${entry.migration_name}: ledger=${entry.checksum}, candidate=${candidate.checksum}`, i);
  }

  const pendingCandidates = sortedCandidates.slice(appliedRows.length);
  const pendingNames = pendingCandidates.map((c) => c.name);

  const pendingMig5 = pendingCandidates.find((c) => c.name === MIGRATION_5_NAME);
  if (pendingMig5 && pendingMig5.checksum !== KNOWN_MIGRATION_5_CHECKSUM) {
    return {
      valid: false,
      reason: `candidate migration 5 checksum mismatch: ${pendingMig5.checksum} != expected ${KNOWN_MIGRATION_5_CHECKSUM}`,
      appliedCount: appliedRows.length,
      pendingCount: pendingCandidates.length,
      pendingMigrations: pendingNames,
    };
  }

  return {
    valid: true,
    appliedCount: appliedRows.length,
    pendingCount: pendingCandidates.length,
    pendingMigrations: pendingNames,
    lineEndingEquivalents: equivalents,
    ignoredRolledBackRows: ignoredRolledBack,
  };
}
