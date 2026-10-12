-- F-4: one-time OAuth handoff codes. Expand-only (new table, nothing existing is altered).
-- A row is created only AFTER the provider transaction (state/PKCE) was validated and the account resolved; the browser
-- redeems it with the verifier whose S256 challenge it presented when it started the flow. Only the SHA-256 of the code
-- is stored. Logical expiry at "expiresAt"; physical removal by purgeExpiredOAuthHandoffs (not scheduled here).
-- Rollback: DROP TABLE "oauth_handoffs";
CREATE TABLE "oauth_handoffs" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "challenge" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "oauth_handoffs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "oauth_handoffs_codeHash_key" ON "oauth_handoffs"("codeHash");

CREATE INDEX "oauth_handoffs_expiresAt_idx" ON "oauth_handoffs"("expiresAt");

ALTER TABLE "oauth_handoffs" ADD CONSTRAINT "oauth_handoffs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
