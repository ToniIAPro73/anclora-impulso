/**
 * QA identity account (L1): explicit, audited link between an existing Impulso user and an Anclora Identity subject.
 * Spec: sdd/features/qa-identity-account/qa-identity-account-spec-v1.md. Run by Toni only; never links by email.
 *
 *   DATABASE_URL='<direct URL>' pnpm exec tsx scripts/maintenance/link-identity.ts \
 *     --user-id <impulso user uuid> --issuer <identity issuer url> --subject <identity user uuid> \
 *     --operator "<who is running this and why>" --target-endpoint <ep-...>
 *
 * Safety: DATABASE_URL must be set in the shell (a value loaded from backend/.env is refused) and its host must start
 * with --target-endpoint, so the operator states which database is written. Prints the outcome only, never the URL.
 */
function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : undefined;
}

function fail(message: string, code = 2): never {
  console.error(`REFUSED: ${message}`);
  process.exit(code);
}

async function main() {
  // Checked before Prisma is loaded: Prisma would otherwise merge backend/.env into process.env.
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) fail('DATABASE_URL must be set explicitly in the shell');

  const userId = arg('user-id');
  const issuer = arg('issuer');
  const subject = arg('subject');
  const operator = arg('operator');
  const targetEndpoint = arg('target-endpoint');
  if (!userId || !issuer || !subject || !operator || !targetEndpoint) {
    fail('usage: --user-id <uuid> --issuer <url> --subject <id> --operator "<who/why>" --target-endpoint <ep-...>');
  }

  let host: string;
  try {
    host = new URL(databaseUrl).hostname;
  } catch {
    fail('DATABASE_URL cannot be parsed');
  }
  if (!/^ep-[a-z0-9-]+$/.test(targetEndpoint) || !host.startsWith(`${targetEndpoint}.`) && !host.startsWith(`${targetEndpoint}-pooler.`)) {
    fail('DATABASE_URL host does not match --target-endpoint');
  }

  const { linkIdentityByOperator } = await import('../../src/services/identity-link.service');
  const { prisma } = await import('../../src/config/database');
  try {
    const result = await linkIdentityByOperator({ userId, issuer, subject, operator });
    console.log(JSON.stringify({ targetEndpoint, ...result }));
    if (result.outcome !== 'LINKED' && result.outcome !== 'ALREADY_LINKED') process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('link-identity failed:', error instanceof Error ? error.message.split('\n').slice(-1)[0] : error);
  process.exit(1);
});
