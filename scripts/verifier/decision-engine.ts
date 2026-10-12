import { LedgerEvaluationResult } from "./ledger-evaluator.js";
import { BackupEvaluationResult } from "./backup-evaluator.js";

export type VerifierDecision = "APPROVED" | "REJECTED";

export interface DeterministicChecksInput {
  webhookContextValid: boolean;
  webhookContextReason?: string;
  gitAncestryValid: boolean;
  gitAncestryReason?: string;
  ledgerResult: LedgerEvaluationResult;
  backupResult: BackupEvaluationResult;
  aiAdvisory?: {
    riskLevel?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    flaggedIssues?: string[];
  };
}

export interface DecisionOutcome {
  decision: VerifierDecision;
  reasons: string[];
  auditRecord: {
    timestamp: string;
    checks: Record<string, boolean>;
    details: Record<string, unknown>;
  };
}

/**
 * Deterministic Decision Engine.
 * AI advice is STRICTLY ADVISORY.
 * AI CANNOT overturn a failed deterministic check.
 * AI CAN trigger a fail-closed REJECT if it spots critical unmapped risks, but CANNOT grant approval.
 */
export function decideProtectionRule(input: DeterministicChecksInput): DecisionOutcome {
  const reasons: string[] = [];
  const checks: Record<string, boolean> = {
    webhookContext: input.webhookContextValid,
    gitAncestry: input.gitAncestryValid,
    ledgerIntegrity: input.ledgerResult.valid,
    backupIntegrity: input.backupResult.valid
  };

  if (!input.webhookContextValid) {
    reasons.push(`Webhook validation failed: ${input.webhookContextReason || "unknown"}`);
  }
  if (!input.gitAncestryValid) {
    reasons.push(`Git ancestry validation failed: ${input.gitAncestryReason || "unknown"}`);
  }
  if (!input.ledgerResult.valid) {
    reasons.push(`Ledger verification failed: ${input.ledgerResult.reason || "unknown"}`);
  }
  if (!input.backupResult.valid) {
    reasons.push(`Backup verification failed: ${input.backupResult.reason || "unknown"}`);
  }

  // AI advisory check (can only vet or veto, never approve)
  if (input.aiAdvisory) {
    if (input.aiAdvisory.riskLevel === "CRITICAL" || input.aiAdvisory.riskLevel === "HIGH") {
      reasons.push(`AI Advisory vetoed: High/Critical risk detected: ${(input.aiAdvisory.flaggedIssues || []).join(", ")}`);
      checks["aiAdvisoryAccepted"] = false;
    } else {
      checks["aiAdvisoryAccepted"] = true;
    }
  }

  const allPassed = Object.values(checks).every(Boolean);

  return {
    decision: allPassed ? "APPROVED" : "REJECTED",
    reasons: allPassed ? ["All deterministic checks and advisory gates passed"] : reasons,
    auditRecord: {
      timestamp: new Date().toISOString(),
      checks,
      details: {
        appliedMigrationsCount: input.ledgerResult.appliedCount,
        pendingMigrationsCount: input.ledgerResult.pendingCount,
        pendingMigrationNames: input.ledgerResult.pendingMigrations,
        backupId: input.backupResult.backupId
      }
    }
  };
}
