import crypto from "node:crypto";

/**
 * Validates the GitHub webhook signature using HMAC-SHA256.
 */
export function verifyWebhookSignature(payloadBody: string, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader || !secret) {
    return false;
  }
  const parts = signatureHeader.split("=");
  if (parts.length !== 2 || parts[0] !== "sha256") {
    return false;
  }
  const expectedSignature = parts[1];
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payloadBody, "utf8");
  const digest = hmac.digest("hex");
  
  if (digest.length !== expectedSignature.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(digest, "utf8"), Buffer.from(expectedSignature, "utf8"));
}

export interface WebhookPayload {
  action: string;
  environment: string;
  event: string;
  deployment_callback_url: string;
  deployment?: {
    id: number;
    sha: string;
    ref: string;
    environment: string;
  };
  workflow_run?: {
    id: number;
    head_sha: string;
    head_branch: string;
  };
  repository?: {
    full_name: string;
    default_branch: string;
  };
}

export interface ReplayCache {
  has(deliveryId: string): boolean;
  add(deliveryId: string, timestamp: number): void;
}

export class InMemoryReplayCache implements ReplayCache {
  private cache = new Map<string, number>();
  private readonly ttlMs: number;

  constructor(ttlMs = 10 * 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  has(deliveryId: string): boolean {
    this.cleanup();
    return this.cache.has(deliveryId);
  }

  add(deliveryId: string, timestamp: number = Date.now()): void {
    this.cleanup();
    this.cache.set(deliveryId, timestamp);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [id, time] of this.cache.entries()) {
      if (now - time > this.ttlMs) {
        this.cache.delete(id);
      }
    }
  }
}

export interface WebhookContextValidation {
  valid: boolean;
  reason?: string;
}

export function validateWebhookContext(
  eventHeader: string | undefined,
  deliveryId: string | undefined,
  payload: WebhookPayload,
  replayCache: ReplayCache,
  expectedRepo: string,
  expectedEnv: string
): WebhookContextValidation {
  if (eventHeader !== "deployment_protection_rule") {
    return { valid: false, reason: `unsupported event type: ${eventHeader}` };
  }
  if (!deliveryId || typeof deliveryId !== "string" || deliveryId.length < 5) {
    return { valid: false, reason: "invalid or missing X-GitHub-Delivery header" };
  }
  if (replayCache.has(deliveryId)) {
    return { valid: false, reason: `replay detected for delivery: ${deliveryId}` };
  }
  if (payload.event !== "deployment_protection_rule") {
    return { valid: false, reason: `invalid payload event: ${payload.event}` };
  }
  if (payload.environment !== expectedEnv) {
    return { valid: false, reason: `environment mismatch: ${payload.environment} != ${expectedEnv}` };
  }
  if (payload.repository?.full_name !== expectedRepo) {
    return { valid: false, reason: `repository mismatch: ${payload.repository?.full_name} != ${expectedRepo}` };
  }
  const sha = payload.deployment?.sha || payload.workflow_run?.head_sha;
  if (!sha || !/^[0-9a-f]{40}$/.test(sha)) {
    return { valid: false, reason: `invalid or missing commit sha: ${sha}` };
  }
  return { valid: true };
}
