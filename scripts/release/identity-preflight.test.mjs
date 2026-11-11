import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import {
  assertNoForbiddenCliFlags,
  assertNoSensitiveLeak,
  assertReadOnlySql,
  extractTargetIdentity,
  LEDGER_READ_ONLY_SQL,
  normalizeOptionalFingerprint,
  parseCliArgs,
  runIdentityPreflight,
} from './identity-preflight.mjs'
import { computeCrlfSqlSha256, computeDatabaseFingerprint } from './emit-migration-attestation.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const IMPULSO_ROOT = resolve(HERE, '../..')

const sha256Hex = (input) => createHash('sha256').update(input).digest('hex')

const makeFixtureRepo = (declaredFingerprint = null) => {
  const root = mkdtempSync(join(tmpdir(), 'impulso-id-preflight-'))
  mkdirSync(join(root, '.anclora'), { recursive: true })
  mkdirSync(join(root, 'scripts/release'), { recursive: true })
  mkdirSync(join(root, 'backend/prisma/migrations/20251120020551_init'), { recursive: true })
  mkdirSync(join(root, 'backend/prisma/migrations/20260312215517_legacy'), { recursive: true })
  mkdirSync(join(root, 'backend/prisma/migrations/20261111211500_m27'), { recursive: true })

  const sqlInit = 'CREATE TABLE a(\n  id INT PRIMARY KEY\n);\n'
  const sqlLegacy = 'CREATE TABLE b(\n  id INT\n);\n'
  const sqlM27 = 'CREATE TABLE c(\n  id INT\n);\n'

  writeFileSync(join(root, 'backend/prisma/migrations/20251120020551_init/migration.sql'), sqlInit)
  writeFileSync(join(root, 'backend/prisma/migrations/20260312215517_legacy/migration.sql'), sqlLegacy)
  writeFileSync(join(root, 'backend/prisma/migrations/20261111211500_m27/migration.sql'), sqlM27)

  const manifest = {
    version: 1,
    migrations: [
      { name: '20251120020551_init', sha256: sha256Hex(sqlInit) },
      { name: '20260312215517_legacy', sha256: sha256Hex(sqlLegacy) },
      { name: '20261111211500_m27', sha256: sha256Hex(sqlM27) },
    ],
    historicalChecksumEquivalences: [
      {
        name: '20260312215517_legacy',
        reason: 'legacy-2026-03-crlf-baseline',
        lineEndingMode: 'CRLF',
        lfSha256: sha256Hex(sqlLegacy),
        crlfSha256: computeCrlfSqlSha256(sqlLegacy),
      },
    ],
  }
  writeFileSync(join(root, 'scripts/release/release-manifest.json'), JSON.stringify(manifest, null, 2))

  const runtimeLines = [
    'DATABASE_PROVIDER=Neon/Postgres',
    'MIGRATION_SYSTEM=Prisma Migrate (PostgreSQL on Neon)',
    'MIGRATION_DIRECTORY=backend/prisma/migrations',
    'MIGRATION_MANIFEST_PATH=scripts/release/release-manifest.json',
    'BACKEND_RENDER_SERVICE_ID=srv-d6ps41v5r7bs73dvrudg',
  ]
  if (declaredFingerprint) {
    runtimeLines.push(`DATABASE_TARGET_FINGERPRINT=${declaredFingerprint}`)
  }
  writeFileSync(join(root, '.anclora/PRODUCTION_RUNTIME.md'), `${runtimeLines.join('\n')}\n`)

  const ledgerRows = [
    {
      migration_name: '20251120020551_init',
      checksum: sha256Hex(sqlInit),
      finished_at: '2026-01-01T00:00:00Z',
      rolled_back_at: null,
    },
    {
      migration_name: '20260312215517_legacy',
      checksum: computeCrlfSqlSha256(sqlLegacy),
      finished_at: null,
      rolled_back_at: '2026-03-12T01:00:00Z',
    },
    {
      migration_name: '20260312215517_legacy',
      checksum: computeCrlfSqlSha256(sqlLegacy),
      finished_at: '2026-03-12T01:05:00Z',
      rolled_back_at: null,
    },
  ]

  return {
    root,
    ledgerRows,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  }
}

test('S1: workflow identity-preflight no contiene DDL, migrate deploy, seed, promoción, despliegue ni permisos de escritura', () => {
  const wfRaw = readFileSync(
    join(IMPULSO_ROOT, '.github/workflows/production-db-identity-preflight.yml'),
    'utf8',
  )
  const wf = wfRaw
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n')
  assert.match(wf, /workflow_dispatch:/)
  assert.match(wf, /environment:\s*production-migrations/)
  assert.match(wf, /secrets\.PRODUCTION_MIGRATION_DATABASE_URL/)
  assert.doesNotMatch(wf, /id-token:\s*write/)
  assert.doesNotMatch(wf, /attestations:\s*write/)
  assert.doesNotMatch(wf, /contents:\s*write/)
  assert.doesNotMatch(
    wf,
    /prisma\s+migrate|prisma\s+db\s+push|db\s+seed|promote\.yml|vercel\s+--prod|render\s+deploys|migration-attestation\.json|git\s+push|\b(CREATE|ALTER|DROP|TRUNCATE)\s+(TABLE|INDEX|SCHEMA)/i,
  )
  // Static check on identity-preflight.mjs itself (ignoring JSDoc comments) for forbidden side-effect commands
  const scriptSrc = readFileSync(join(HERE, 'identity-preflight.mjs'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')
  assert.doesNotMatch(scriptSrc, /prisma\s+migrate|prisma\s+db\s+push|writeFileSync\([^)]*PRODUCTION_RUNTIME/i)
})

test('S2: guardias estáticos bloquean flags de mutación, DDL/DML, URLs pooled y fugas de credenciales', () => {
  assert.throws(() => assertNoForbiddenCliFlags(['--migrate']), /PREFLIGHT_FORBIDDEN_OPERATION/)
  assert.throws(() => assertNoForbiddenCliFlags(['--seed']), /PREFLIGHT_FORBIDDEN_OPERATION/)
  assert.throws(() => assertNoForbiddenCliFlags(['--promote']), /PREFLIGHT_FORBIDDEN_OPERATION/)
  assert.throws(() => assertNoForbiddenCliFlags(['--deploy']), /PREFLIGHT_FORBIDDEN_OPERATION/)
  assert.throws(() => assertNoForbiddenCliFlags(['--backup']), /PREFLIGHT_FORBIDDEN_OPERATION/)

  assert.doesNotThrow(() => assertReadOnlySql(LEDGER_READ_ONLY_SQL))
  assert.throws(() => assertReadOnlySql('DELETE FROM "_prisma_migrations";'), /PREFLIGHT_FORBIDDEN_SQL/)
  assert.throws(() => assertReadOnlySql('CREATE TABLE evil(id INT);'), /PREFLIGHT_FORBIDDEN_SQL/)
  assert.throws(() => assertReadOnlySql('SELECT * FROM "users";'), /PREFLIGHT_FORBIDDEN_SQL/)
  assert.throws(
    () => assertReadOnlySql(`${LEDGER_READ_ONLY_SQL} DROP TABLE "_prisma_migrations";`),
    /PREFLIGHT_FORBIDDEN_SQL/,
  )

  const pooled = 'postgresql://role:pwsecret@ep-prod-123-pooler.eu-central-1.aws.neon.tech:5432/impulsodb?sslmode=require'
  assert.throws(() => extractTargetIdentity(pooled, { requireDirect: true }), /PREFLIGHT_POOLED_URL_FORBIDDEN/)

  assert.throws(
    () => assertNoSensitiveLeak('url=postgresql://u:p@host/db', []),
    /PREFLIGHT_SENSITIVE_LEAK_BLOCKED/,
  )
  assert.throws(
    () => assertNoSensitiveLeak('host ep-secret-999.neon.tech leaked', ['ep-secret-999.neon.tech']),
    /PREFLIGHT_SENSITIVE_LEAK_BLOCKED/,
  )
})

test('S3: Render y Neon sin credenciales autorizadas declaran RENDER_IDENTITY_UNVERIFIED y NEON_IDENTITY_UNVERIFIED sin inferir ni filtrar URLs', async () => {
  const fx = makeFixtureRepo()
  const directUrl = 'postgresql://mig_role:supersecretpw@ep-prod-xyz.eu-central-1.aws.neon.tech:5432/impulso_real?sslmode=require'
  const expectedFp = computeDatabaseFingerprint(directUrl)
  const runtimeBefore = readFileSync(join(fx.root, '.anclora/PRODUCTION_RUNTIME.md'), 'utf8')

  try {
    const { report, serialized } = await runIdentityPreflight({
      repoRoot: fx.root,
      candidateSha: 'a'.repeat(40),
      databaseUrl: directUrl,
      renderApiKey: '',
      neonApiKey: '',
      ledgerRows: fx.ledgerRows,
    })

    assert.equal(report.status, 'BLOCKED_OPERATOR_VERIFICATION')
    assert.equal(report.observedTarget.fingerprint, expectedFp)
    assert.equal(report.observedTarget.port, '5432')
    assert.equal(report.observedTarget.isPooler, false)
    assert.equal(report.render.status, 'RENDER_IDENTITY_UNVERIFIED')
    assert.equal(report.neon.status, 'NEON_IDENTITY_UNVERIFIED')
    assert.ok(report.unverified.includes('RENDER_IDENTITY_UNVERIFIED'))
    assert.ok(report.unverified.includes('NEON_IDENTITY_UNVERIFIED'))
    assert.ok(report.unverified.includes('CONTRACT_FINGERPRINT_UNDECLARED'))
    assert.equal(report.contract.contractMutatedByPreflight, false)
    assert.equal(report.ledger.integrityClean, true)
    assert.equal(report.ledger.pendingCount, 1)
    assert.deepEqual(report.ledger.pendingMigrationNames, ['20261111211500_m27'])
    assert.equal(report.ledger.acceptedHistoricalEquivalencesCount, 1)
    assert.equal(report.ledger.resolvedRolledBackCount, 1)

    // Never leaks URL, host, user, password or DB name, and never mutates contract
    assert.doesNotMatch(serialized, /mig_role|supersecretpw|ep-prod-xyz|impulso_real|postgresql:\/\//)
    assert.equal(readFileSync(join(fx.root, '.anclora/PRODUCTION_RUNTIME.md'), 'utf8'), runtimeBefore)
  } finally {
    fx.cleanup()
  }
})

test('S4: verificación cruzada completa GitHub + Render + Neon + Contrato -> IDENTITY_VERIFIED_MATCH y bloqueos por drift/sustitución', async () => {
  const directUrl = 'postgresql://mig_role:p1@ep-prod-987.eu-central-1.aws.neon.tech:5432/impulso_prod?sslmode=require'
  const poolerRenderUrl = 'postgresql://app_role:p2@ep-prod-987-pooler.eu-central-1.aws.neon.tech:5432/impulso_prod?sslmode=require'
  const wrongDbUrl = 'postgresql://app_role:p2@ep-prod-987-pooler.eu-central-1.aws.neon.tech:5432/other_db?sslmode=require'
  const fp = computeDatabaseFingerprint(directUrl)
  const fx = makeFixtureRepo(fp)

  const makeMockFetch = (renderUrl, branchPrimary = true) => async (url) => {
    const u = String(url)
    if (u.endsWith('/services/srv-d6ps41v5r7bs73dvrudg')) {
      return { ok: true, status: 200, json: async () => ({ service: { id: 'srv-d6ps41v5r7bs73dvrudg', name: 'Anclora-Impulso', branch: 'production', rootDir: 'backend' } }) }
    }
    if (u.includes('/env-vars')) {
      return { ok: true, status: 200, json: async () => ([{ envVar: { key: 'DATABASE_URL', value: renderUrl } }]) }
    }
    if (u.endsWith('/projects/neon_proj_real')) {
      return { ok: true, status: 200, json: async () => ({ project: { id: 'neon_proj_real', region_id: 'aws-eu-central-1' } }) }
    }
    if (u.endsWith('/branches')) {
      return { ok: true, status: 200, json: async () => ({ branches: [{ id: 'br-prod-1', name: 'production', primary: branchPrimary, default: branchPrimary, protected: true, current_state: 'ready' }] }) }
    }
    if (u.endsWith('/endpoints')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          endpoints: [{ id: 'ep-prod-987', branch_id: branchPrimary ? 'br-prod-1' : 'br-preview-2', host: 'ep-prod-987.eu-central-1.aws.neon.tech', type: 'read_write' }],
        }),
      }
    }
    if (u.includes('/databases')) {
      return { ok: true, status: 200, json: async () => ({ databases: [{ name: 'impulso_prod', owner_name: 'neondb_owner' }] }) }
    }
    if (u.endsWith('/snapshots')) {
      return { ok: true, status: 200, json: async () => ({ snapshots: [{ id: 'snap-existing-1', source_branch_id: 'br-prod-1', created_at: '2026-11-11T00:00:00Z' }] }) }
    }
    return { ok: false, status: 404, json: async () => ({}) }
  }

  try {
    const ok = await runIdentityPreflight({
      repoRoot: fx.root,
      candidateSha: 'b'.repeat(40),
      databaseUrl: directUrl,
      defaultBranchContractFingerprint: fp,
      renderApiKey: 'rnd_test_key',
      neonApiKey: 'neon_test_key',
      neonProjectId: 'neon_proj_real',
      ledgerRows: fx.ledgerRows,
      fetchFn: makeMockFetch(poolerRenderUrl, true),
    })
    assert.equal(ok.report.status, 'IDENTITY_VERIFIED')
    assert.equal(ok.report.contract.contractFingerprintMatchesObserved, true)
    assert.equal(ok.report.render.comparison.fingerprintMatches, true)
    assert.equal(ok.report.render.comparison.endpointMatches, true)
    assert.equal(ok.report.render.comparison.portMatches, true)
    assert.equal(ok.report.render.comparison.databaseMatches, true)
    assert.equal(ok.report.neon.comparison.endpointBelongsToProductionBranch, true)
    assert.equal(ok.report.neon.comparison.databaseConfirmedOnBranch, true)
    assert.equal(ok.report.neon.recoveryOptions.snapshots.length, 1)

    // Anti-substitution: workflow input cannot override registered contract fingerprint
    await assert.rejects(
      () => runIdentityPreflight({
        repoRoot: fx.root,
        databaseUrl: directUrl,
        defaultBranchContractFingerprint: fp,
        expectedFingerprint: `sha256:${'c'.repeat(64)}`,
        ledgerRows: fx.ledgerRows,
      }),
      /PREFLIGHT_CONTRACT_OVERRIDE_FORBIDDEN/,
    )

    // Candidate cannot silently swap contract relative to default branch
    await assert.rejects(
      () => runIdentityPreflight({
        repoRoot: fx.root,
        databaseUrl: directUrl,
        defaultBranchContractFingerprint: `sha256:${'d'.repeat(64)}`,
        ledgerRows: fx.ledgerRows,
      }),
      /PREFLIGHT_CONTRACT_DRIFT/,
    )

    // Render pointing to different DB -> IDENTITY_MISMATCH_BLOCKED
    const renderMismatch = await runIdentityPreflight({
      repoRoot: fx.root,
      databaseUrl: directUrl,
      defaultBranchContractFingerprint: fp,
      renderApiKey: 'rnd_test_key',
      neonApiKey: 'neon_test_key',
      neonProjectId: 'neon_proj_real',
      ledgerRows: fx.ledgerRows,
      fetchFn: makeMockFetch(wrongDbUrl, true),
    })
    assert.equal(renderMismatch.report.status, 'IDENTITY_MISMATCH_BLOCKED')
    assert.ok(renderMismatch.report.mismatches.includes('RENDER_TARGET_MISMATCH'))

    // Neon endpoint belonging to non-production branch -> IDENTITY_MISMATCH_BLOCKED
    const neonBranchMismatch = await runIdentityPreflight({
      repoRoot: fx.root,
      databaseUrl: directUrl,
      defaultBranchContractFingerprint: fp,
      renderApiKey: 'rnd_test_key',
      neonApiKey: 'neon_test_key',
      neonProjectId: 'neon_proj_real',
      ledgerRows: fx.ledgerRows,
      fetchFn: makeMockFetch(poolerRenderUrl, false),
    })
    assert.equal(neonBranchMismatch.report.status, 'IDENTITY_MISMATCH_BLOCKED')
    assert.ok(neonBranchMismatch.report.mismatches.includes('NEON_BRANCH_OR_ENDPOINT_MISMATCH'))

    // CLI guard blocks forbidden flags before doing anything
    const cliBlocked = spawnSync(
      process.execPath,
      [join(HERE, 'identity-preflight.mjs'), '--migrate'],
      { encoding: 'utf8' },
    )
    assert.notEqual(cliBlocked.status, 0)
    assert.match(cliBlocked.stderr, /PREFLIGHT_FORBIDDEN_OPERATION/)
  } finally {
    fx.cleanup()
  }
})

test('S5: parseCliArgs y normalizeOptionalFingerprint validan tipos, cadenas vacías, formatos inválidos y BLOCKED_OPERATOR_VERIFICATION sin referencia independiente', async () => {
  const fx = makeFixtureRepo()
  const directUrl = 'postgresql://mig_role:pw1@ep-prod-555.eu-central-1.aws.neon.tech:5432/impulso_prod?sslmode=require'
  const validFp = computeDatabaseFingerprint(directUrl)

  try {
    // 1) parseCliArgs con valores vacíos desde GitHub Actions ("") no los convierte en booleanos
    const parsedEmpty = parseCliArgs([
      '--repo-root', '.',
      '--candidate-sha', 'a'.repeat(40),
      '--default-branch-fingerprint', '',
      '--expected-fingerprint', '',
      '--output', 'identity-preflight.json',
    ])
    assert.equal(parsedEmpty['default-branch-fingerprint'], '')
    assert.equal(parsedEmpty['expected-fingerprint'], '')

    // Flag de valor sin argumento falla cerrado
    assert.throws(
      () => parseCliArgs(['--expected-fingerprint', '--output', 'out.json']),
      /PREFLIGHT_INVALID_CLI_ARG/,
    )

    // 2) normalizeOptionalFingerprint: undefined, null, '', false, formato inválido y válido
    assert.equal(normalizeOptionalFingerprint(undefined, 'expectedFingerprint'), null)
    assert.equal(normalizeOptionalFingerprint(null, 'expectedFingerprint'), null)
    assert.equal(normalizeOptionalFingerprint('', 'expectedFingerprint'), null)
    assert.equal(normalizeOptionalFingerprint('   ', 'expectedFingerprint'), null)
    assert.throws(
      () => normalizeOptionalFingerprint(false, 'expectedFingerprint'),
      /PREFLIGHT_INVALID_FINGERPRINT_TYPE/,
    )
    assert.throws(
      () => normalizeOptionalFingerprint(true, 'expectedFingerprint'),
      /PREFLIGHT_INVALID_FINGERPRINT_TYPE/,
    )
    assert.throws(
      () => normalizeOptionalFingerprint('sha256:nothex', 'expectedFingerprint'),
      /PREFLIGHT_INVALID_FINGERPRINT_FORMAT/,
    )
    assert.equal(normalizeOptionalFingerprint(validFp, 'expectedFingerprint'), validFp)

    // 3) runIdentityPreflight con undefined, null y cadena vacía -> BLOCKED_OPERATOR_VERIFICATION (nunca IDENTITY_VERIFIED)
    for (const emptyVal of [undefined, null, '']) {
      const res = await runIdentityPreflight({
        repoRoot: fx.root,
        candidateSha: 'a'.repeat(40),
        databaseUrl: directUrl,
        defaultBranchContractFingerprint: emptyVal,
        expectedFingerprint: emptyVal,
        renderApiKey: '',
        neonApiKey: '',
        ledgerRows: fx.ledgerRows,
      })
      assert.equal(res.report.status, 'BLOCKED_OPERATOR_VERIFICATION')
      assert.notEqual(res.report.status, 'IDENTITY_VERIFIED')
      assert.equal(res.report.contract.inputExpectedFingerprintProvided, false)
    }

    // 4) runIdentityPreflight rechaza explícitamente boolean false o formato inválido (fail-closed)
    await assert.rejects(
      () => runIdentityPreflight({
        repoRoot: fx.root,
        databaseUrl: directUrl,
        expectedFingerprint: false,
        ledgerRows: fx.ledgerRows,
      }),
      /PREFLIGHT_INVALID_FINGERPRINT_TYPE/,
    )
    await assert.rejects(
      () => runIdentityPreflight({
        repoRoot: fx.root,
        databaseUrl: directUrl,
        expectedFingerprint: 'sha256:bad',
        ledgerRows: fx.ledgerRows,
      }),
      /PREFLIGHT_INVALID_FINGERPRINT_FORMAT/,
    )

    // 5) Con fingerprint válido igual al observado, si falta Render o Neon sigue devolviendo BLOCKED_OPERATOR_VERIFICATION
    const withExpectedOnly = await runIdentityPreflight({
      repoRoot: fx.root,
      candidateSha: 'a'.repeat(40),
      databaseUrl: directUrl,
      expectedFingerprint: validFp,
      renderApiKey: '',
      neonApiKey: '',
      ledgerRows: fx.ledgerRows,
    })
    assert.equal(withExpectedOnly.report.status, 'BLOCKED_OPERATOR_VERIFICATION')
    assert.equal(withExpectedOnly.report.contract.inputExpectedFingerprintMatchesObserved, true)

    // 6) Invocación CLI real con --default-branch-fingerprint "" --expected-fingerprint "" nunca falla con .trim is not a function
    const cliEmptyFlags = spawnSync(
      process.execPath,
      [
        join(HERE, 'identity-preflight.mjs'),
        '--repo-root', fx.root,
        '--candidate-sha', 'a'.repeat(40),
        '--default-branch-fingerprint', '',
        '--expected-fingerprint', '',
      ],
      { encoding: 'utf8', env: { ...process.env, PRODUCTION_MIGRATION_DATABASE_URL: '' } },
    )
    assert.notEqual(cliEmptyFlags.status, 0)
    assert.doesNotMatch(cliEmptyFlags.stderr, /trim is not a function/)
    assert.match(cliEmptyFlags.stderr, /PREFLIGHT_DATABASE_URL_MISSING/)
  } finally {
    fx.cleanup()
  }
})
