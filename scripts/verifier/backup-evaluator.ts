export const PROPOSED_OD03_MAX_BACKUP_AGE_MINUTES = 30;
export const PROPOSED_OD03_MAX_BACKUP_AGE_MS = PROPOSED_OD03_MAX_BACKUP_AGE_MINUTES * 60 * 1000;
/** Tightened from 5 minutes to 60 seconds: prevents future-dated timestamps from silently extending a 30m OD-03 window. */
export const MAX_FUTURE_CLOCK_SKEW_MS = 60 * 1000;
export const NEON_IMMUTABLE_BRANCH_ID_RE = /^br-[a-z0-9-]+$/;
export const NEON_ENDPOINT_ID_RE = /^ep-[a-z0-9-]+$/;
const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export interface BackupMetadata {
  id: string; // non-sensitive backup snapshot or branch id
  kind?: "branch" | "snapshot" | string;
  projectId: string;
  sourceBranch: string; // immutable Neon branch ID (br-...)
  sourceBranchName?: string; // optional human branch name (secondary diagnostic only)
  endpointId?: string; // optional Neon endpoint ID (ep-...) bound to sourceBranch
  createdAt: string; // ISO 8601 UTC
  status?: "ready" | "creating" | "failed" | string; // never defaulted to "ready"
  verifiedByProvider?: boolean;
  providerState?: string;
}

export interface BackupEvaluationOptions {
  expectedEndpointId?: string;
  requireImmutableBranchId?: boolean;
  enforceOd03PolicyCap?: boolean;
  requireProviderVerification?: boolean;
  futureClockSkewToleranceMs?: number;
}

export interface BackupEvaluationResult {
  valid: boolean;
  code?: string;
  reason?: string;
  backupId?: string;
  ageMs?: number;
  ageMinutes?: number;
}

export function evaluateBackupMetadata(
  backup: BackupMetadata | null | undefined,
  expectedProjectId: string,
  expectedSourceBranch: string,
  workflowDispatchTimeIso: string,
  maxAllowedAgeMs?: number,
  options: BackupEvaluationOptions = {}
): BackupEvaluationResult {
  if (!backup || typeof backup !== "object") {
    return { valid: false, code: "BACKUP_METADATA_MISSING", reason: "backup metadata is missing or null" };
  }
  if (!backup.id || typeof backup.id !== "string" || backup.id.trim().length < 4) {
    return { valid: false, code: "BACKUP_INVALID_ID", reason: "invalid backup identifier" };
  }
  if (backup.id.includes("://") || backup.id.includes("@") || /\s/.test(backup.id)) {
    return { valid: false, code: "BACKUP_INVALID_ID", reason: "backup identifier must not be a URL, credential, or whitespace string" };
  }
  if (!expectedProjectId || typeof expectedProjectId !== "string" || !expectedProjectId.trim()) {
    return { valid: false, code: "BACKUP_PROJECT_UNSPECIFIED", reason: "expected Neon projectId is missing" };
  }
  if (backup.projectId !== expectedProjectId) {
    return { valid: false, code: "BACKUP_PROJECT_MISMATCH", reason: `backup project mismatch: ${backup.projectId} != ${expectedProjectId}` };
  }
  if (!expectedSourceBranch || typeof expectedSourceBranch !== "string" || !expectedSourceBranch.trim()) {
    return { valid: false, code: "BACKUP_SOURCE_BRANCH_UNSPECIFIED", reason: "expected Neon sourceBranch is missing" };
  }

  const requireImmutableBranchId = options.requireImmutableBranchId !== false;
  if (requireImmutableBranchId) {
    if (!NEON_IMMUTABLE_BRANCH_ID_RE.test(expectedSourceBranch) || !NEON_IMMUTABLE_BRANCH_ID_RE.test(backup.sourceBranch ?? "")) {
      return {
        valid: false,
        code: "BACKUP_SOURCE_BRANCH_NOT_IMMUTABLE",
        reason: "backup sourceBranch must use an immutable Neon branch ID (br-...); mutable branch names like 'main' are rejected",
      };
    }
  }

  if (backup.sourceBranch !== expectedSourceBranch) {
    return { valid: false, code: "BACKUP_SOURCE_BRANCH_MISMATCH", reason: `backup source branch mismatch: ${backup.sourceBranch} != ${expectedSourceBranch}` };
  }
  if (backup.id === expectedSourceBranch) {
    return {
      valid: false,
      code: "BACKUP_REFERENCE_EQUALS_PRODUCTION_BRANCH",
      reason: "backup reference cannot be the active production branch itself",
    };
  }

  if (options.expectedEndpointId !== undefined) {
    if (!NEON_ENDPOINT_ID_RE.test(options.expectedEndpointId)) {
      return { valid: false, code: "BACKUP_ENDPOINT_INVALID", reason: `invalid expected endpoint identifier: ${options.expectedEndpointId}` };
    }
    if (!backup.endpointId || backup.endpointId !== options.expectedEndpointId) {
      return {
        valid: false,
        code: "BACKUP_ENDPOINT_MISMATCH",
        reason: `backup endpoint mismatch: ${backup.endpointId ?? "missing"} != ${options.expectedEndpointId}`,
      };
    }
  } else if (backup.endpointId !== undefined && !NEON_ENDPOINT_ID_RE.test(backup.endpointId)) {
    return { valid: false, code: "BACKUP_ENDPOINT_INVALID", reason: `invalid backup endpoint identifier: ${backup.endpointId}` };
  }

  // Never fabricate status="ready" when omitted by the provider (e.g. Neon /snapshots without status).
  if (typeof backup.status !== "string" || !backup.status.trim()) {
    return {
      valid: false,
      code: "BACKUP_STATUS_UNVERIFIABLE_FROM_PROVIDER",
      reason: "backup status is missing or unverified by provider (cannot fabricate 'ready')",
    };
  }
  if (backup.status !== "ready") {
    return { valid: false, code: "BACKUP_NOT_READY", reason: `backup is not in ready status: current status is ${backup.status}` };
  }
  if (backup.verifiedByProvider === false || (options.requireProviderVerification === true && backup.verifiedByProvider !== true)) {
    return {
      valid: false,
      code: "BACKUP_PROVIDER_VERIFICATION_REQUIRED",
      reason: "backup state was not confirmed by provider API (synthetic metadata cannot bypass provider verification)",
    };
  }

  if (
    typeof backup.createdAt !== "string" ||
    !ISO_TIMESTAMP_RE.test(backup.createdAt) ||
    typeof workflowDispatchTimeIso !== "string" ||
    !ISO_TIMESTAMP_RE.test(workflowDispatchTimeIso)
  ) {
    return { valid: false, code: "BACKUP_TIMESTAMP_INVALID", reason: "unparseable backup createdAt or workflow dispatch timestamp" };
  }

  const backupTime = Date.parse(backup.createdAt);
  const dispatchTime = Date.parse(workflowDispatchTimeIso);
  if (!Number.isFinite(backupTime) || !Number.isFinite(dispatchTime)) {
    return { valid: false, code: "BACKUP_TIMESTAMP_INVALID", reason: "unparseable backup createdAt or workflow dispatch timestamp" };
  }

  const requestedSkew = options.futureClockSkewToleranceMs ?? MAX_FUTURE_CLOCK_SKEW_MS;
  const clockSkewToleranceMs = Number.isFinite(requestedSkew)
    ? Math.min(MAX_FUTURE_CLOCK_SKEW_MS, Math.max(0, requestedSkew))
    : MAX_FUTURE_CLOCK_SKEW_MS;
  if (backupTime - dispatchTime > clockSkewToleranceMs) {
    return {
      valid: false,
      code: "BACKUP_TIMESTAMP_IN_FUTURE",
      reason: `backup createdAt timestamp is in the future relative to evaluation time (exceeds ${clockSkewToleranceMs / 1000}s clock-skew tolerance)`,
    };
  }

  // The freshness threshold is an OPEN DECISION (OD-03): there is deliberately NO default.
  if (typeof maxAllowedAgeMs !== "number" || !Number.isFinite(maxAllowedAgeMs) || maxAllowedAgeMs <= 0) {
    return {
      valid: false,
      code: "BACKUP_FRESHNESS_THRESHOLD_UNCONFIGURED",
      reason: "backup freshness threshold is not configured (no default: decision OD-03 is open)",
    };
  }

  if (options.enforceOd03PolicyCap !== false && maxAllowedAgeMs > PROPOSED_OD03_MAX_BACKUP_AGE_MS) {
    return {
      valid: false,
      code: "OD03_THRESHOLD_EXCEEDS_MAX_30M",
      reason: `backup freshness threshold (${maxAllowedAgeMs / 60000} minutes) exceeds OD-03 maximum of ${PROPOSED_OD03_MAX_BACKUP_AGE_MINUTES} minutes`,
    };
  }

  const ageMs = dispatchTime - backupTime;
  if (ageMs > maxAllowedAgeMs) {
    return {
      valid: false,
      code: "BACKUP_STALE",
      reason: `backup is too old (exceeds authorized freshness threshold of ${maxAllowedAgeMs / 60000} minutes prior to dispatch)`,
      ageMs,
      ageMinutes: ageMs / 60000,
    };
  }

  const normalizedAgeMs = Math.max(0, ageMs);
  return {
    valid: true,
    backupId: backup.id,
    ageMs: normalizedAgeMs,
    ageMinutes: normalizedAgeMs / 60000,
  };
}
