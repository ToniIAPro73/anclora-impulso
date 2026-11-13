-- CreateTable
CREATE TABLE "identity_links" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "email_at_link" TEXT,
    "linked_via" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "identity_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_link_audits" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identity_link_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "identity_links_user_id_idx" ON "identity_links"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "identity_links_issuer_subject_key" ON "identity_links"("issuer", "subject");

-- CreateIndex
CREATE INDEX "identity_link_audits_user_id_created_at_idx" ON "identity_link_audits"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "identity_link_audits_issuer_subject_idx" ON "identity_link_audits"("issuer", "subject");

-- AddForeignKey
ALTER TABLE "identity_links" ADD CONSTRAINT "identity_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

