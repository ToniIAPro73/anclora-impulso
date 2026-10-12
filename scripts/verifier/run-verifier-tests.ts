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

// 5. Backup Verification
console.log("\n--- 5. Backup Verification ---");
const TWO_HOURS_MS = 2 * 60 * 60 * 1000; // test fixture only: the real threshold is the open decision OD-03
const nowIso = new Date().toISOString();
const tenMinAgoIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();
const threeHoursAgoIso = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

const validBackup: BackupMetadata = {
  id: "neon-snap-test-20261012-001",
  projectId: "proj-anclora-prod-1234",
  sourceBranch: "main",
  createdAt: tenMinAgoIso,
  status: "ready"
};

const b1 = evaluateBackupMetadata(validBackup, "proj-anclora-prod-1234", "main", nowIso, TWO_HOURS_MS);
assert("Valid recent ready backup passes", b1.valid);

const bOld = evaluateBackupMetadata({ ...validBackup, createdAt: threeHoursAgoIso }, "proj-anclora-prod-1234", "main", nowIso, TWO_HOURS_MS);
assert("Stale backup (>2h) fails", !bOld.valid);

const bNotReady = evaluateBackupMetadata({ ...validBackup, status: "creating" }, "proj-anclora-prod-1234", "main", nowIso, TWO_HOURS_MS);
assert("Backup not in ready state fails", !bNotReady.valid);

const bUrlRef = evaluateBackupMetadata({ ...validBackup, id: "postgres://user:pass@host/db" }, "proj-anclora-prod-1234", "main", nowIso, TWO_HOURS_MS);
assert("Backup containing connection URL fails", !bUrlRef.valid);

const bNoThreshold = evaluateBackupMetadata(validBackup, "proj-anclora-prod-1234", "main", nowIso);
assert("H8: missing freshness threshold fails closed (no default)", !bNoThreshold.valid && (bNoThreshold.reason?.includes("not configured") ?? false));
assert("H8: zero / negative / NaN threshold fails", ![0, -1, NaN].some((t) => evaluateBackupMetadata(validBackup, "proj-anclora-prod-1234", "main", nowIso, t).valid));

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
