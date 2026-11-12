#!/usr/bin/env node
/**
 * AOS Canonical MigrationAttestationV1 Emitter
 *
 * Queries the target database migration ledger in read-only mode after migrations run,
 * cross-checks declared migrations & manifest digests, computes a non-secret target
 * database fingerprint, and emits a tamper-evident MigrationAttestationV1 JSON artifact.
 *
 * Never prints DATABASE_URL, hostnames, usernames, passwords, or query strings.
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const sha256Hex = (input) => createHash('sha256').update(input).digest('hex')

export const canonicalSort = (value) => {
  if (Array.isArray(value)) return value.map(canonicalSort)
  if (value && typeof value === 'object') {
    const sorted = {}
    for (const key of Object.keys(value).sort()) {
      sorted[key] = canonicalSort(value[key])
    }
    return sorted
  }
  return value
}

export const computeAttestationDigest = (attestationWithoutDigest) => {
  const clone = { ...attestationWithoutDigest }
  delete clone.attestationDigest
  return sha256Hex(JSON.stringify(canonicalSort(clone)))
}

export const computeDatabaseFingerprint = (databaseUrl) => {
  let parsed
  try {
    parsed = new URL(databaseUrl ?? '')
  } catch {
    throw new Error('ATTESTATION_DATABASE_URL_INVALID: DATABASE_URL is missing or malformed.')
  }
  if (!/^postgres(ql)?:$/.test(parsed.protocol)) {
    throw new Error(`ATTESTATION_DATABASE_SCHEME_UNSUPPORTED: unsupported scheme ${parsed.protocol}`)
  }
  const hostname = parsed.hostname.toLowerCase().replace(/-pooler(?=\.)/, '')
  const port = parsed.port || '5432'
  const dbName = parsed.pathname.replace(/^\//, '')
  if (!hostname || !dbName) {
    throw new Error('ATTESTATION_DATABASE_URL_INCOMPLETE: hostname or database name missing.')
  }
  const normalized = `postgresql://${hostname}:${port}/${dbName}`
  return `sha256:${sha256Hex(`anclora-db-target-v1:${normalized}`)}`
}

export const parseRuntimeContract = (markdown) => {
  const map = new Map()
  for (const line of markdown.split(/\r?\n/)) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line)
    if (!match) continue
    const key = match[1]
    const val = match[2].trim()
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(val)
  }
  const out = {}
  for (const [k, vals] of map.entries()) {
    const unique = [...new Set(vals.filter(Boolean))]
    if (unique.length > 1) {
      throw new Error(`ATTESTATION_CONTRACT_AMBIGUOUS: conflicting values for ${k}`)
    }
    out[k] = vals[vals.length - 1] ?? ''
  }
  return out
}

export const computeCrlfSqlSha256 = (bytes) => {
  const text = Buffer.isBuffer(bytes) ? bytes.toString('utf8') : String(bytes)
  const normalizedCrlf = text.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n')
  return sha256Hex(Buffer.from(normalizedCrlf, 'utf8'))
}

const HEX64_RE = /^[a-f0-9]{64}$/

export const validateHistoricalChecksumEquivalences = (rawEquivalences, diskMigrations) => {
  if (rawEquivalences === undefined) return []
  if (!Array.isArray(rawEquivalences)) {
    throw new Error('ATTESTATION_EQUIVALENCE_INVALID: historicalChecksumEquivalences must be an array')
  }
  const diskByName = new Map(diskMigrations.map((m) => [m.name, m]))
  const seen = new Set()
  const verified = []

  for (const entry of rawEquivalences) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      typeof entry.name !== 'string' ||
      !entry.name.trim() ||
      typeof entry.reason !== 'string' ||
      !entry.reason.trim() ||
      typeof entry.lfSha256 !== 'string' ||
      !HEX64_RE.test(entry.lfSha256) ||
      typeof entry.crlfSha256 !== 'string' ||
      !HEX64_RE.test(entry.crlfSha256)
    ) {
      throw new Error('ATTESTATION_EQUIVALENCE_INVALID: malformed historicalChecksumEquivalences entry')
    }
    if (entry.lineEndingMode !== undefined && entry.lineEndingMode !== 'CRLF') {
      throw new Error(`ATTESTATION_EQUIVALENCE_INVALID: unsupported lineEndingMode for ${entry.name}`)
    }
    if (seen.has(entry.name)) {
      throw new Error(`ATTESTATION_EQUIVALENCE_DUPLICATE: duplicate equivalence for ${entry.name}`)
    }
    seen.add(entry.name)

    const disk = diskByName.get(entry.name)
    if (!disk) {
      throw new Error(`ATTESTATION_EQUIVALENCE_UNKNOWN_MIGRATION: ${entry.name} not present on disk`)
    }
    if (entry.lfSha256 !== disk.sha256) {
      throw new Error(`ATTESTATION_EQUIVALENCE_LF_MISMATCH: ${entry.name}`)
    }
    if (disk.crlfSha256 && entry.crlfSha256 !== disk.crlfSha256) {
      throw new Error(`ATTESTATION_EQUIVALENCE_CRLF_MISMATCH: ${entry.name}`)
    }
    if (entry.lfSha256 === entry.crlfSha256) {
      throw new Error(`ATTESTATION_EQUIVALENCE_REDUNDANT: ${entry.name} LF and CRLF hashes are identical`)
    }

    verified.push({
      name: entry.name,
      reason: entry.reason.trim(),
      lineEndingMode: 'CRLF',
      lfSha256: entry.lfSha256,
      crlfSha256: entry.crlfSha256,
    })
  }

  verified.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  return verified
}

export const collectDiskMigrations = (repoRoot, relDir) => {
  const normalizedDir = relDir.replace(/^\.\//, '').replace(/\/+$/, '')
  const absDir = resolve(repoRoot, normalizedDir)
  if (!existsSync(absDir) || !statSync(absDir).isDirectory()) {
    throw new Error(`ATTESTATION_MIGRATION_DIR_MISSING: ${normalizedDir} not found`)
  }
  const entries = readdirSync(absDir, { withFileTypes: true })
  const migrations = []

  const dirEntries = entries.filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))
  const directSqlFiles = entries
    .filter((e) => e.isFile() && /\.(sql|py)$/i.test(e.name))
    .sort((a, b) => a.name.localeCompare(b.name))

  for (const dir of dirEntries) {
    const sqlPath = join(absDir, dir.name, 'migration.sql')
    if (existsSync(sqlPath) && statSync(sqlPath).isFile()) {
      const bytes = readFileSync(sqlPath)
      migrations.push({
        name: dir.name,
        sha256: sha256Hex(bytes),
        crlfSha256: computeCrlfSqlSha256(bytes),
      })
    }
  }

  if (migrations.length === 0 && directSqlFiles.length > 0) {
    for (const file of directSqlFiles) {
      const bytes = readFileSync(join(absDir, file.name))
      migrations.push({
        name: file.name.replace(/\.(sql|py)$/i, ''),
        sha256: sha256Hex(bytes),
        crlfSha256: computeCrlfSqlSha256(bytes),
      })
    }
  }

  migrations.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  const canonicalLines = migrations.map((m) => `${m.name}:${m.sha256}\n`).join('')
  return {
    directory: normalizedDir,
    migrations,
    count: migrations.length,
    names: migrations.map((m) => m.name),
    treeSha256: sha256Hex(canonicalLines),
  }
}

export const verifyManifestOnDisk = (repoRoot, manifestRelPath, diskMigrations) => {
  const abs = resolve(repoRoot, manifestRelPath)
  if (!existsSync(abs)) {
    return { manifestPath: manifestRelPath, manifestSha256: null, present: false, equivalences: [] }
  }
  const raw = readFileSync(abs)
  const manifestSha256 = sha256Hex(raw)
  const parsed = JSON.parse(raw.toString('utf8'))
  if (!Array.isArray(parsed.migrations)) {
    throw new Error(`ATTESTATION_MANIFEST_INVALID: ${manifestRelPath} missing migrations array`)
  }
  const sortedManifest = [...parsed.migrations].sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  )
  if (sortedManifest.length !== diskMigrations.length) {
    throw new Error(
      `ATTESTATION_MANIFEST_COUNT_MISMATCH: manifest=${sortedManifest.length} disk=${diskMigrations.length}`,
    )
  }
  for (let i = 0; i < diskMigrations.length; i += 1) {
    if (
      sortedManifest[i].name !== diskMigrations[i].name ||
      sortedManifest[i].sha256 !== diskMigrations[i].sha256
    ) {
      throw new Error(`ATTESTATION_MANIFEST_ENTRY_MISMATCH: ${diskMigrations[i].name}`)
    }
  }
  const equivalences = validateHistoricalChecksumEquivalences(
    parsed.historicalChecksumEquivalences,
    diskMigrations,
  )
  return { manifestPath: manifestRelPath, manifestSha256, present: true, equivalences }
}

const queryPrismaLedgerRows = (databaseUrl) => {
  const sql =
    'SELECT migration_name, checksum, ' +
    'COALESCE(to_char(finished_at AT TIME ZONE \'UTC\', \'YYYY-MM-DD"T"HH24:MI:SS"Z"\'), \'\'), ' +
    'COALESCE(to_char(rolled_back_at AT TIME ZONE \'UTC\', \'YYYY-MM-DD"T"HH24:MI:SS"Z"\'), \'\'), ' +
    'applied_steps_count ' +
    'FROM "_prisma_migrations" ORDER BY started_at ASC, migration_name ASC;'

  const raw = execFileSync('psql', [databaseUrl, '-X', '-q', '-t', '-A', '-F', '\t', '-c', sql], {
    encoding: 'utf8',
    env: { ...process.env, PGCONNECT_TIMEOUT: '15' },
  })
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [migration_name, checksum, finished_at, rolled_back_at, applied_steps_count] = line.split('\t')
      return {
        migration_name,
        checksum,
        finished_at: finished_at || null,
        rolled_back_at: rolled_back_at || null,
        applied_steps_count: Number(applied_steps_count ?? 0),
      }
    })
}

export const evaluateLedgerRows = (rows, diskMigrations, historicalEquivalences = []) => {
  if (!Array.isArray(rows)) {
    throw new Error('ATTESTATION_LEDGER_INVALID: rows must be an array')
  }
  const verifiedEquivalences = validateHistoricalChecksumEquivalences(
    historicalEquivalences,
    diskMigrations,
  )
  const equivalenceByName = new Map(verifiedEquivalences.map((eq) => [eq.name, eq]))
  const diskByName = new Map(diskMigrations.map((m) => [m.name, m.sha256]))
  const activeByName = new Map()
  const unresolvedFailed = []
  const unresolvedRolledBack = new Set()
  const rolledBackRowsByName = new Map()
  let resolvedRolledBackCount = 0

  for (const row of rows) {
    if (!row || typeof row.migration_name !== 'string' || typeof row.checksum !== 'string') {
      throw new Error('ATTESTATION_LEDGER_ROW_MALFORMED')
    }
    if (row.finished_at && row.rolled_back_at) {
      unresolvedFailed.push(row.migration_name)
      continue
    }
    if (row.rolled_back_at) {
      unresolvedRolledBack.add(row.migration_name)
      rolledBackRowsByName.set(row.migration_name, (rolledBackRowsByName.get(row.migration_name) ?? 0) + 1)
      activeByName.delete(row.migration_name)
      continue
    }
    if (!row.finished_at) {
      unresolvedFailed.push(row.migration_name)
      continue
    }
    if (activeByName.has(row.migration_name)) {
      unresolvedFailed.push(row.migration_name)
      continue
    }
    if (unresolvedRolledBack.has(row.migration_name)) {
      resolvedRolledBackCount += rolledBackRowsByName.get(row.migration_name) ?? 1
      rolledBackRowsByName.set(row.migration_name, 0)
      unresolvedRolledBack.delete(row.migration_name)
    }
    activeByName.set(row.migration_name, row.checksum)
  }

  let checksumMismatchCount = 0
  let pendingCount = 0
  const canonicalByName = new Map()
  const acceptedHistoricalEquivalences = []

  for (const m of diskMigrations) {
    const dbChecksum = activeByName.get(m.name)
    if (!dbChecksum) {
      pendingCount += 1
      continue
    }
    if (dbChecksum === m.sha256) {
      canonicalByName.set(m.name, m.sha256)
      continue
    }
    const eq = equivalenceByName.get(m.name)
    if (eq && dbChecksum === eq.crlfSha256 && eq.lfSha256 === m.sha256) {
      canonicalByName.set(m.name, m.sha256)
      acceptedHistoricalEquivalences.push({
        name: m.name,
        reason: eq.reason,
        lineEndingMode: eq.lineEndingMode,
        canonicalSha256: eq.lfSha256,
        recordedChecksum: dbChecksum,
      })
      continue
    }
    checksumMismatchCount += 1
  }

  // Detect extra DB migrations not present on disk (history drift).
  let extraDbCount = 0
  for (const name of activeByName.keys()) {
    if (!diskByName.has(name)) extraDbCount += 1
  }

  const activeSorted = [...activeByName.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
  const observedLedgerDigest = sha256Hex(activeSorted.map(([name, sum]) => `${name}:${sum}\n`).join(''))

  const canonicalSorted = [...canonicalByName.entries()].sort((a, b) =>
    a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0,
  )
  const appliedMigrationsDigest =
    checksumMismatchCount === 0 && extraDbCount === 0 && canonicalSorted.length === activeSorted.length
      ? sha256Hex(canonicalSorted.map(([name, sum]) => `${name}:${sum}\n`).join(''))
      : observedLedgerDigest

  const failedCount = unresolvedFailed.length
  const rolledBackCount = unresolvedRolledBack.size
  const appliedCount = activeSorted.length

  const isClean =
    pendingCount === 0 &&
    failedCount === 0 &&
    rolledBackCount === 0 &&
    checksumMismatchCount === 0 &&
    extraDbCount === 0 &&
    appliedCount === diskMigrations.length

  return {
    status: isClean ? 'verified' : 'failed',
    ledgerTable: '_prisma_migrations',
    observedAt: new Date().toISOString(),
    declaredCount: diskMigrations.length,
    appliedCount,
    pendingCount,
    failedCount,
    rolledBackCount,
    resolvedRolledBackCount,
    checksumMismatchCount,
    extraDbCount,
    observedLedgerDigest,
    appliedMigrationsDigest,
    acceptedHistoricalEquivalences,
  }
}

export const validateBackupVerificationBinding = (
  backupVerification,
  { candidateSha, runId, observedFingerprint },
) => {
  if (!backupVerification || typeof backupVerification !== 'object') {
    throw new Error('ATTESTATION_BACKUP_VERIFICATION_MISSING: BackupVerificationEvidenceV1 is required.')
  }
  if (backupVerification.schemaVersion !== 'BackupVerificationEvidenceV1') {
    throw new Error(`ATTESTATION_BACKUP_SCHEMA_INVALID: unexpected ${backupVerification.schemaVersion ?? 'unknown'}.`)
  }
  if (backupVerification.evaluatorStatus !== 'VERIFIED') {
    throw new Error(`ATTESTATION_BACKUP_STATUS_INVALID: evaluatorStatus=${backupVerification.evaluatorStatus ?? 'unknown'}.`)
  }
  const { evidenceDigest: recordedDigest, ...unsignedEvidence } = backupVerification
  const expectedDigest = `sha256:${sha256Hex(JSON.stringify(canonicalSort(unsignedEvidence)))}`
  if (!recordedDigest || recordedDigest !== expectedDigest) {
    throw new Error('ATTESTATION_BACKUP_DIGEST_MISMATCH: backup verification evidenceDigest does not match canonical payload.')
  }
  if (backupVerification.workflowRun?.candidateSha !== candidateSha) {
    throw new Error('ATTESTATION_BACKUP_SHA_MISMATCH: backup verification candidateSha does not match migration run.')
  }
  if (Number(backupVerification.workflowRun?.runId) !== Number(runId)) {
    throw new Error('ATTESTATION_BACKUP_RUN_MISMATCH: backup verification runId does not match migration run.')
  }
  if (backupVerification.contract?.databaseTargetFingerprint !== observedFingerprint) {
    throw new Error('ATTESTATION_BACKUP_FINGERPRINT_MISMATCH: backup verification targetFingerprint does not match database.')
  }
  if (backupVerification.backup?.verifiedByProvider !== true || backupVerification.backup?.providerState !== 'ready') {
    throw new Error('ATTESTATION_BACKUP_NOT_PROVIDER_READY: backup state must be verified ready by provider.')
  }
  if (
    typeof backupVerification.maxAllowedAgeMinutes !== 'number' ||
    backupVerification.maxAllowedAgeMinutes <= 0 ||
    backupVerification.maxAllowedAgeMinutes > 30
  ) {
    throw new Error('ATTESTATION_BACKUP_THRESHOLD_INVALID: maxAllowedAgeMinutes must satisfy OD-03 (1..30 minutes).')
  }
  if (backupVerification.maxFutureClockSkewMs !== 60_000) {
    throw new Error('ATTESTATION_BACKUP_SKEW_INVALID: maxFutureClockSkewMs must equal 60000 per OD-03.')
  }
  const shaPrefixRe = /^sha256:[0-9a-f]{64}$/
  const requiredHashes = [
    backupVerification.contract?.neonProjectIdSha256,
    backupVerification.contract?.productionBranchIdSha256,
    backupVerification.contract?.productionEndpointIdSha256,
    backupVerification.backup?.sourceBranchIdSha256,
    backupVerification.backup?.endpointIdSha256,
  ]
  if (!requiredHashes.every((h) => typeof h === 'string' && shaPrefixRe.test(h))) {
    throw new Error('ATTESTATION_BACKUP_IDENTITY_HASH_MISSING: project, branch, or endpoint hashes are missing or malformed.')
  }
  const verifiedMs = Date.parse(String(backupVerification.verifiedAt ?? ''))
  const createdMs = Date.parse(String(backupVerification.backup?.createdAt ?? ''))
  if (!Number.isFinite(verifiedMs) || !Number.isFinite(createdMs)) {
    throw new Error('ATTESTATION_BACKUP_TIMESTAMP_INVALID: verifiedAt or backup.createdAt is not a valid timestamp.')
  }
  if (createdMs - verifiedMs > 60_000 || verifiedMs - createdMs > backupVerification.maxAllowedAgeMinutes * 60_000) {
    throw new Error('ATTESTATION_BACKUP_EXPIRED: backup creation timestamp falls outside authorized OD-03 window.')
  }
  return {
    schemaVersion: backupVerification.schemaVersion,
    policyDecision: backupVerification.policyDecision ?? 'OD-03',
    evaluatorStatus: backupVerification.evaluatorStatus,
    candidateSha,
    runId: Number(runId),
    databaseTargetFingerprint: observedFingerprint,
    neonProjectIdSha256: backupVerification.contract.neonProjectIdSha256,
    productionBranchIdSha256: backupVerification.contract.productionBranchIdSha256,
    productionEndpointIdSha256: backupVerification.contract.productionEndpointIdSha256,
    sourceBranchIdSha256: backupVerification.backup.sourceBranchIdSha256,
    endpointIdSha256: backupVerification.backup.endpointIdSha256,
    backupReference: backupVerification.backup.reference,
    backupKind: backupVerification.backup.kind,
    verifiedAt: backupVerification.verifiedAt,
    backupCreatedAt: backupVerification.backup.createdAt,
    ageSeconds: backupVerification.backup.ageSeconds,
    maxAllowedAgeMinutes: backupVerification.maxAllowedAgeMinutes,
    maxFutureClockSkewMs: backupVerification.maxFutureClockSkewMs,
    verifiedByProvider: true,
    providerState: backupVerification.backup.providerState,
    preflightReportSha256: backupVerification.preflightReportSha256,
    evidenceDigest: recordedDigest,
  }
}

export const buildAttestation = (options = {}) => {
  const repoRoot = resolve(options.repoRoot ?? '.')
  const runtimePath = join(repoRoot, '.anclora/PRODUCTION_RUNTIME.md')
  const contract = parseRuntimeContract(readFileSync(runtimePath, 'utf8'))

  const dbProvider = contract.DATABASE_PROVIDER ?? ''
  const migrationSystem = contract.MIGRATION_SYSTEM ?? ''
  const migrationDir = contract.MIGRATION_DIRECTORY ?? ''
  const workflowPath = contract.MIGRATION_RUNNER_WORKFLOW ?? ''
  const envName = contract.MIGRATION_ENVIRONMENT ?? ''
  const expectedFingerprint = contract.DATABASE_TARGET_FINGERPRINT ?? ''
  const manifestPath = contract.MIGRATION_MANIFEST_PATH || 'scripts/release/release-manifest.json'

  if (!dbProvider || dbProvider.toLowerCase() === 'none') {
    throw new Error('ATTESTATION_CONTRACT_NO_DATABASE: repository does not declare a production database.')
  }
  if (!migrationSystem || !migrationDir || !workflowPath || !envName || !expectedFingerprint) {
    throw new Error('ATTESTATION_CONTRACT_INCOMPLETE: missing mandatory migration contract keys.')
  }

  const observedFingerprint = options.databaseFingerprint ?? computeDatabaseFingerprint(options.databaseUrl)
  if (observedFingerprint !== expectedFingerprint) {
    throw new Error(
      `ATTESTATION_DATABASE_MISMATCH: observed fingerprint ${observedFingerprint} != contract ${expectedFingerprint}`,
    )
  }

  const disk = collectDiskMigrations(repoRoot, migrationDir)
  const manifest = verifyManifestOnDisk(repoRoot, manifestPath, disk.migrations)
  if (contract.MIGRATION_MANIFEST_PATH && !manifest.present) {
    throw new Error(`ATTESTATION_MANIFEST_MISSING: declared ${manifestPath} not found`)
  }

  const rows = options.ledgerRows ?? queryPrismaLedgerRows(options.databaseUrl)
  const dbPostCheck = evaluateLedgerRows(rows, disk.migrations, manifest.equivalences)

  const requireBackupVerification = options.requireBackupVerification === true || Boolean(options.backupVerification)
  const backupVerificationSummary = requireBackupVerification
    ? validateBackupVerificationBinding(options.backupVerification, {
        candidateSha: options.candidateSha,
        runId: options.runId,
        observedFingerprint,
      })
    : undefined

  const payload = {
    schemaVersion: 'MigrationAttestationV1',
    generatedAt: new Date().toISOString(),
    repository: options.repository,
    workflowRun: {
      workflowPath,
      runId: Number(options.runId),
      runAttempt: Number(options.runAttempt ?? 1),
      candidateSha: options.candidateSha,
      actor: options.actor ?? '',
    },
    environment: {
      name: envName,
      deploymentId: options.deploymentId ? Number(options.deploymentId) : null,
    },
    approval: {
      required: true,
      verifiedByDeployment: Boolean(options.deploymentId),
      approvedBy: options.approvedBy ?? [],
    },
    database: {
      provider: dbProvider,
      targetFingerprint: observedFingerprint,
    },
    migrations: {
      system: migrationSystem,
      directory: disk.directory,
      manifestPath: manifest.present ? manifest.manifestPath : null,
      manifestSha256: manifest.manifestSha256,
      treeSha256: disk.treeSha256,
      count: disk.count,
      names: disk.names,
    },
    execution: {
      status: dbPostCheck.status === 'verified' ? (options.executionStatus ?? 'succeeded') : 'failed',
      command: contract.MIGRATION_RUNNER ?? 'prisma migrate deploy',
    },
    dbPostCheck,
    ...(backupVerificationSummary ? { backupVerification: backupVerificationSummary } : {}),
  }

  payload.attestationDigest = computeAttestationDigest(payload)
  return payload
}

const parseCliArgs = (argv) => {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) {
      args[key] = true
    } else {
      args[key] = next
      i += 1
    }
  }
  return args
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseCliArgs(process.argv.slice(2))
  const repoRoot = args['repo-root'] ?? '.'
  const outputPath = resolve(args.output ?? 'migration-attestation.json')
  const ledgerRows = args['allow-ledger-json']
    ? JSON.parse(readFileSync(resolve(args['allow-ledger-json']), 'utf8'))
    : undefined

  const approvedBy = typeof args['approved-by'] === 'string' && args['approved-by']
    ? args['approved-by'].split(',').map((s) => s.trim()).filter(Boolean)
    : []

  const backupVerification = args['backup-verification']
    ? JSON.parse(readFileSync(resolve(args['backup-verification']), 'utf8'))
    : undefined

  const attestation = buildAttestation({
    repoRoot,
    repository: args.repository ?? process.env.GITHUB_REPOSITORY,
    runId: args['run-id'] ?? process.env.GITHUB_RUN_ID,
    runAttempt: args['run-attempt'] ?? process.env.GITHUB_RUN_ATTEMPT ?? '1',
    candidateSha: args['candidate-sha'] ?? process.env.GITHUB_SHA,
    actor: args.actor ?? process.env.GITHUB_ACTOR ?? '',
    deploymentId: args['deployment-id'] ?? process.env.GITHUB_DEPLOYMENT_ID ?? '',
    approvedBy,
    databaseUrl: process.env.DATABASE_URL,
    ledgerRows,
    backupVerification,
    requireBackupVerification: Boolean(args['require-backup-verification']),
  })

  if (attestation.dbPostCheck.status !== 'verified') {
    console.error(
      `::error::ATTESTATION_POSTCHECK_FAILED: pending=${attestation.dbPostCheck.pendingCount} ` +
      `failed=${attestation.dbPostCheck.failedCount} rolledBack=${attestation.dbPostCheck.rolledBackCount} ` +
      `checksumMismatch=${attestation.dbPostCheck.checksumMismatchCount}`,
    )
    process.exit(1)
  }

  writeFileSync(outputPath, JSON.stringify(attestation, null, 2) + '\n')
  writeFileSync(`${outputPath}.sha256`, `${sha256Hex(readFileSync(outputPath))}  ${outputPath.split('/').pop()}\n`)
  console.log(
    `MigrationAttestationV1 emitted: migrations=${attestation.migrations.count} ` +
    `fingerprint=${attestation.database.targetFingerprint} digest=${attestation.attestationDigest}`,
  )
}

