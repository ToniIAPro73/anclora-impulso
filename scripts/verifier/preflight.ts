import { evaluatePrismaLedger, LedgerEntry, CandidateMigration, LedgerEvaluationResult } from "./ledger-evaluator.js";
import { evaluateBackupMetadata, BackupMetadata, BackupEvaluationResult } from "./backup-evaluator.js";

/**
 * P1 (decided by Toni 2026-10-12): the operator runs this evaluation LOCALLY, offline, on files they exported by hand.
 * The result is EVIDENCE for a human authorization, never an approval: the status is READY_FOR_HUMAN_AUTHORIZATION or
 * NOT_READY and nothing here can start, approve or skip a migration.
 */
export interface PreflightInput {
  candidateSha: string;
  workingTreeClean: boolean;
  manifestOk: boolean;
  manifestReason?: string;
  candidates: CandidateMigration[];
  ledger: LedgerEntry[];
  baselineCount: number;
  backup: BackupMetadata | null;
  expectedProjectId: string;
  expectedSourceBranch: string;
  dispatchTimeIso: string;
  maxBackupAgeMs: number | undefined;
}

export interface PreflightReport {
  status: "READY_FOR_HUMAN_AUTHORIZATION" | "NOT_READY";
  candidateSha: string;
  generatedAt: string;
  checks: Record<string, boolean>;
  reasons: string[];
  ledger: LedgerEvaluationResult;
  backup: BackupEvaluationResult;
  limitations: string[];
}

export function evaluatePreflight(input: PreflightInput): PreflightReport {
  const reasons: string[] = [];
  const limitations: string[] = [
    "A backup snapshot's metadata does not prove it can be restored.",
    "Evidence comes from files exported by the operator; this tool does not authenticate their origin.",
    "This report is not an authorization to migrate or deploy.",
  ];

  const shaOk = /^[0-9a-f]{40}$/.test(input.candidateSha);
  if (!shaOk) reasons.push("candidate SHA is not a full 40-character SHA");
  if (!input.workingTreeClean) reasons.push("working tree has uncommitted changes in migration or release files");
  if (!input.manifestOk) reasons.push(`release manifest check failed: ${input.manifestReason ?? "unknown"}`);

  const baselineOk = Number.isInteger(input.baselineCount) && input.baselineCount >= 1;
  if (!baselineOk) reasons.push("baselineCount must be a positive integer (required: no default)");

  const ledger = evaluatePrismaLedger(input.ledger, input.candidates, { minimumAppliedMigrations: baselineOk ? input.baselineCount : 1 });
  if (!ledger.valid) reasons.push(`ledger: ${ledger.reason ?? "invalid"}`);

  const backup = evaluateBackupMetadata(input.backup, input.expectedProjectId, input.expectedSourceBranch, input.dispatchTimeIso, input.maxBackupAgeMs);
  if (!backup.valid) reasons.push(`backup: ${backup.reason ?? "invalid"}`);

  const checks = {
    candidateSha: shaOk,
    cleanTree: input.workingTreeClean,
    manifest: input.manifestOk,
    baselineConfigured: baselineOk,
    ledger: ledger.valid,
    backup: backup.valid,
  };
  const ready = Object.values(checks).every(Boolean);
  return {
    status: ready ? "READY_FOR_HUMAN_AUTHORIZATION" : "NOT_READY",
    candidateSha: input.candidateSha,
    generatedAt: new Date().toISOString(),
    checks,
    reasons: ready ? [] : reasons,
    ledger,
    backup,
    limitations,
  };
}
