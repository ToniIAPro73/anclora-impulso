export interface BackupMetadata {
  id: string; // non-sensitive backup or branch id
  projectId: string;
  sourceBranch: string;
  createdAt: string; // ISO 8601
  status: "ready" | "creating" | "failed" | string;
}

export interface BackupEvaluationResult {
  valid: boolean;
  reason?: string;
  backupId?: string;
}

export function evaluateBackupMetadata(
  backup: BackupMetadata | null | undefined,
  expectedProjectId: string,
  expectedSourceBranch: string,
  workflowDispatchTimeIso: string,
  maxAllowedAgeMs?: number
): BackupEvaluationResult {
  if (!backup) {
    return { valid: false, reason: "backup metadata is missing or null" };
  }
  if (!backup.id || typeof backup.id !== "string" || backup.id.length < 4) {
    return { valid: false, reason: "invalid backup identifier" };
  }
  if (backup.id.includes("://")) {
    return { valid: false, reason: "backup identifier must not be a URL or connection string" };
  }
  if (backup.projectId !== expectedProjectId) {
    return { valid: false, reason: `backup project mismatch: ${backup.projectId} != ${expectedProjectId}` };
  }
  if (backup.sourceBranch !== expectedSourceBranch) {
    return { valid: false, reason: `backup source branch mismatch: ${backup.sourceBranch} != ${expectedSourceBranch}` };
  }
  if (backup.status !== "ready") {
    return { valid: false, reason: `backup is not in ready status: current status is ${backup.status}` };
  }

  const backupTime = new Date(backup.createdAt).getTime();
  const dispatchTime = new Date(workflowDispatchTimeIso).getTime();

  if (isNaN(backupTime) || isNaN(dispatchTime)) {
    return { valid: false, reason: "unparseable backup createdAt or workflow dispatch timestamp" };
  }

  // The freshness threshold is an OPEN DECISION (OD-03): there is deliberately NO default. Without an explicit,
  // positive threshold the evaluation fails closed.
  if (typeof maxAllowedAgeMs !== "number" || !Number.isFinite(maxAllowedAgeMs) || maxAllowedAgeMs <= 0) {
    return { valid: false, reason: "backup freshness threshold is not configured (no default: decision OD-03 is open)" };
  }
  const effectiveMaxAgeMs = maxAllowedAgeMs;
  if (dispatchTime - backupTime > effectiveMaxAgeMs) {
    return { valid: false, reason: `backup is too old (exceeds authorized freshness threshold of ${effectiveMaxAgeMs / 60000} minutes prior to dispatch)` };
  }

  // Backup cannot be timestamped in the future relative to workflow dispatch plus a small clock-skew tolerance (5 minutes)
  const clockSkewToleranceMs = 5 * 60 * 1000;
  if (backupTime - dispatchTime > clockSkewToleranceMs) {
    return { valid: false, reason: "backup createdAt timestamp is in the future relative to workflow dispatch" };
  }

  return {
    valid: true,
    backupId: backup.id
  };
}
