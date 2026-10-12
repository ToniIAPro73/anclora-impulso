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
}

export interface LedgerEvaluationResult {
  valid: boolean;
  reason?: string;
  appliedCount: number;
  pendingCount: number;
  pendingMigrations: string[];
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
 * 1. All previously applied migrations in ledger have matching names and matching checksums.
 * 2. No applied migration has finished_at = null (partial application).
 * 3. No applied migration has rolled_back_at != null.
 * 4. Migration 5 in ledger (if present) MUST have exactly KNOWN_MIGRATION_5_CHECKSUM.
 * 5. Candidate migrations must strictly append to the ledger without skipping or reordering.
 */
export function evaluatePrismaLedger(
  ledgerEntries: LedgerEntry[],
  candidateMigrations: CandidateMigration[],
  options: { minimumAppliedMigrations?: number } = {}
): LedgerEvaluationResult {
  // H4: an empty ledger means an unmanaged database or the wrong target: never "approve" applying the whole history
  // (including `init`). The baseline (migrations that must already be applied) is a required floor, at least 1.
  const minimumApplied = Math.max(1, options.minimumAppliedMigrations ?? 1);
  if (ledgerEntries.length < minimumApplied) {
    return {
      valid: false,
      reason: `ledger has ${ledgerEntries.length} applied migrations; at least ${minimumApplied} (baseline) are required: wrong target or unmanaged database`,
      appliedCount: ledgerEntries.length,
      pendingCount: 0,
      pendingMigrations: []
    };
  }

  const sortedLedger = [...ledgerEntries].sort((a, b) => a.migration_name.localeCompare(b.migration_name));
  const sortedCandidates = [...candidateMigrations].sort((a, b) => a.name.localeCompare(b.name));

  // 1. Check ledger integrity of already applied entries
  for (let i = 0; i < sortedLedger.length; i++) {
    const entry = sortedLedger[i];
    
    // Closed-failure if migration was rolled back or left unfinished
    if (!entry.finished_at) {
      return {
        valid: false,
        reason: `ledger contains unfinished migration: ${entry.migration_name} (finished_at is null)`,
        appliedCount: i,
        pendingCount: 0,
        pendingMigrations: []
      };
    }
    if (entry.rolled_back_at) {
      return {
        valid: false,
        reason: `ledger contains rolled back migration: ${entry.migration_name}`,
        appliedCount: i,
        pendingCount: 0,
        pendingMigrations: []
      };
    }

    // Must match candidate at index i
    if (i >= sortedCandidates.length) {
      return {
        valid: false,
        reason: `ledger has more migrations (${sortedLedger.length}) than candidate commit (${sortedCandidates.length})`,
        appliedCount: sortedLedger.length,
        pendingCount: 0,
        pendingMigrations: []
      };
    }

    const candidate = sortedCandidates[i];
    if (entry.migration_name !== candidate.name) {
      return {
        valid: false,
        reason: `migration name mismatch at position ${i}: ledger=${entry.migration_name}, candidate=${candidate.name}`,
        appliedCount: i,
        pendingCount: 0,
        pendingMigrations: []
      };
    }

    // Special check for Migration 5
    if (entry.migration_name === MIGRATION_5_NAME && entry.checksum !== KNOWN_MIGRATION_5_CHECKSUM) {
      return {
        valid: false,
        reason: `migration 5 checksum mismatch in ledger: ${entry.checksum} != expected ${KNOWN_MIGRATION_5_CHECKSUM}`,
        appliedCount: i,
        pendingCount: 0,
        pendingMigrations: []
      };
    }

    if (entry.checksum !== candidate.checksum) {
      return {
        valid: false,
        reason: `checksum mismatch for migration ${entry.migration_name}: ledger=${entry.checksum}, candidate=${candidate.checksum}`,
        appliedCount: i,
        pendingCount: 0,
        pendingMigrations: []
      };
    }
  }

  // 2. Determine pending migrations that need to be applied
  const pendingCandidates = sortedCandidates.slice(sortedLedger.length);
  const pendingNames = pendingCandidates.map(c => c.name);

  // If candidate includes Migration 5 in the pending set, check candidate checksum against KNOWN
  const pendingMig5 = pendingCandidates.find(c => c.name === MIGRATION_5_NAME);
  if (pendingMig5 && pendingMig5.checksum !== KNOWN_MIGRATION_5_CHECKSUM) {
    return {
      valid: false,
      reason: `candidate migration 5 checksum mismatch: ${pendingMig5.checksum} != expected ${KNOWN_MIGRATION_5_CHECKSUM}`,
      appliedCount: sortedLedger.length,
      pendingCount: pendingCandidates.length,
      pendingMigrations: pendingNames
    };
  }

  return {
    valid: true,
    appliedCount: sortedLedger.length,
    pendingCount: pendingCandidates.length,
    pendingMigrations: pendingNames
  };
}
