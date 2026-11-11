#!/usr/bin/env node
/**
 * AOS Read-Only Production Database Identity Preflight (Q1)
 *
 * Computes the canonical DATABASE_TARGET_FINGERPRINT inside a protected environment
 * from PRODUCTION_MIGRATION_DATABASE_URL without ever printing URLs, credentials,
 * hostnames, or database names. Optionally cross-verifies Render and Neon target
 * identities via read-only authorized APIs and evaluates `_prisma_migrations`
 * using the canonical evaluator (including historical LF/CRLF equivalences).
 *
 * Strictly read-only: never executes DDL, `prisma migrate deploy`, seeds,
 * backups, promotions, or deployments, and never modifies contract files.
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  collectDiskMigrations,
  computeDatabaseFingerprint,
  evaluateLedgerRows,
  parseRuntimeContract,
  verifyManifestOnDisk,
} from './emit-migration-attestation.mjs'

export const LEDGER_READ_ONLY_SQL =
  'SELECT migration_name, checksum, ' +
  'COALESCE(to_char(finished_at AT TIME ZONE \'UTC\', \'YYYY-MM-DD"T"HH24:MI:SS"Z"\'), \'\'), ' +
  'COALESCE(to_char(rolled_back_at AT TIME ZONE \'UTC\', \'YYYY-MM-DD"T"HH24:MI:SS"Z"\'), \'\'), ' +
  'applied_steps_count ' +
  'FROM "_prisma_migrations" ORDER BY started_at ASC, migration_name ASC;'

const FORBIDDEN_ARG_RE =
  /(?:^|--)(?:migrate|deploy|seed|push|promote|reset|resolve|backup|snapshot|create|delete|write|apply|ddl)\b/i
const FORBIDDEN_SQL_RE =
  /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|COPY|MERGE|CALL|DO|EXECUTE|PREPARE)\b/i

const sha256Hex = (input) => createHash('sha256').update(input).digest('hex')

export const assertNoForbiddenCliFlags = (argv) => {
  for (const token of argv) {
    if (FORBIDDEN_ARG_RE.test(String(token))) {
      throw new Error(`PREFLIGHT_FORBIDDEN_OPERATION: disallowed flag/argument "${token}"`)
    }
  }
}

export const assertReadOnlySql = (sql) => {
  const normalized = String(sql ?? '').trim()
  if (!normalized || FORBIDDEN_SQL_RE.test(normalized) || /\bJOIN\b/i.test(normalized)) {
    throw new Error('PREFLIGHT_FORBIDDEN_SQL: non-read-only SQL statement rejected')
  }
  if (!/^SELECT\b[\s\S]+\bFROM\s+"_prisma_migrations"(?:\s+ORDER\s+BY\b[\s\S]+)?\s*;?$/i.test(normalized)) {
    throw new Error('PREFLIGHT_FORBIDDEN_SQL: preflight query may only read "_prisma_migrations"')
  }
  if (normalized.split(';').filter((part) => part.trim().length > 0).length > 1) {
    throw new Error('PREFLIGHT_FORBIDDEN_SQL: multi-statement SQL rejected')
  }
}

export const collectSensitiveTokens = (databaseUrl) => {
  if (!databaseUrl) return []
  const tokens = [databaseUrl]
  try {
    const parsed = new URL(databaseUrl)
    const rawHost = parsed.hostname.toLowerCase()
    const normalizedHost = rawHost.replace(/-pooler(?=\.)/, '')
    const user = decodeURIComponent(parsed.username)
    const pass = decodeURIComponent(parsed.password)
    const db = parsed.pathname.replace(/^\//, '')
    for (const v of [rawHost, normalizedHost, user, pass, db]) {
      if (v && v.length >= 3) tokens.push(v)
    }
  } catch {
    // Ignore malformed parse here; extractTargetIdentity throws explicitly.
  }
  return [...new Set(tokens)]
}

export const emitGithubMasks = (databaseUrl) => {
  for (const token of collectSensitiveTokens(databaseUrl)) {
    if (!/[\r\n]/.test(token)) {
      console.log(`::add-mask::${token}`)
    }
  }
}

export const assertNoSensitiveLeak = (serializedText, sensitiveTokens = []) => {
  const text = String(serializedText ?? '')
  if (/postgres(ql)?:\/\//i.test(text) || /PGPASSWORD|password=/i.test(text)) {
    throw new Error('PREFLIGHT_SENSITIVE_LEAK_BLOCKED: connection string pattern detected in output')
  }
  for (const token of sensitiveTokens) {
    if (token && token.length >= 4 && text.includes(token)) {
      throw new Error('PREFLIGHT_SENSITIVE_LEAK_BLOCKED: sensitive target token detected in output')
    }
  }
}

export const extractTargetIdentity = (databaseUrl, options = {}) => {
  let parsed
  try {
    parsed = new URL(databaseUrl ?? '')
  } catch {
    throw new Error('PREFLIGHT_INVALID_DB_URL: database URL is missing or malformed')
  }
  if (!/^postgres(ql)?:$/.test(parsed.protocol)) {
    throw new Error(`PREFLIGHT_INVALID_DB_URL: unsupported scheme ${parsed.protocol}`)
  }
  const rawHost = parsed.hostname.toLowerCase()
  const isPooler = rawHost.includes('-pooler')
  if (options.requireDirect && isPooler) {
    throw new Error('PREFLIGHT_POOLED_URL_FORBIDDEN: expected direct (non-pooler) database connection')
  }
  const normalizedHost = rawHost.replace(/-pooler(?=\.)/, '')
  const port = parsed.port || '5432'
  const dbName = parsed.pathname.replace(/^\//, '')
  if (!normalizedHost || !dbName) {
    throw new Error('PREFLIGHT_INVALID_DB_URL: hostname or database name missing')
  }
  for (const val of [rawHost, decodeURIComponent(parsed.username), decodeURIComponent(parsed.password), dbName]) {
    if (val && /[\r\n]/.test(val)) {
      throw new Error('PREFLIGHT_INVALID_DB_URL: connection parameter contains newline characters')
    }
  }
  const firstLabel = normalizedHost.split('.')[0] ?? ''
  const endpointId = /^ep-[a-z0-9-]+$/i.test(firstLabel) ? firstLabel : null
  const sslMode = parsed.searchParams.get('sslmode') || null

  return {
    scheme: 'postgresql',
    isPooler,
    port,
    sslMode,
    fingerprint: computeDatabaseFingerprint(databaseUrl),
    normalizedHostSha256: sha256Hex(normalizedHost),
    endpointSha256: endpointId ? sha256Hex(endpointId) : null,
    databaseSha256: sha256Hex(dbName),
    _rawEndpointId: endpointId,
  }
}

const stripInternalTargetFields = (target) => {
  if (!target) return null
  const { _rawEndpointId, ...publicTarget } = target
  return publicTarget
}

export const resolveRenderTargetIdentity = async ({
  serviceId,
  apiKey,
  fetchFn = globalThis.fetch,
} = {}) => {
  if (!serviceId) {
    return {
      status: 'RENDER_IDENTITY_UNVERIFIED',
      serviceId: null,
      reason: 'render_service_id_missing',
      target: null,
      sensitiveTokens: [],
    }
  }
  if (!apiKey) {
    return {
      status: 'RENDER_IDENTITY_UNVERIFIED',
      serviceId,
      reason: 'authorized_render_api_key_unavailable',
      target: null,
      sensitiveTokens: [],
    }
  }
  if (typeof fetchFn !== 'function') {
    throw new Error('PREFLIGHT_FETCH_UNAVAILABLE: fetch implementation required for Render API')
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json',
  }
  const [svcRes, envRes] = await Promise.all([
    fetchFn(`https://api.render.com/v1/services/${encodeURIComponent(serviceId)}`, { headers }),
    fetchFn(`https://api.render.com/v1/services/${encodeURIComponent(serviceId)}/env-vars?limit=100`, {
      headers,
    }),
  ])
  if (!svcRes.ok || !envRes.ok) {
    return {
      status: 'RENDER_IDENTITY_UNVERIFIED',
      serviceId,
      reason: `render_api_http_error_${svcRes.status}_${envRes.status}`,
      target: null,
      sensitiveTokens: [],
    }
  }

  const svcJson = await svcRes.json()
  const envJson = await envRes.json()
  const service = svcJson?.service ?? svcJson ?? {}
  const items = Array.isArray(envJson) ? envJson : []
  const dbEntry = items
    .map((item) => item?.envVar ?? item)
    .find((ev) => ev && ev.key === 'DATABASE_URL' && typeof ev.value === 'string' && ev.value.length > 0)

  if (!dbEntry) {
    return {
      status: 'RENDER_IDENTITY_UNVERIFIED',
      serviceId,
      serviceBranch: service.branch ?? null,
      serviceRootDir: service.rootDir ?? null,
      reason: 'render_database_url_missing',
      target: null,
      sensitiveTokens: [],
    }
  }

  const sensitiveTokens = collectSensitiveTokens(dbEntry.value)
  const target = extractTargetIdentity(dbEntry.value, { requireDirect: false })

  return {
    status: 'VERIFIED',
    serviceId,
    serviceName: service.name ?? null,
    serviceBranch: service.branch ?? null,
    serviceRootDir: service.rootDir ?? null,
    target,
    sensitiveTokens,
  }
}

export const resolveNeonTargetIdentity = async ({
  neonApiKey,
  neonProjectId,
  vercelIntegration,
  observedTarget,
  fetchFn = globalThis.fetch,
} = {}) => {
  const vercelResource = {
    resourceName: vercelIntegration?.resourceName ?? 'neon-impulso',
    resourceId: vercelIntegration?.resourceId ?? 'store_R01qkU5iSotmruBW',
    product: vercelIntegration?.product ?? 'Neon',
    identitySeparationNote:
      'Vercel project/store resource metadata is distinct from Neon project ID, branch ID, and endpoint host.',
  }

  if (!neonApiKey || !neonProjectId) {
    return {
      status: 'NEON_IDENTITY_UNVERIFIED',
      reason: !neonApiKey ? 'authorized_neon_api_key_unavailable' : 'neon_project_id_unavailable',
      vercelResource,
      projectIdSha256: null,
      productionBranch: null,
      endpointMatchesObserved: null,
      endpointBelongsToProductionBranch: null,
      databaseConfirmedOnBranch: null,
      recoveryOptions: {
        snapshots: [],
        backupBranches: [],
        verifiedReadOnly: false,
        note: 'Inspect Neon snapshots/branches with read-only Neon API credential or Neon Console without creating backups during preflight.',
      },
      sensitiveTokens: [],
    }
  }
  if (typeof fetchFn !== 'function') {
    throw new Error('PREFLIGHT_FETCH_UNAVAILABLE: fetch implementation required for Neon API')
  }

  const headers = {
    Authorization: `Bearer ${neonApiKey}`,
    Accept: 'application/json',
  }
  const base = `https://console.neon.tech/api/v2/projects/${encodeURIComponent(neonProjectId)}`
  const [projRes, branchesRes, endpointsRes] = await Promise.all([
    fetchFn(base, { headers }),
    fetchFn(`${base}/branches`, { headers }),
    fetchFn(`${base}/endpoints`, { headers }),
  ])

  if (!projRes.ok || !branchesRes.ok || !endpointsRes.ok) {
    return {
      status: 'NEON_IDENTITY_UNVERIFIED',
      reason: `neon_api_http_error_${projRes.status}_${branchesRes.status}_${endpointsRes.status}`,
      vercelResource,
      projectIdSha256: sha256Hex(neonProjectId),
      productionBranch: null,
      endpointMatchesObserved: null,
      endpointBelongsToProductionBranch: null,
      databaseConfirmedOnBranch: null,
      recoveryOptions: { snapshots: [], backupBranches: [], verifiedReadOnly: false },
      sensitiveTokens: [],
    }
  }

  const projJson = await projRes.json()
  const branchesJson = await branchesRes.json()
  const endpointsJson = await endpointsRes.json()

  const branches = Array.isArray(branchesJson?.branches) ? branchesJson.branches : []
  const endpoints = Array.isArray(endpointsJson?.endpoints) ? endpointsJson.endpoints : []
  const prodBranch = branches.find((b) => b?.primary === true) ?? branches.find((b) => b?.default === true) ?? null

  const sensitiveTokens = [neonProjectId]
  let matchedEndpoint = null
  for (const ep of endpoints) {
    if (ep?.host) sensitiveTokens.push(String(ep.host).toLowerCase())
    if (ep?.id) sensitiveTokens.push(String(ep.id))
    const epHostNorm = String(ep?.host ?? '').toLowerCase().replace(/-pooler(?=\.)/, '')
    if (
      observedTarget &&
      ((epHostNorm && sha256Hex(epHostNorm) === observedTarget.normalizedHostSha256) ||
        (ep?.id && observedTarget.endpointSha256 && sha256Hex(ep.id) === observedTarget.endpointSha256))
    ) {
      matchedEndpoint = ep
    }
  }

  let databaseConfirmedOnBranch = null
  if (prodBranch?.id && observedTarget?.databaseSha256) {
    const dbRes = await fetchFn(`${base}/branches/${encodeURIComponent(prodBranch.id)}/databases`, {
      headers,
    })
    if (dbRes.ok) {
      const dbJson = await dbRes.json()
      const dbs = Array.isArray(dbJson?.databases) ? dbJson.databases : []
      for (const d of dbs) {
        if (d?.name) sensitiveTokens.push(String(d.name))
      }
      databaseConfirmedOnBranch = dbs.some(
        (d) => typeof d?.name === 'string' && sha256Hex(d.name) === observedTarget.databaseSha256,
      )
    }
  }

  let snapshots = []
  try {
    const snapRes = await fetchFn(`${base}/snapshots`, { headers })
    if (snapRes.ok) {
      const snapJson = await snapRes.json()
      snapshots = (Array.isArray(snapJson?.snapshots) ? snapJson.snapshots : []).map((s) => ({
        id: s.id,
        sourceBranchId: s.source_branch_id ?? null,
        createdAt: s.created_at ?? null,
        expiresAt: s.expires_at ?? null,
      }))
    }
  } catch {
    // Non-fatal: snapshots endpoint may be unsupported on some plans.
  }

  const backupBranches = branches
    .filter((b) => /backup|pre-migration/i.test(String(b?.name ?? '')))
    .map((b) => ({
      id: b.id,
      name: b.name,
      parentId: b.parent_id ?? null,
      createdAt: b.created_at ?? null,
      state: b.current_state ?? null,
    }))

  const endpointBelongsToProductionBranch = Boolean(
    matchedEndpoint && prodBranch && matchedEndpoint.branch_id === prodBranch.id && matchedEndpoint.type === 'read_write',
  )

  return {
    status: 'VERIFIED',
    vercelResource,
    projectIdSha256: sha256Hex(projJson?.project?.id ?? neonProjectId),
    regionId: projJson?.project?.region_id ?? null,
    productionBranch: prodBranch
      ? {
          idSha256: sha256Hex(prodBranch.id),
          name: prodBranch.name,
          primary: Boolean(prodBranch.primary),
          default: Boolean(prodBranch.default),
          protected: Boolean(prodBranch.protected),
          currentState: prodBranch.current_state ?? null,
        }
      : null,
    endpointMatchesObserved: Boolean(matchedEndpoint),
    endpointBelongsToProductionBranch,
    databaseConfirmedOnBranch,
    recoveryOptions: {
      snapshots,
      backupBranches,
      verifiedReadOnly: true,
    },
    sensitiveTokens: [...new Set(sensitiveTokens)],
  }
}

export const queryPrismaLedgerReadOnly = (databaseUrl) => {
  assertReadOnlySql(LEDGER_READ_ONLY_SQL)
  const raw = execFileSync(
    'psql',
    [databaseUrl, '-X', '-q', '-t', '-A', '-F', '\t', '-v', 'ON_ERROR_STOP=1', '-c', LEDGER_READ_ONLY_SQL],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        PGCONNECT_TIMEOUT: '15',
        PGOPTIONS: '-c default_transaction_read_only=on',
      },
    },
  )
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

export const runIdentityPreflight = async (options = {}) => {
  const repoRoot = resolve(options.repoRoot ?? '.')
  const runtimePath = join(repoRoot, '.anclora/PRODUCTION_RUNTIME.md')
  const runtimeMarkdown = readFileSync(runtimePath, 'utf8')
  const contract = parseRuntimeContract(runtimeMarkdown)

  const databaseUrl = options.databaseUrl ?? process.env.PRODUCTION_MIGRATION_DATABASE_URL ?? ''
  if (!databaseUrl) {
    throw new Error('PREFLIGHT_DATABASE_URL_MISSING: PRODUCTION_MIGRATION_DATABASE_URL is required')
  }

  const sensitiveTokens = collectSensitiveTokens(databaseUrl)
  const observedTarget = extractTargetIdentity(databaseUrl, { requireDirect: true })

  // Anti-substitution check against committed PRODUCTION_RUNTIME.md contract.
  const contractFingerprint = contract.DATABASE_TARGET_FINGERPRINT || null
  const approvedRefFingerprint = options.defaultBranchContractFingerprint || null
  if (contractFingerprint && approvedRefFingerprint && contractFingerprint !== approvedRefFingerprint) {
    throw new Error(
      `PREFLIGHT_CONTRACT_DRIFT: candidate DATABASE_TARGET_FINGERPRINT (${contractFingerprint}) differs from default branch (${approvedRefFingerprint})`,
    )
  }
  const effectiveContractFingerprint = approvedRefFingerprint ?? contractFingerprint
  const inputExpectedFingerprint = options.expectedFingerprint?.trim() || null
  if (
    effectiveContractFingerprint &&
    inputExpectedFingerprint &&
    inputExpectedFingerprint !== effectiveContractFingerprint
  ) {
    throw new Error(
      'PREFLIGHT_CONTRACT_OVERRIDE_FORBIDDEN: workflow input cannot substitute registered DATABASE_TARGET_FINGERPRINT',
    )
  }

  const renderResult = await resolveRenderTargetIdentity({
    serviceId: options.renderServiceId ?? contract.BACKEND_RENDER_SERVICE_ID ?? null,
    apiKey: options.renderApiKey ?? process.env.RENDER_API_KEY ?? '',
    fetchFn: options.fetchFn,
  })
  sensitiveTokens.push(...renderResult.sensitiveTokens)

  const neonResult = await resolveNeonTargetIdentity({
    neonApiKey: options.neonApiKey ?? process.env.NEON_API_KEY ?? '',
    neonProjectId: options.neonProjectId ?? process.env.NEON_PROJECT_ID ?? '',
    vercelIntegration: options.vercelIntegration,
    observedTarget,
    fetchFn: options.fetchFn,
  })
  sensitiveTokens.push(...neonResult.sensitiveTokens)

  const migrationDir = contract.MIGRATION_DIRECTORY ?? 'backend/prisma/migrations'
  const manifestPath = contract.MIGRATION_MANIFEST_PATH || 'scripts/release/release-manifest.json'
  const disk = collectDiskMigrations(repoRoot, migrationDir)
  const manifest = verifyManifestOnDisk(repoRoot, manifestPath, disk.migrations)
  if (!manifest.present) {
    throw new Error(`PREFLIGHT_MANIFEST_MISSING: ${manifestPath} not found`)
  }

  const ledgerRows = options.ledgerRows ?? (options.queryLedgerFn ? options.queryLedgerFn(databaseUrl) : queryPrismaLedgerReadOnly(databaseUrl))
  const ledgerSummary = evaluateLedgerRows(ledgerRows, disk.migrations, manifest.equivalences)

  // Compute pending migration names cleanly without querying any user tables.
  const finishedByName = new Set()
  for (const row of ledgerRows) {
    if (row.rolled_back_at || !row.finished_at) {
      finishedByName.delete(row.migration_name)
    } else {
      finishedByName.add(row.migration_name)
    }
  }
  const pendingMigrationNames = disk.names.filter((n) => !finishedByName.has(n))

  // Cross-comparisons across fingerprint, endpoint, port, and database.
  const mismatches = []
  const unverified = []

  let contractMatch = null
  if (!effectiveContractFingerprint) {
    unverified.push('CONTRACT_FINGERPRINT_UNDECLARED')
  } else {
    contractMatch = effectiveContractFingerprint === observedTarget.fingerprint
    if (!contractMatch) mismatches.push('CONTRACT_FINGERPRINT_MISMATCH')
  }

  let inputExpectedMatch = null
  if (inputExpectedFingerprint) {
    inputExpectedMatch = inputExpectedFingerprint === observedTarget.fingerprint
    if (!inputExpectedMatch) mismatches.push('OPERATOR_EXPECTED_FINGERPRINT_MISMATCH')
  }

  let renderComparison = null
  if (renderResult.status !== 'VERIFIED' || !renderResult.target) {
    unverified.push('RENDER_IDENTITY_UNVERIFIED')
  } else {
    const rt = renderResult.target
    renderComparison = {
      fingerprintMatches: rt.fingerprint === observedTarget.fingerprint,
      endpointMatches: rt.endpointSha256 === observedTarget.endpointSha256 && rt.normalizedHostSha256 === observedTarget.normalizedHostSha256,
      portMatches: rt.port === observedTarget.port,
      databaseMatches: rt.databaseSha256 === observedTarget.databaseSha256,
    }
    if (!Object.values(renderComparison).every(Boolean)) {
      mismatches.push('RENDER_TARGET_MISMATCH')
    }
  }

  let neonComparison = null
  if (neonResult.status !== 'VERIFIED') {
    unverified.push('NEON_IDENTITY_UNVERIFIED')
  } else {
    neonComparison = {
      endpointMatchesObserved: neonResult.endpointMatchesObserved,
      endpointBelongsToProductionBranch: neonResult.endpointBelongsToProductionBranch,
      databaseConfirmedOnBranch: neonResult.databaseConfirmedOnBranch,
    }
    if (
      !neonComparison.endpointMatchesObserved ||
      !neonComparison.endpointBelongsToProductionBranch ||
      neonComparison.databaseConfirmedOnBranch === false
    ) {
      mismatches.push('NEON_BRANCH_OR_ENDPOINT_MISMATCH')
    }
  }

  const ledgerIntegrityClean =
    ledgerSummary.checksumMismatchCount === 0 &&
    ledgerSummary.failedCount === 0 &&
    ledgerSummary.rolledBackCount === 0 &&
    ledgerSummary.extraDbCount === 0
  if (!ledgerIntegrityClean) {
    mismatches.push('LEDGER_INTEGRITY_FAILED')
  }

  const status =
    mismatches.length > 0
      ? 'IDENTITY_MISMATCH_BLOCKED'
      : unverified.length > 0
        ? 'IDENTITY_PREFLIGHT_PARTIAL'
        : 'IDENTITY_VERIFIED_MATCH'

  const report = {
    schemaVersion: 'ProductionDatabaseIdentityPreflightV1',
    mode: 'identity-preflight',
    readOnly: true,
    generatedAt: new Date().toISOString(),
    candidateSha: options.candidateSha ?? null,
    status,
    mismatches,
    unverified,
    contract: {
      declaredFingerprint: effectiveContractFingerprint,
      contractFingerprintMatchesObserved: contractMatch,
      inputExpectedFingerprintProvided: Boolean(inputExpectedFingerprint),
      inputExpectedFingerprintMatchesObserved: inputExpectedMatch,
      contractMutatedByPreflight: false,
    },
    observedTarget: stripInternalTargetFields(observedTarget),
    render: {
      status: renderResult.status,
      serviceId: renderResult.serviceId,
      serviceName: renderResult.serviceName ?? null,
      serviceBranch: renderResult.serviceBranch ?? null,
      serviceRootDir: renderResult.serviceRootDir ?? null,
      reason: renderResult.reason ?? null,
      target: stripInternalTargetFields(renderResult.target),
      comparison: renderComparison,
    },
    neon: {
      status: neonResult.status,
      reason: neonResult.reason ?? null,
      vercelResource: neonResult.vercelResource,
      projectIdSha256: neonResult.projectIdSha256,
      regionId: neonResult.regionId ?? null,
      productionBranch: neonResult.productionBranch,
      comparison: neonComparison,
      recoveryOptions: neonResult.recoveryOptions,
    },
    ledger: {
      integrityClean: ledgerIntegrityClean,
      allMigrationsApplied: ledgerSummary.pendingCount === 0 && ledgerSummary.status === 'verified',
      declaredCount: ledgerSummary.declaredCount,
      appliedCount: ledgerSummary.appliedCount,
      pendingCount: ledgerSummary.pendingCount,
      pendingMigrationNames,
      failedCount: ledgerSummary.failedCount,
      rolledBackCount: ledgerSummary.rolledBackCount,
      resolvedRolledBackCount: ledgerSummary.resolvedRolledBackCount,
      checksumMismatchCount: ledgerSummary.checksumMismatchCount,
      extraDbCount: ledgerSummary.extraDbCount,
      acceptedHistoricalEquivalencesCount: ledgerSummary.acceptedHistoricalEquivalences.length,
      appliedMigrationsDigest: ledgerSummary.appliedMigrationsDigest,
    },
  }

  const serialized = `${JSON.stringify(report, null, 2)}\n`
  assertNoSensitiveLeak(serialized, sensitiveTokens)
  return { report, serialized, sensitiveTokens }
}

const parseCliArgs = (argv) => {
  assertNoForbiddenCliFlags(argv)
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

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url

if (isMain) {
  try {
    const args = parseCliArgs(process.argv.slice(2))
    const databaseUrl = process.env.PRODUCTION_MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL ?? ''
    if (process.env.GITHUB_ACTIONS === 'true' && databaseUrl) {
      emitGithubMasks(databaseUrl)
    }
    const result = await runIdentityPreflight({
      repoRoot: args['repo-root'] ?? '.',
      candidateSha: args['candidate-sha'] ?? null,
      defaultBranchContractFingerprint: args['default-branch-fingerprint'] || null,
      expectedFingerprint: args['expected-fingerprint'] || null,
      databaseUrl,
    })

    const summary = {
      status: result.report.status,
      fingerprint: result.report.observedTarget.fingerprint,
      port: result.report.observedTarget.port,
      isPooler: result.report.observedTarget.isPooler,
      renderStatus: result.report.render.status,
      neonStatus: result.report.neon.status,
      ledgerIntegrityClean: result.report.ledger.integrityClean,
      pendingCount: result.report.ledger.pendingCount,
      pendingMigrationNames: result.report.ledger.pendingMigrationNames,
      unverified: result.report.unverified,
      mismatches: result.report.mismatches,
    }
    const summaryText = JSON.stringify(summary)
    assertNoSensitiveLeak(summaryText, result.sensitiveTokens)

    if (args.output) {
      const outAbs = resolve(args.output)
      writeFileSync(outAbs, result.serialized)
      writeFileSync(`${outAbs}.sha256`, `${sha256Hex(Buffer.from(result.serialized, 'utf8'))}  ${join(dirname(outAbs), 'identity-preflight.json').split('/').pop()}\n`)
    }
    console.log(summaryText)
    if (result.report.mismatches.length > 0 || result.report.status === 'IDENTITY_MISMATCH_BLOCKED') {
      process.exit(1)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const rawUrl = process.env.PRODUCTION_MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL ?? ''
    const safeMsg = collectSensitiveTokens(rawUrl).reduce(
      (acc, token) => (token && token.length >= 3 ? acc.split(token).join('[REDACTED]') : acc),
      message.replace(/postgres(ql)?:\/\/[^\s'"]+/gi, '[REDACTED_URL]'),
    )
    console.error(`::error::${safeMsg}`)
    process.exit(1)
  }
}
