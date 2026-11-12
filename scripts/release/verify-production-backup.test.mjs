import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  adaptNeonBackupResource,
  assertReadOnlyNeonMethod,
  assertSafeRecoveryOperation,
  parseBackupGateContract,
  verifyAttestationBackupG39,
  verifyProductionBackup,
} from './verify-production-backup.mjs'
import {
  buildAttestation,
  computeAttestationDigest,
  computeDatabaseFingerprint,
  validateBackupVerificationBinding,
} from './emit-migration-attestation.mjs'

const REPO_ROOT = resolve(import.meta.dirname, '..', '..')
const FAKE_DB_URL = 'postgresql://reader_user:synthetic_secret@ep-lingering-paper-agjnrga3.eu-central-1.aws.neon.tech/neondb?sslmode=require'
const FAKE_FINGERPRINT = computeDatabaseFingerprint(FAKE_DB_URL)
const CANDIDATE_SHA = 'b'.repeat(40)
const PREFLIGHT_SHA256 = 'c'.repeat(64)

const makeRuntimeContract = ({ maxBackupAgeLine = 'MIGRATION_MAX_BACKUP_AGE_MINUTES=30' } = {}) => [
  'DATABASE_PROVIDER=Neon/Postgres',
  'DATABASE_SCOPE=production',
  `DATABASE_TARGET_FINGERPRINT=${FAKE_FINGERPRINT}`,
  'DATABASE_NEON_PROJECT_ID=lucky-hat-25002521',
  'DATABASE_NEON_PRODUCTION_BRANCH_ID=br-gentle-bar-ag3slpph',
  'DATABASE_NEON_ENDPOINT_ID=ep-lingering-paper-agjnrga3',
  'MIGRATION_SYSTEM=Prisma Migrate (PostgreSQL on Neon)',
  'MIGRATION_DIRECTORY=backend/prisma/migrations',
  'MIGRATION_RUNNER_WORKFLOW=.github/workflows/production-migrations.yml',
  'MIGRATION_ENVIRONMENT=production-migrations',
  'MIGRATION_MANIFEST_PATH=scripts/release/release-manifest.json',
  maxBackupAgeLine,
  '',
].join('\n')

const makeTempRepo = (runtimeText) => {
  const dir = mkdtempSync(join(tmpdir(), 'od03-backup-gate-'))
  mkdirSync(join(dir, '.anclora'), { recursive: true })
  writeFileSync(join(dir, '.anclora', 'PRODUCTION_RUNTIME.md'), runtimeText)
  return dir
}

const makeNeonFetch = ({
  branches = [
    {
      id: 'br-gentle-bar-ag3slpph',
      name: 'main',
      primary: true,
      default: true,
      current_state: 'ready',
      created_at: '2026-11-12T00:18:26Z',
    },
    {
      id: 'br-backup-pre-m27-01',
      name: 'backup-pre-m27',
      parent_id: 'br-gentle-bar-ag3slpph',
      primary: false,
      default: false,
      current_state: 'ready',
      created_at: '2026-11-12T05:30:00Z',
    },
  ],
  endpoints = [
    {
      id: 'ep-lingering-paper-agjnrga3',
      branch_id: 'br-gentle-bar-ag3slpph',
      current_state: 'active',
    },
  ],
  snapshots = [],
} = {}) => {
  const methodsSeen = []
  const fetchImpl = async (url, init = {}) => {
    const method = init.method ?? 'GET'
    assertReadOnlyNeonMethod(method, url)
    methodsSeen.push({ method, url })

    if (url.endsWith('/projects/lucky-hat-25002521')) {
      return { ok: true, status: 200, json: async () => ({ project: { id: 'lucky-hat-25002521' } }) }
    }
    if (url.endsWith('/projects/lucky-hat-25002521/branches')) {
      return { ok: true, status: 200, json: async () => ({ branches }) }
    }
    if (url.endsWith('/projects/lucky-hat-25002521/endpoints')) {
      return { ok: true, status: 200, json: async () => ({ endpoints }) }
    }
    if (url.endsWith('/projects/lucky-hat-25002521/snapshots')) {
      return { ok: true, status: 200, json: async () => ({ snapshots }) }
    }
    return { ok: false, status: 404, json: async () => ({ message: 'not found' }) }
  }
  fetchImpl.methodsSeen = methodsSeen
  return fetchImpl
}

test('OD-03 repo contract stays fail-closed while proposal D-2026-0056 is unapproved', () => {
  const realRuntime = readFileSync(join(REPO_ROOT, '.anclora', 'PRODUCTION_RUNTIME.md'), 'utf8')
  assert.throws(() => parseBackupGateContract(realRuntime), /BACKUP_GATE_BLOCKED_OD03_UNAPPROVED/)
})

test('OD-03 boundary passes at exactly 30m00s, uses only GET, and emits non-secret evidence embedded in MigrationAttestationV1', async () => {
  const repo = makeTempRepo(makeRuntimeContract())
  try {
    const fetchImpl = makeNeonFetch()
    const evidence = await verifyProductionBackup({
      repoRoot: repo,
      databaseUrl: FAKE_DB_URL,
      neonApiKey: 'synthetic-ro-token',
      neonProjectId: 'lucky-hat-25002521',
      candidateSha: CANDIDATE_SHA,
      runId: 9001,
      runAttempt: 1,
      backupReference: 'br-backup-pre-m27-01',
      backupConfirmed: 'true',
      ledgerReviewed: 'true',
      preflightReportSha256: PREFLIGHT_SHA256,
      nowIso: '2026-11-12T06:00:00Z', // exactly 30m after 05:30:00Z
      fetchImpl,
    })

    assert.equal(evidence.evaluatorStatus, 'VERIFIED')
    assert.equal(evidence.maxAllowedAgeMinutes, 30)
    assert.equal(evidence.backup.ageSeconds, 1800)
    assert.equal(evidence.backup.verifiedByProvider, true)
    assert.equal(evidence.backup.providerState, 'ready')
    assert.ok(fetchImpl.methodsSeen.every((c) => c.method === 'GET'))
    assert.doesNotMatch(JSON.stringify(evidence), /synthetic_secret|synthetic-ro-token|neon\.tech|postgresql:\/\//)

    const validated = validateBackupVerificationBinding(evidence, {
      candidateSha: CANDIDATE_SHA,
      runId: 9001,
      observedFingerprint: FAKE_FINGERPRINT,
    })
    assert.equal(validated.backupReference, 'br-backup-pre-m27-01')

    // Tampered evidenceDigest is rejected
    assert.throws(
      () =>
        validateBackupVerificationBinding(
          { ...evidence, backup: { ...evidence.backup, providerState: 'archived' } },
          { candidateSha: CANDIDATE_SHA, runId: 9001, observedFingerprint: FAKE_FINGERPRINT },
        ),
      /ATTESTATION_BACKUP_DIGEST_MISMATCH/,
    )
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('OD-03 rejects all negative cases fail-closed', async () => {
  const repo = makeTempRepo(makeRuntimeContract())
  try {
    const baseCall = (overrides = {}) =>
      verifyProductionBackup({
        repoRoot: repo,
        databaseUrl: FAKE_DB_URL,
        neonApiKey: 'synthetic-ro-token',
        neonProjectId: 'lucky-hat-25002521',
        candidateSha: CANDIDATE_SHA,
        runId: 9002,
        backupReference: 'br-backup-pre-m27-01',
        backupConfirmed: 'true',
        ledgerReviewed: 'true',
        preflightReportSha256: PREFLIGHT_SHA256,
        nowIso: '2026-11-12T05:45:00Z',
        fetchImpl: makeNeonFetch(),
        ...overrides,
      })

    // 1. > 30 minutes
    await assert.rejects(() => baseCall({ nowIso: '2026-11-12T06:00:01Z' }), /BACKUP_STALE/)

    // 3. Snapshot omitting status (never fabricate 'ready')
    await assert.rejects(
      () =>
        baseCall({
          backupReference: 'snap-unverified-001',
          fetchImpl: makeNeonFetch({
            snapshots: [{ id: 'snap-unverified-001', source_branch_id: 'br-gentle-bar-ag3slpph', created_at: '2026-11-12T05:40:00Z' }],
          }),
        }),
      /BACKUP_STATUS_UNVERIFIABLE_FROM_PROVIDER/,
    )

    // 5. Snapshot/branch from previous branch br-empty-forest-ag9p7l45
    await assert.rejects(
      () =>
        baseCall({
          backupReference: 'snap-late-bread-agkwpeoh',
          fetchImpl: makeNeonFetch({
            snapshots: [
              {
                id: 'snap-late-bread-agkwpeoh',
                source_branch_id: 'br-empty-forest-ag9p7l45',
                created_at: '2026-11-12T05:40:00Z',
                status: 'ready',
              },
            ],
          }),
        }),
      /BACKUP_SOURCE_BRANCH_MISMATCH/,
    )

    // 4/additional: production branch itself cannot be supplied as backup_reference
    await assert.rejects(
      () => baseCall({ backupReference: 'br-gentle-bar-ag3slpph' }),
      /BACKUP_REFERENCE_EQUALS_PRODUCTION_BRANCH/,
    )

    // 6. Different Neon project ID
    await assert.rejects(() => baseCall({ neonProjectId: 'other-project-999' }), /BACKUP_GATE_PROJECT_MISMATCH/)

    // 7. Endpoint swapped to another branch between preflight and execution
    await assert.rejects(
      () =>
        baseCall({
          fetchImpl: makeNeonFetch({
            endpoints: [{ id: 'ep-lingering-paper-agjnrga3', branch_id: 'br-empty-forest-ag9p7l45', current_state: 'active' }],
          }),
        }),
      /BACKUP_GATE_ENDPOINT_BRANCH_SWAP_DETECTED/,
    )

    // 8. backup_confirmed=true when backup does not exist in Neon
    await assert.rejects(
      () => baseCall({ backupReference: 'br-nonexistent-backup-01', backupConfirmed: 'true' }),
      /BACKUP_NOT_FOUND_IN_NEON/,
    )

    // 9. Wrong DATABASE_TARGET_FINGERPRINT or URL endpoint mismatch
    await assert.rejects(
      () =>
        baseCall({
          databaseUrl: 'postgresql://user:pass@ep-other-endpoint-99.eu-central-1.aws.neon.tech/neondb?sslmode=require',
        }),
      /BACKUP_GATE_DATABASE_FINGERPRINT_MISMATCH/,
    )

    // 10. Future createdAt (> 60s skew tolerance, e.g. 2m ahead)
    await assert.rejects(
      () => baseCall({ nowIso: '2026-11-12T05:28:00Z' }),
      /BACKUP_TIMESTAMP_IN_FUTURE/,
    )

    // 13a. Threshold > 30 minutes rejected
    const excessRepo = makeTempRepo(makeRuntimeContract({ maxBackupAgeLine: 'MIGRATION_MAX_BACKUP_AGE_MINUTES=60' }))
    try {
      await assert.rejects(
        () => verifyProductionBackup({
          repoRoot: excessRepo,
          databaseUrl: FAKE_DB_URL,
          neonApiKey: 'synthetic-ro-token',
          neonProjectId: 'lucky-hat-25002521',
          candidateSha: CANDIDATE_SHA,
          runId: 9003,
          backupReference: 'br-backup-pre-m27-01',
          backupConfirmed: 'true',
          ledgerReviewed: 'true',
          preflightReportSha256: PREFLIGHT_SHA256,
          fetchImpl: makeNeonFetch(),
        }),
        /BACKUP_GATE_BLOCKED_OD03_THRESHOLD_EXCEEDS_CAP/,
      )
    } finally {
      rmSync(excessRepo, { recursive: true, force: true })
    }
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('Recovery & write guards block mutating Neon calls, production mutations, and unisolated restore drills', () => {
  assert.throws(() => assertReadOnlyNeonMethod('POST', 'https://console.neon.tech/api/v2/projects/p/branches'), /BACKUP_GATE_FORBIDDEN_WRITE_METHOD/)
  assert.throws(() => assertReadOnlyNeonMethod('GET', 'https://console.neon.tech/api/v2/projects/p/branches/b/restore'), /BACKUP_GATE_FORBIDDEN_RECOVERY_ENDPOINT/)
  assert.throws(
    () => assertSafeRecoveryOperation({ action: 'restore', targetBranchId: 'br-gentle-bar-ag3slpph', targetBranchName: 'main', targetEndpointId: 'ep-lingering-paper-agjnrga3' }),
    /RECOVERY_SAFETY_BLOCKED_PRODUCTION_TARGET/,
  )
  assert.throws(
    () => assertSafeRecoveryOperation({ action: 'restore-drill', targetBranchId: 'br-scratch-test-01', isIsolatedTarget: false }),
    /AUTOMATED_RESTORE_DRILL_BLOCKED_NO_VERIFIED_ISOLATION/,
  )
  assert.equal(
    assertSafeRecoveryOperation({ action: 'restore-drill', targetBranchId: 'br-scratch-test-01', targetBranchName: 'drill-iso', targetEndpointId: 'ep-scratch-test', isIsolatedTarget: true }),
    true,
  )
})

test('emit-migration-attestation fails closed without BackupVerificationEvidenceV1 and embeds it when verified', async () => {
  const repo = makeTempRepo(makeRuntimeContract())
  try {
    mkdirSync(join(repo, 'backend', 'prisma', 'migrations', '20251120020551_init'), { recursive: true })
    mkdirSync(join(repo, 'scripts', 'release'), { recursive: true })
    const sql = '-- init\n'
    writeFileSync(join(repo, 'backend', 'prisma', 'migrations', '20251120020551_init', 'migration.sql'), sql)
    execFileSync('node', [join(REPO_ROOT, 'scripts', 'release', 'generate-release-manifest.mjs'), repo], { stdio: 'pipe' })

    const manifest = JSON.parse(readFileSync(join(repo, 'scripts', 'release', 'release-manifest.json'), 'utf8'))
    const checksum = manifest.migrations[0].sha256
    const ledgerRows = [
      { migration_name: '20251120020551_init', checksum, finished_at: '2026-11-12T00:00:00Z', rolled_back_at: null },
    ]

    assert.throws(
      () =>
        buildAttestation({
          repoRoot: repo,
          repository: 'ToniIAPro73/anclora-impulso',
          runId: 9005,
          candidateSha: CANDIDATE_SHA,
          databaseUrl: FAKE_DB_URL,
          ledgerRows,
          requireBackupVerification: true,
        }),
      /ATTESTATION_BACKUP_VERIFICATION_MISSING/,
    )

    const evidence = await verifyProductionBackup({
      repoRoot: repo,
      databaseUrl: FAKE_DB_URL,
      neonApiKey: 'synthetic-ro-token',
      neonProjectId: 'lucky-hat-25002521',
      candidateSha: CANDIDATE_SHA,
      runId: 9005,
      backupReference: 'br-backup-pre-m27-01',
      backupConfirmed: 'true',
      ledgerReviewed: 'true',
      preflightReportSha256: PREFLIGHT_SHA256,
      nowIso: '2026-11-12T05:45:00Z',
      fetchImpl: makeNeonFetch(),
    })

    const att = buildAttestation({
      repoRoot: repo,
      repository: 'ToniIAPro73/anclora-impulso',
      runId: 9005,
      candidateSha: CANDIDATE_SHA,
      databaseUrl: FAKE_DB_URL,
      ledgerRows,
      backupVerification: evidence,
      requireBackupVerification: true,
    })
    assert.equal(att.backupVerification.backupReference, 'br-backup-pre-m27-01')
    assert.equal(att.backupVerification.evidenceDigest, evidence.evidenceDigest)
    assert.match(att.attestationDigest, /^[0-9a-f]{64}$/)

    // Valid G39 verification passes
    const g39Ok = verifyAttestationBackupG39({
      attestation: att,
      backupVerificationArtifact: evidence,
      contractMarkdown: makeRuntimeContract(),
      evaluatedAtIso: '2026-11-12T05:50:00Z',
    })
    assert.equal(g39Ok.status, 'VERIFIED_OD03_G39')

    // Missing backupVerification when OD-03 active fails closed
    const { backupVerification: _omit, attestationDigest: _oldDig, ...withoutBv } = att
    const attMissingBv = { ...withoutBv, attestationDigest: computeAttestationDigest(withoutBv) }
    assert.throws(
      () => verifyAttestationBackupG39({ attestation: attMissingBv, contractMarkdown: makeRuntimeContract() }),
      /PROMOTION_BLOCKED_MIGRATION_BACKUP_EVIDENCE_MISSING/,
    )

    // Tampered attestationDigest rejected
    assert.throws(
      () => verifyAttestationBackupG39({ attestation: { ...att, attestationDigest: '0'.repeat(64) }, contractMarkdown: makeRuntimeContract() }),
      /PROMOTION_BLOCKED_MIGRATION_EVIDENCE_TAMPERED/,
    )

    // Cross-artifact and contract mismatch rejection of Backup ID, Project ID, Branch ID, Fingerprint, Candidate SHA, and lowered TTL
    for (const [label, mutate, pattern] of [
      ['backupReference', (bv) => ({ ...bv, backupReference: 'br-forged-ref-99' }), /PROMOTION_BLOCKED_MIGRATION_BACKUP_TAMPERED/],
      ['projectHash', (bv) => ({ ...bv, neonProjectIdSha256: 'sha256:' + 'f'.repeat(64) }), /PROMOTION_BLOCKED_MIGRATION_BACKUP_PROJECT_MISMATCH/],
      ['branchHash', (bv) => ({ ...bv, sourceBranchIdSha256: 'sha256:' + 'e'.repeat(64) }), /PROMOTION_BLOCKED_MIGRATION_BACKUP_BRANCH_MISMATCH/],
      ['fingerprint', (bv) => ({ ...bv, databaseTargetFingerprint: 'sha256:' + 'd'.repeat(64) }), /PROMOTION_BLOCKED_MIGRATION_DATABASE_MISMATCH/],
      ['candidateSha', (bv) => ({ ...bv, candidateSha: '9'.repeat(40) }), /PROMOTION_BLOCKED_MIGRATION_BACKUP_SHA_MISMATCH/],
      ['contractLoweredThreshold', (bv) => bv, /PROMOTION_BLOCKED_MIGRATION_BACKUP_POLICY_MISMATCH/],
      ['expiredBackupAge', (bv) => ({ ...bv, ageSeconds: 1805, backupCreatedAt: '2026-11-12T05:10:00Z' }), /PROMOTION_BLOCKED_MIGRATION_BACKUP_EXPIRED/],
    ]) {
      const next = { ...att, backupVerification: mutate(att.backupVerification) }
      next.attestationDigest = computeAttestationDigest(next)
      const contractMd = label === 'contractLoweredThreshold'
        ? makeRuntimeContract({ maxBackupAgeLine: 'MIGRATION_MAX_BACKUP_AGE_MINUTES=5' })
        : makeRuntimeContract()
      assert.throws(
        () => verifyAttestationBackupG39({
          attestation: next,
          backupVerificationArtifact: label === 'backupReference' ? evidence : null,
          contractMarkdown: contractMd,
        }),
        pattern,
        `expected G39 block for ${label}`,
      )
    }

    // Expired at point of use when TTL asserted
    assert.throws(
      () =>
        verifyAttestationBackupG39({
          attestation: att,
          contractMarkdown: makeRuntimeContract(),
          evaluatedAtIso: '2026-11-12T06:15:00Z', // 45m after 05:30:00Z
          maxPointOfUseAgeMinutes: 30,
        }),
      /PROMOTION_BLOCKED_MIGRATION_BACKUP_EXPIRED_AT_POINT_OF_USE/,
    )
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('Neon API resource adapter tests every real branch/snapshot state transition without fabricating ready', () => {
  const nowMs = Date.parse('2026-11-12T05:45:00Z')
  const prodBranch = 'br-gentle-bar-ag3slpph'

  // Branch transitions
  assert.equal(
    adaptNeonBackupResource({
      resource: { id: 'br-b1', parent_id: prodBranch, current_state: 'ready', created_at: '2026-11-12T05:40:00Z' },
      kind: 'branch',
      productionBranchId: prodBranch,
      nowMs,
    }).recoveryCompatibility,
    'SAFE_IMMUTABLE_CHILD_BRANCH',
  )
  for (const state of ['init', 'creating', 'updating', 'archived', 'deleting', 'suspended']) {
    assert.throws(
      () =>
        adaptNeonBackupResource({
          resource: { id: 'br-b2', parent_id: prodBranch, current_state: state, created_at: '2026-11-12T05:40:00Z' },
          kind: 'branch',
          productionBranchId: prodBranch,
          nowMs,
        }),
      /BACKUP_NOT_READY/,
    )
  }
  assert.throws(
    () =>
      adaptNeonBackupResource({
        resource: { id: 'br-b3', parent_id: prodBranch, current_state: 'ready', pending_state: 'deleting', created_at: '2026-11-12T05:40:00Z' },
        kind: 'branch',
        productionBranchId: prodBranch,
        nowMs,
      }),
    /BACKUP_NOT_READY/,
  )
  assert.throws(
    () =>
      adaptNeonBackupResource({
        resource: { id: 'br-b4', parent_id: prodBranch, created_at: '2026-11-12T05:40:00Z' },
        kind: 'branch',
        productionBranchId: prodBranch,
        nowMs,
      }),
    /BACKUP_STATUS_UNVERIFIABLE_FROM_PROVIDER/,
  )

  // Snapshot transitions
  assert.equal(
    adaptNeonBackupResource({
      resource: { id: 'snap-ok', source_branch_id: prodBranch, status: 'ready', created_at: '2026-11-12T05:40:00Z', expires_at: '2026-11-12T08:00:00Z' },
      kind: 'snapshot',
      productionBranchId: prodBranch,
      nowMs,
    }).recoveryCompatibility,
    'SNAPSHOT_EXPLICITLY_READY',
  )
  assert.throws(
    () =>
      adaptNeonBackupResource({
        resource: { id: 'snap-no-status', source_branch_id: prodBranch, created_at: '2026-11-12T05:40:00Z' },
        kind: 'snapshot',
        productionBranchId: prodBranch,
        nowMs,
      }),
    /BACKUP_STATUS_UNVERIFIABLE_FROM_PROVIDER/,
  )
  assert.throws(
    () =>
      adaptNeonBackupResource({
        resource: { id: 'snap-expired', source_branch_id: prodBranch, status: 'ready', created_at: '2026-11-12T05:40:00Z', expires_at: '2026-11-12T05:44:00Z' },
        kind: 'snapshot',
        productionBranchId: prodBranch,
        nowMs,
      }),
    /BACKUP_EXPIRED_BY_PROVIDER/,
  )
})

test('Neon API timeout, HTTP error, incomplete response, prolonged approval wait, and input override fail closed', async () => {
  const repo = makeTempRepo(makeRuntimeContract())
  try {
    const runWith = (overrides = {}) =>
      verifyProductionBackup({
        repoRoot: repo,
        databaseUrl: FAKE_DB_URL,
        neonApiKey: 'synthetic-ro-token',
        neonProjectId: 'lucky-hat-25002521',
        candidateSha: CANDIDATE_SHA,
        runId: 9010,
        backupReference: 'br-backup-pre-m27-01',
        backupConfirmed: 'true',
        ledgerReviewed: 'true',
        preflightReportSha256: PREFLIGHT_SHA256,
        nowIso: '2026-11-12T05:45:00Z',
        fetchImpl: makeNeonFetch(),
        ...overrides,
      })

    // Timeout via slow fetch respecting AbortSignal
    await assert.rejects(
      () =>
        runWith({
          timeoutMs: 15,
          fetchImpl: (_url, init) =>
            new Promise((_res, rej) => {
              init.signal.addEventListener('abort', () => rej(Object.assign(new Error('Aborted'), { name: 'AbortError' })))
            }),
        }),
      /BACKUP_GATE_NEON_API_TIMEOUT/,
    )

    // HTTP 503 error
    await assert.rejects(
      () => runWith({ fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }) }),
      /BACKUP_GATE_NEON_API_ERROR/,
    )

    // Incomplete JSON structure (missing branches array)
    await assert.rejects(
      () =>
        runWith({
          fetchImpl: async (url) => {
            if (url.endsWith('/projects/lucky-hat-25002521')) return { ok: true, status: 200, json: async () => ({ project: { id: 'lucky-hat-25002521' } }) }
            return { ok: true, status: 200, json: async () => ({ unexpected: true }) }
          },
        }),
      /BACKUP_GATE_NEON_API_INCOMPLETE_RESPONSE/,
    )

    // Prolonged human Environment approval delay (backup created 05:30:00Z, approved & executed at 06:05:00Z -> 35m > 30m)
    await assert.rejects(
      () => runWith({ nowIso: '2026-11-12T06:05:00Z' }),
      /BACKUP_STALE/,
    )

    // Workflow input/env attempting to override OD-03 limit
    await assert.rejects(
      () => runWith({ env: { INPUT_MAX_BACKUP_AGE_MINUTES: '120' } }),
      /BACKUP_GATE_FORBIDDEN_THRESHOLD_OVERRIDE/,
    )
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})
