import crypto from "node:crypto";
import {
  verifyWebhookSignature,
  validateWebhookContext,
  InMemoryReplayCache,
  WebhookPayload
} from "./webhook-security.js";
import {
  evaluatePrismaLedger,
  LedgerEntry,
  CandidateMigration,
  KNOWN_MIGRATION_5_CHECKSUM
} from "./ledger-evaluator.js";
import {
  evaluateBackupMetadata,
  BackupMetadata
} from "./backup-evaluator.js";
import {
  decideProtectionRule,
  DeterministicChecksInput
} from "./decision-engine.js";

let passed = 0;
let failed = 0;

function assert(description: string, condition: boolean) {
  if (condition) {
    console.log(`  [PASS] ${description}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${description}`);
    failed++;
  }
}

console.log("=== Test Suite: Automated Migration Verifier ===");

// 1. Webhook Signature Tests
console.log("\n--- 1. Webhook Signature Verification ---");
const testSecret = "my_top_secret_webhook_key_12345";
const validBody = JSON.stringify({ action: "requested", environment: "production-migrations" });
const validHmac = crypto.createHmac("sha256", testSecret).update(validBody, "utf8").digest("hex");

assert("Valid signature passes", verifyWebhookSignature(validBody, `sha256=${validHmac}`, testSecret));
assert("Invalid signature fails", !verifyWebhookSignature(validBody, "sha256=invalid_hex_value", testSecret));
assert("Tampered body fails", !verifyWebhookSignature(validBody + " ", `sha256=${validHmac}`, testSecret));
assert("Missing header fails", !verifyWebhookSignature(validBody, undefined, testSecret));

// 2. Replay Prevention & Delivery ID
console.log("\n--- 2. Replay Prevention & Delivery ID ---");
const replayCache = new InMemoryReplayCache(5000);
const deliveryId = "del-uuid-1234-5678-90ab";

const basePayload: WebhookPayload = {
  action: "requested",
  environment: "production-migrations",
  event: "deployment_protection_rule",
  deployment_callback_url: "https://api.github.com/repos/ToniIAPro73/anclora-impulso/actions/runs/123/deployment_protection_rule",
  deployment: {
    id: 1,
    sha: "097840203807d0ae9ac4209cada26a6bd3f5adb6",
    ref: "refs/heads/development",
    environment: "production-migrations"
  },
  repository: {
    full_name: "ToniIAPro73/anclora-impulso",
    default_branch: "development"
  }
};

const v1 = validateWebhookContext("deployment_protection_rule", deliveryId, basePayload, replayCache, "ToniIAPro73/anclora-impulso", "production-migrations");
assert("First delivery passes", v1.valid);
replayCache.add(deliveryId);

const v2 = validateWebhookContext("deployment_protection_rule", deliveryId, basePayload, replayCache, "ToniIAPro73/anclora-impulso", "production-migrations");
assert("Replay of same delivery ID fails", !v2.valid && (v2.reason?.includes("replay") ?? false));

// 3. Context Validation (Environment, Repo, SHA)
console.log("\n--- 3. Context Validation ---");
const wrongEnvPayload: WebhookPayload = { ...basePayload, environment: "preview" };
const vWrongEnv = validateWebhookContext("deployment_protection_rule", "del-2", wrongEnvPayload, replayCache, "ToniIAPro73/anclora-impulso", "production-migrations");
assert("Wrong environment fails", !vWrongEnv.valid);

const wrongRepoPayload: WebhookPayload = { ...basePayload, repository: { full_name: "Attacker/evil-repo", default_branch: "development" } };
const vWrongRepo = validateWebhookContext("deployment_protection_rule", "del-3", wrongRepoPayload, replayCache, "ToniIAPro73/anclora-impulso", "production-migrations");
assert("Wrong repository fails", !vWrongRepo.valid);

const invalidShaPayload: WebhookPayload = { ...basePayload, deployment: { ...basePayload.deployment!, sha: "development" } };
const vInvalidSha = validateWebhookContext("deployment_protection_rule", "del-4", invalidShaPayload, replayCache, "ToniIAPro73/anclora-impulso", "production-migrations");
assert("Non-40-hex SHA fails", !vInvalidSha.valid);

// 4. Ledger Verification
console.log("\n--- 4. Ledger Verification ---");
const mockCandidates: CandidateMigration[] = [
  { name: "20251120020551_init", checksum: "aaa111" },
  { name: "20261012050000_add_idempotency_quota_reservation", checksum: KNOWN_MIGRATION_5_CHECKSUM },
  { name: "20261012090000_add_oauth_handoffs", checksum: "ccc333" }
];

const mockValidLedger: LedgerEntry[] = [
  {
    id: "1",
    migration_name: "20251120020551_init",
    checksum: "aaa111",
    finished_at: "2026-10-10T10:00:00Z",
    rolled_back_at: null,
    started_at: "2026-10-10T09:59:00Z",
    applied_steps_count: 1,
    logs: null
  }
];

const l1 = evaluatePrismaLedger(mockValidLedger, mockCandidates);
assert("Valid clean ledger passes with 2 pending migrations", l1.valid && l1.pendingCount === 2);

// Check migration 5 checksum validation
const mockCorruptMig5Ledger: LedgerEntry[] = [
  ...mockValidLedger,
  {
    id: "2",
    migration_name: "20261012050000_add_idempotency_quota_reservation",
    checksum: "corrupted_checksum_not_matching_known",
    finished_at: "2026-10-11T10:00:00Z",
    rolled_back_at: null,
    started_at: "2026-10-11T09:59:00Z",
    applied_steps_count: 1,
    logs: null
  }
];
const l2 = evaluatePrismaLedger(mockCorruptMig5Ledger, mockCandidates);
assert("Corrupted migration 5 checksum fails", !l2.valid);

// Unfinished migration in ledger
const mockUnfinishedLedger: LedgerEntry[] = [
  {
    id: "1",
    migration_name: "20251120020551_init",
    checksum: "aaa111",
    finished_at: null, // Still running or crashed!
    rolled_back_at: null,
    started_at: "2026-10-10T09:59:00Z",
    applied_steps_count: 0,
    logs: null
  }
];
const l3 = evaluatePrismaLedger(mockUnfinishedLedger, mockCandidates);
assert("Unfinished migration in ledger fails", !l3.valid && (l3.reason?.includes("finished_at is null") ?? false));

// Rolled back migration in ledger
const mockRolledBackLedger: LedgerEntry[] = [
  {
    id: "1",
    migration_name: "20251120020551_init",
    checksum: "aaa111",
    finished_at: "2026-10-10T10:00:00Z",
    rolled_back_at: "2026-10-10T10:05:00Z",
    started_at: "2026-10-10T09:59:00Z",
    applied_steps_count: 1,
    logs: null
  }
];
const l4 = evaluatePrismaLedger(mockRolledBackLedger, mockCandidates);
assert("Rolled back migration in ledger fails", !l4.valid && (l4.reason?.includes("rolled back") ?? false));

// Legacy baseline shapes (production history of 2026-03-28)
const entry = (name: string, checksum: string, finished: string | null, rolledBack: string | null = null): LedgerEntry => ({
  id: name + checksum + String(finished), migration_name: name, checksum, finished_at: finished, rolled_back_at: rolledBack,
  started_at: "2026-03-28T10:00:00Z", applied_steps_count: finished ? 1 : 0, logs: null
});
const legacyCandidates: CandidateMigration[] = [
  { name: "20251120020551_init", checksum: "aaa111", alternateChecksums: ["aaa111crlf"] },
  { name: "20261012050000_add_idempotency_quota_reservation", checksum: KNOWN_MIGRATION_5_CHECKSUM, alternateChecksums: ["mig5crlf"] },
  { name: "20261012090000_add_oauth_handoffs", checksum: "ccc333" }
];
const l6 = evaluatePrismaLedger([
  entry("20251120020551_init", "aaa111crlf", null, "2026-03-28T10:56:21Z"),
  entry("20251120020551_init", "aaa111crlf", "2026-03-28T10:56:22Z")
], legacyCandidates);
assert("Rolled back unfinished row is ignored; CRLF variant accepted and reported",
  l6.valid && l6.ignoredRolledBackRows === 1 && (l6.lineEndingEquivalents ?? []).includes("20251120020551_init"));
const l7 = evaluatePrismaLedger([
  entry("20251120020551_init", "aaa111", "2026-03-28T10:56:22Z"),
  entry("20261012050000_add_idempotency_quota_reservation", "mig5crlf", "2026-10-10T10:00:00Z")
], legacyCandidates);
assert("Line-ending variant is NOT accepted for migration 5", !l7.valid && (l7.reason?.includes("migration 5") ?? false));
const l8 = evaluatePrismaLedger([
  entry("20251120020551_init", "aaa111", null),
  entry("20251120020551_init", "aaa111", "2026-03-28T10:56:22Z")
], legacyCandidates);
assert("Unfinished row that is NOT rolled back still fails", !l8.valid && (l8.reason?.includes("unfinished") ?? false));
const l9 = evaluatePrismaLedger([
  entry("20251120020551_init", "aaa111", "2026-03-28T10:56:22Z"),
  entry("20251120020551_init", "aaa111", "2026-03-28T10:57:00Z")
], legacyCandidates);
assert("Two finished rows for one migration are ambiguous and fail", !l9.valid && (l9.reason?.includes("ambiguous") ?? false));
const l10 = evaluatePrismaLedger([entry("20251120020551_init", "zzz999", "2026-03-28T10:56:22Z")], legacyCandidates);
assert("Unrelated checksum still fails", !l10.valid && (l10.reason?.includes("checksum mismatch") ?? false));
const l11 = evaluatePrismaLedger([
  entry("20251120020551_init", "aaa111", "2026-03-28T10:56:22Z"),
  entry("20261012050000_add_idempotency_quota_reservation", KNOWN_MIGRATION_5_CHECKSUM, null, "2026-03-29T00:00:00Z")
], legacyCandidates);
assert("Unresolved rolled_back migration fails fail-closed", !l11.valid && (l11.reason?.includes("unresolved rolled back") ?? false));

// 5. Backup Verification
console.log("\n--- 5. Backup Verification (OD-03) ---");
const THIRTY_MIN_MS = 30 * 60 * 1000;
const nowMs = Date.now();
const nowIso = new Date(nowMs).toISOString();
const tenMinAgoIso = new Date(nowMs - 10 * 60 * 1000).toISOString();
const exactlyThirtyMinAgoIso = new Date(nowMs - THIRTY_MIN_MS).toISOString();
const thirtyMinPlusOneMsAgoIso = new Date(nowMs - (THIRTY_MIN_MS + 1)).toISOString();
const ninetySecondsFutureIso = new Date(nowMs + 90 * 1000).toISOString();
const thirtySecondsFutureIso = new Date(nowMs + 30 * 1000).toISOString();

const validBackup: BackupMetadata = {
  id: "br-backup-pre-m27-001",
  kind: "branch",
  projectId: "proj-anclora-prod-1234",
  sourceBranch: "br-gentle-bar-ag3slpph",
  endpointId: "ep-lingering-paper-agjnrga3",
  createdAt: tenMinAgoIso,
  status: "ready",
  verifiedByProvider: true,
};

const b1 = evaluateBackupMetadata(validBackup, "proj-anclora-prod-1234", "br-gentle-bar-ag3slpph", nowIso, THIRTY_MIN_MS, {
  expectedEndpointId: "ep-lingering-paper-agjnrga3",
  requireProviderVerification: true,
});
assert("Valid recent ready backup passes (<=30m, br-..., endpoint bound, provider verified)", b1.valid);

const bBoundaryPass = evaluateBackupMetadata({ ...validBackup, createdAt: exactlyThirtyMinAgoIso }, "proj-anclora-prod-1234", "br-gentle-bar-ag3slpph", nowIso, THIRTY_MIN_MS);
assert("Exact OD-03 boundary (30m + 0ms) passes", bBoundaryPass.valid);

const bOld = evaluateBackupMetadata({ ...validBackup, createdAt: thirtyMinPlusOneMsAgoIso }, "proj-anclora-prod-1234", "br-gentle-bar-ag3slpph", nowIso, THIRTY_MIN_MS);
assert("Backup older than 30m (30m + 1ms) fails (BACKUP_STALE)", !bOld.valid && bOld.code === "BACKUP_STALE");

const bNotReady = evaluateBackupMetadata({ ...validBackup, status: "creating" }, "proj-anclora-prod-1234", "br-gentle-bar-ag3slpph", nowIso, THIRTY_MIN_MS);
assert("Backup not in ready state fails", !bNotReady.valid && bNotReady.code === "BACKUP_NOT_READY");

const bMissingStatus = evaluateBackupMetadata({ ...validBackup, status: undefined }, "proj-anclora-prod-1234", "br-gentle-bar-ag3slpph", nowIso, THIRTY_MIN_MS);
assert("Missing provider status fails closed without fabricating 'ready'", !bMissingStatus.valid && bMissingStatus.code === "BACKUP_STATUS_UNVERIFIABLE_FROM_PROVIDER");

const bMutableBranch = evaluateBackupMetadata({ ...validBackup, sourceBranch: "main" }, "proj-anclora-prod-1234", "main", nowIso, THIRTY_MIN_MS);
assert("Mutable sourceBranch='main' without br-... fails closed", !bMutableBranch.valid && bMutableBranch.code === "BACKUP_SOURCE_BRANCH_NOT_IMMUTABLE");

const bOldBranch = evaluateBackupMetadata({ ...validBackup, sourceBranch: "br-empty-forest-ag9p7l45" }, "proj-anclora-prod-1234", "br-gentle-bar-ag3slpph", nowIso, THIRTY_MIN_MS);
assert("Previous replaced branch (br-empty-forest-ag9p7l45) fails", !bOldBranch.valid && bOldBranch.code === "BACKUP_SOURCE_BRANCH_MISMATCH");

const bWrongEndpoint = evaluateBackupMetadata({ ...validBackup, endpointId: "ep-swapped-999" }, "proj-anclora-prod-1234", "br-gentle-bar-ag3slpph", nowIso, THIRTY_MIN_MS, {
  expectedEndpointId: "ep-lingering-paper-agjnrga3",
});
assert("Mismatched endpointId fails", !bWrongEndpoint.valid && bWrongEndpoint.code === "BACKUP_ENDPOINT_MISMATCH");

const bManualMeta = evaluateBackupMetadata({ ...validBackup, verifiedByProvider: undefined }, "proj-anclora-prod-1234", "br-gentle-bar-ag3slpph", nowIso, THIRTY_MIN_MS, {
  requireProviderVerification: true,
});
assert("Unverified synthetic metadata fails when provider verification is required", !bManualMeta.valid && bManualMeta.code === "BACKUP_PROVIDER_VERIFICATION_REQUIRED");

const bFuture90s = evaluateBackupMetadata({ ...validBackup, createdAt: ninetySecondsFutureIso }, "proj-anclora-prod-1234", "br-gentle-bar-ag3slpph", nowIso, THIRTY_MIN_MS);
assert("Future timestamp (>60s NTP skew tolerance, replaces old 5m tolerance) fails", !bFuture90s.valid && bFuture90s.code === "BACKUP_TIMESTAMP_IN_FUTURE");

const bFuture30s = evaluateBackupMetadata({ ...validBackup, createdAt: thirtySecondsFutureIso }, "proj-anclora-prod-1234", "br-gentle-bar-ag3slpph", nowIso, THIRTY_MIN_MS);
assert("Sub-minute NTP skew (<=60s) passes", bFuture30s.valid);

const bUrlRef = evaluateBackupMetadata({ ...validBackup, id: "postgres://user:pass@host/db" }, "proj-anclora-prod-1234", "br-gentle-bar-ag3slpph", nowIso, THIRTY_MIN_MS);
assert("Backup containing connection URL fails", !bUrlRef.valid);

const bNoThreshold = evaluateBackupMetadata(validBackup, "proj-anclora-prod-1234", "br-gentle-bar-ag3slpph", nowIso);
assert("H8: missing freshness threshold fails closed (no default)", !bNoThreshold.valid && (bNoThreshold.reason?.includes("not configured") ?? false));
assert("H8: zero / negative / NaN threshold fails", ![0, -1, NaN].some((t) => evaluateBackupMetadata(validBackup, "proj-anclora-prod-1234", "br-gentle-bar-ag3slpph", nowIso, t).valid));

const bExceedsOd03Cap = evaluateBackupMetadata(validBackup, "proj-anclora-prod-1234", "br-gentle-bar-ag3slpph", nowIso, 60 * 60 * 1000);
assert("Threshold exceeding OD-03 30-minute policy cap fails closed", !bExceedsOd03Cap.valid && bExceedsOd03Cap.code === "OD03_THRESHOLD_EXCEEDS_MAX_30M");

// 5b. Ledger floor (H4)
console.log("\n--- 5b. Ledger baseline floor (H4) ---");
const lEmpty = evaluatePrismaLedger([], mockCandidates);
assert("H4: empty ledger is invalid (unmanaged database / wrong target)", !lEmpty.valid && lEmpty.appliedCount === 0);
const lShort = evaluatePrismaLedger(l1.valid ? [] : [], mockCandidates, { minimumAppliedMigrations: 2 });
assert("H4: ledger shorter than the required baseline is invalid", !lShort.valid);

// 6. Decision Engine & AI Advisory
console.log("\n--- 6. Decision Engine & Fail-Closed Guard ---");
const allPassInput: DeterministicChecksInput = {
  webhookContextValid: true,
  gitAncestryValid: true,
  ledgerResult: l1,
  backupResult: b1,
  aiAdvisory: {
    riskLevel: "LOW"
  }
};
const d1 = decideProtectionRule(allPassInput);
assert("All deterministic checks pass -> APPROVED", d1.decision === "APPROVED");

const failedBackupInput: DeterministicChecksInput = {
  ...allPassInput,
  backupResult: bNotReady
};
const d2 = decideProtectionRule(failedBackupInput);
assert("Failed backup -> REJECTED", d2.decision === "REJECTED");

const aiVetoInput: DeterministicChecksInput = {
  ...allPassInput,
  aiAdvisory: {
    riskLevel: "CRITICAL",
    flaggedIssues: ["Detected destructive table drop syntax in custom query"]
  }
};
const d3 = decideProtectionRule(aiVetoInput);
assert("Deterministic pass + AI veto -> REJECTED (fail-closed)", d3.decision === "REJECTED");

console.log("\n================================================");
console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
}
