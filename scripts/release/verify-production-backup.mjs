#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  canonicalSort,
  computeAttestationDigest,
  computeDatabaseFingerprint,
  parseRuntimeContract,
} from './emit-migration-attestation.mjs'

export const PROPOSED_OD03_MAX_BACKUP_AGE_MINUTES = 30
export const MAX_FUTURE_CLOCK_SKEW_MS = 60 * 1000 // Tightened from 5m to 60s (D-2026-0056)
export const DEFAULT_NEON_API_TIMEOUT_MS = 15 * 1000
export const NEON_IMMUTABLE_BRANCH_ID_RE = /^br-[a-z0-9-]+$/
export const NEON_ENDPOINT_ID_RE = /^ep-[a-z0-9-]+$/
const SHA256_FINGERPRINT_RE = /^sha256:[0-9a-f]{64}$/
const HEX64_RE = /^[0-9a-f]{64}$/
const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/
const PLACEHOLDER_REF_RE = /^(pending|todo|tbd|none|null|n\/a|na|unknown)$/i
const PROTECTED_PRODUCTION_BRANCH_IDS = new Set([
  'br-gentle-bar-ag3slpph',
  'br-empty-forest-ag9p7l45',
  'br-shy-cloud-agi9o4kv',
])
const PROTECTED_PRODUCTION_ENDPOINTS = new Set([
  'ep-lingering-paper-agjnrga3',
])
const NEON_BRANCH_NON_READY_STATES = new Set(['init', 'creating', 'updating', 'deleting', 'deleted', 'archived', 'failed', 'suspended'])
const NEON_ENDPOINT_ACTIVE_STATES = new Set(['active', 'idle'])

const sha256Hex = (value) => createHash('sha256').update(value).digest('hex')
const sha256Prefixed = (value) => `sha256:${sha256Hex(value)}`

export const computeBackupEvidenceDigest = (evidence) => {
  const { evidenceDigest: _ignored, ...rest } = evidence
  return sha256Prefixed(JSON.stringify(canonicalSort(rest)))
}

export const assertReadOnlyNeonMethod = (method = 'GET', url = '') => {
  const normalizedMethod = String(method).trim().toUpperCase()
  if (normalizedMethod !== 'GET' && normalizedMethod !== 'HEAD') {
    throw new Error(
      `BACKUP_GATE_FORBIDDEN_WRITE_METHOD: Neon API access must be strictly read-only (received ${normalizedMethod}).`,
    )
  }
  const normalizedUrl = String(url)
  if (/\/(restore|reset)\b/i.test(normalizedUrl)) {
    throw new Error('BACKUP_GATE_FORBIDDEN_RECOVERY_ENDPOINT: destructive or mutating Neon recovery endpoints are forbidden.')
  }
  return normalizedMethod
}

export const assertSafeRecoveryOperation = ({
  action,
  targetBranchId = '',
  targetBranchName = '',
  targetEndpointId = '',
  isIsolatedTarget = false,
} = {}) => {
  const normalizedAction = String(action ?? '').trim().toLowerCase()
  const branchId = String(targetBranchId ?? '').trim()
  const branchName = String(targetBranchName ?? '').trim().toLowerCase()
  const endpointId = String(targetEndpointId ?? '').trim()

  if (
    branchName === 'main' ||
    branchName === 'production' ||
    PROTECTED_PRODUCTION_BRANCH_IDS.has(branchId) ||
    PROTECTED_PRODUCTION_ENDPOINTS.has(endpointId)
  ) {
    throw new Error(
      'RECOVERY_SAFETY_BLOCKED_PRODUCTION_TARGET: mutating or restoring onto production/protected branch or endpoint is forbidden.',
    )
  }
  if (normalizedAction.includes('restore') || normalizedAction.includes('drill')) {
    if (!isIsolatedTarget) {
      throw new Error(
        'AUTOMATED_RESTORE_DRILL_BLOCKED_NO_VERIFIED_ISOLATION: automated restore drills require an explicitly verified isolated non-production target.',
      )
    }
  }
  return true
}

export const assertNoSecretMaterial = (payload, context = 'backup-verification') => {
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload)
  if (/(?:postgres(?:ql)?:\/\/|mysql:\/\/|napi_[a-zA-Z0-9]+|Bearer\s+[a-zA-Z0-9._-]+|[\w.-]+\.neon\.tech)/i.test(serialized)) {
    throw new Error(`BACKUP_GATE_SECRET_LEAK_PREVENTED: potential secret or host leaked in ${context}.`)
  }
}

export const parseBackupGateContract = (runtimeMarkdown, { env = process.env } = {}) => {
  if (
    env &&
    (env.INPUT_MAX_BACKUP_AGE_MINUTES || env.OVERRIDE_MAX_BACKUP_AGE_MINUTES || env.SKIP_BACKUP_VERIFICATION)
  ) {
    throw new Error(
      'BACKUP_GATE_FORBIDDEN_THRESHOLD_OVERRIDE: workflow inputs/env cannot override OD-03 threshold or skip backup checks.',
    )
  }

  const contract = parseRuntimeContract(runtimeMarkdown)
  const databaseProvider = (contract.DATABASE_PROVIDER ?? '').trim()
  const databaseTargetFingerprint = (contract.DATABASE_TARGET_FINGERPRINT ?? '').trim()
  const neonProjectId = (contract.DATABASE_NEON_PROJECT_ID ?? '').trim()
  const productionBranchId = (contract.DATABASE_NEON_PRODUCTION_BRANCH_ID ?? '').trim()
  const productionEndpointId = (contract.DATABASE_NEON_ENDPOINT_ID ?? '').trim()
  const backupPolicy = (contract.MIGRATION_BACKUP_GATE_POLICY ?? '').trim()
  const maxAgeRaw = (contract.MIGRATION_MAX_BACKUP_AGE_MINUTES ?? '').trim()

  if (!databaseProvider || databaseProvider.toLowerCase() === 'none') {
    throw new Error('BACKUP_GATE_CONTRACT_NO_DATABASE: repository does not declare a production database.')
  }
  if (!SHA256_FINGERPRINT_RE.test(databaseTargetFingerprint)) {
    throw new Error('BACKUP_GATE_FINGERPRINT_UNDECLARED: DATABASE_TARGET_FINGERPRINT must be sha256:<64-hex>.')
  }
  if (!neonProjectId) {
    throw new Error('BACKUP_GATE_CONTRACT_MISSING_NEON_PROJECT: DATABASE_NEON_PROJECT_ID is required.')
  }
  if (!NEON_IMMUTABLE_BRANCH_ID_RE.test(productionBranchId)) {
    throw new Error(
      'BACKUP_GATE_CONTRACT_INVALID_BRANCH_ID: DATABASE_NEON_PRODUCTION_BRANCH_ID must be an immutable Neon branch ID (br-...).',
    )
  }
  if (!NEON_ENDPOINT_ID_RE.test(productionEndpointId)) {
    throw new Error(
      'BACKUP_GATE_CONTRACT_INVALID_ENDPOINT_ID: DATABASE_NEON_ENDPOINT_ID must be a Neon endpoint ID (ep-...).',
    )
  }
  if (!maxAgeRaw) {
    throw new Error(
      'BACKUP_GATE_BLOCKED_OD03_UNAPPROVED: MIGRATION_MAX_BACKUP_AGE_MINUTES is not activated in .anclora/PRODUCTION_RUNTIME.md.',
    )
  }

  const maxBackupAgeMinutes = Number(maxAgeRaw)
  if (!Number.isFinite(maxBackupAgeMinutes) || maxBackupAgeMinutes <= 0 || !Number.isInteger(maxBackupAgeMinutes)) {
    throw new Error(
      `BACKUP_GATE_BLOCKED_OD03_THRESHOLD_INVALID: MIGRATION_MAX_BACKUP_AGE_MINUTES must be a positive integer (got ${maxAgeRaw}).`,
    )
  }
  if (maxBackupAgeMinutes > PROPOSED_OD03_MAX_BACKUP_AGE_MINUTES) {
    throw new Error(
      `BACKUP_GATE_BLOCKED_OD03_THRESHOLD_EXCEEDS_CAP: MIGRATION_MAX_BACKUP_AGE_MINUTES (${maxBackupAgeMinutes}) exceeds OD-03 maximum (${PROPOSED_OD03_MAX_BACKUP_AGE_MINUTES}).`,
    )
  }

  return {
    databaseProvider,
    databaseTargetFingerprint,
    neonProjectId,
    productionBranchId,
    productionEndpointId,
    backupPolicy,
    maxBackupAgeMinutes,
  }
}

export const verifyDatabaseIdentityAgainstContract = ({ databaseUrl, contract }) => {
  if (!databaseUrl || typeof databaseUrl !== 'string') {
    throw new Error('BACKUP_GATE_DATABASE_URL_MISSING: environment secret DATABASE_URL is not set.')
  }
  let parsed
  try {
    parsed = new URL(databaseUrl)
  } catch {
    throw new Error('BACKUP_GATE_DATABASE_URL_INVALID: database URL could not be parsed.')
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error('BACKUP_GATE_DATABASE_PROTOCOL_INVALID: expected postgres:// or postgresql:// scheme.')
  }
  if (parsed.hostname.includes('-pooler')) {
    throw new Error('BACKUP_GATE_POOLER_FORBIDDEN: migration database URL must use direct Neon endpoint, not -pooler.')
  }

  const observedFingerprint = computeDatabaseFingerprint(databaseUrl)
  if (observedFingerprint !== contract.databaseTargetFingerprint) {
    throw new Error(
      `BACKUP_GATE_DATABASE_FINGERPRINT_MISMATCH: observed ${observedFingerprint} != contract ${contract.databaseTargetFingerprint}.`,
    )
  }

  const endpointPrefixMatch = parsed.hostname.match(/^(ep-[a-z0-9-]+)(?:\.|$)/)
  if (endpointPrefixMatch && endpointPrefixMatch[1] !== contract.productionEndpointId) {
    throw new Error(
      `BACKUP_GATE_ENDPOINT_URL_MISMATCH: URL endpoint ${endpointPrefixMatch[1]} != contract ${contract.productionEndpointId}.`,
    )
  }

  return {
    observedFingerprint,
    endpointPrefix: endpointPrefixMatch?.[1] ?? null,
  }
}

/**
 * Explicit adapter between real Neon API resource payloads (/branches and /snapshots)
 * and the AOS fail-closed backup verification contract. Never fabricates "ready".
 */
export const adaptNeonBackupResource = ({ resource, kind, productionBranchId, nowMs }) => {
  if (!resource || typeof resource !== 'object') {
    throw new Error('BACKUP_NOT_FOUND_IN_NEON: Neon resource payload is empty.')
  }
  const ref = String(resource.id ?? '').trim()
  if (!ref) {
    throw new Error('BACKUP_GATE_INVALID_REFERENCE: Neon resource missing id.')
  }

  if (kind === 'branch') {
    if (ref === productionBranchId) {
      throw new Error(
        `BACKUP_REFERENCE_EQUALS_PRODUCTION_BRANCH: ${ref} is the active production branch itself, not a separate backup.`,
      )
    }
    const sourceBranchId = String(resource.parent_id ?? '').trim()
    if (!NEON_IMMUTABLE_BRANCH_ID_RE.test(sourceBranchId) || sourceBranchId !== productionBranchId) {
      throw new Error(
        `BACKUP_SOURCE_BRANCH_MISMATCH: backup branch ${ref} parent_id is ${sourceBranchId || 'unknown'}, expected ${productionBranchId}.`,
      )
    }
    const rawState = typeof resource.current_state === 'string' ? resource.current_state.trim().toLowerCase() : ''
    const pendingState = typeof resource.pending_state === 'string' ? resource.pending_state.trim().toLowerCase() : ''
    if (!rawState) {
      throw new Error(
        `BACKUP_STATUS_UNVERIFIABLE_FROM_PROVIDER: Neon branch ${ref} omitted current_state (cannot fabricate 'ready').`,
      )
    }
    if (pendingState && pendingState !== 'ready') {
      throw new Error(
        `BACKUP_NOT_READY: Neon branch ${ref} has active pending_state='${pendingState}'.`,
      )
    }
    if (NEON_BRANCH_NON_READY_STATES.has(rawState) || rawState !== 'ready') {
      throw new Error(`BACKUP_NOT_READY: backup ${ref} state in Neon is '${rawState}', expected 'ready'.`)
    }
    return {
      reference: ref,
      kind: 'branch',
      sourceBranchId,
      createdAt: String(resource.created_at ?? ''),
      providerState: 'ready',
      verifiedByProvider: true,
      recoveryCompatibility: 'SAFE_IMMUTABLE_CHILD_BRANCH',
    }
  }

  if (kind === 'snapshot') {
    const sourceBranchId = String(resource.source_branch_id ?? '').trim()
    if (!NEON_IMMUTABLE_BRANCH_ID_RE.test(sourceBranchId) || sourceBranchId !== productionBranchId) {
      throw new Error(
        `BACKUP_SOURCE_BRANCH_MISMATCH: snapshot ${ref} belongs to branch ${sourceBranchId || 'unknown'}, expected ${productionBranchId}.`,
      )
    }
    if (resource.expires_at !== undefined && resource.expires_at !== null && String(resource.expires_at).trim() !== '') {
      const expiresAtStr = String(resource.expires_at)
      const expiresMs = ISO_TIMESTAMP_RE.test(expiresAtStr) ? Date.parse(expiresAtStr) : NaN
      if (!Number.isFinite(expiresMs) || expiresMs <= nowMs) {
        throw new Error(`BACKUP_EXPIRED_BY_PROVIDER: snapshot ${ref} reached provider expires_at (${expiresAtStr}).`)
      }
    }
    // Neon /snapshots commonly omits status/current_state; NEVER assume or fabricate 'ready'.
    const explicitStateRaw = resource.status ?? resource.current_state ?? resource.state ?? ''
    const explicitState = typeof explicitStateRaw === 'string' ? explicitStateRaw.trim().toLowerCase() : ''
    if (!explicitState) {
      throw new Error(
        `BACKUP_STATUS_UNVERIFIABLE_FROM_PROVIDER: Neon snapshot ${ref} did not report an explicit status (cannot fabricate 'ready').`,
      )
    }
    if (explicitState !== 'ready') {
      throw new Error(`BACKUP_NOT_READY: snapshot ${ref} state in Neon is '${explicitState}', expected 'ready'.`)
    }
    return {
      reference: ref,
      kind: 'snapshot',
      sourceBranchId,
      createdAt: String(resource.created_at ?? ''),
      providerState: 'ready',
      verifiedByProvider: true,
      recoveryCompatibility: 'SNAPSHOT_EXPLICITLY_READY',
    }
  }

  throw new Error(`BACKUP_GATE_UNSUPPORTED_RESOURCE_KIND: ${kind}`)
}

const neonGetJson = async ({ path, apiKey, fetchImpl, timeoutMs = DEFAULT_NEON_API_TIMEOUT_MS }) => {
  const url = `https://console.neon.tech/api/v2${path}`
  const method = assertReadOnlyNeonMethod('GET', url)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('NEON_API_TIMEOUT')), timeoutMs)
  try {
    let res
    try {
      res = await fetchImpl(url, {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      })
    } catch (err) {
      if (err && (err.name === 'AbortError' || String(err.message).includes('TIMEOUT'))) {
        throw new Error(`BACKUP_GATE_NEON_API_TIMEOUT: GET ${path} timed out after ${timeoutMs}ms.`)
      }
      throw new Error(`BACKUP_GATE_NEON_API_ERROR: GET ${path} network failure (${err instanceof Error ? err.message : 'unknown'}).`)
    }
    if (!res || !res.ok) {
      throw new Error(`BACKUP_GATE_NEON_API_ERROR: GET ${path} returned HTTP ${res?.status ?? 'unknown'}.`)
    }
    try {
      return await res.json()
    } catch {
      throw new Error(`BACKUP_GATE_NEON_API_INVALID_JSON: GET ${path} returned malformed JSON.`)
    }
  } finally {
    clearTimeout(timer)
  }
}

export const verifyNeonBackupState = async ({
  neonApiKey,
  neonProjectId,
  contract,
  backupReference,
  nowIso,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_NEON_API_TIMEOUT_MS,
}) => {
  if (!neonApiKey || !String(neonApiKey).trim()) {
    throw new Error('BACKUP_GATE_NEON_API_KEY_MISSING: read-only secret NEON_API_KEY is required.')
  }
  if (!neonProjectId || !String(neonProjectId).trim()) {
    throw new Error('BACKUP_GATE_NEON_PROJECT_ID_MISSING: variable NEON_PROJECT_ID is required.')
  }
  if (String(neonProjectId).trim() !== contract.neonProjectId) {
    throw new Error(
      `BACKUP_GATE_PROJECT_MISMATCH: NEON_PROJECT_ID (${neonProjectId}) != contract (${contract.neonProjectId}).`,
    )
  }

  const ref = String(backupReference ?? '').trim()
  if (
    ref.length < 4 ||
    PLACEHOLDER_REF_RE.test(ref) ||
    ref.includes('://') ||
    ref.includes('@') ||
    /\s/.test(ref)
  ) {
    throw new Error('BACKUP_GATE_INVALID_REFERENCE: backup_reference must be a valid non-secret Neon branch or snapshot ID.')
  }
  if (ref === contract.productionBranchId) {
    throw new Error(
      `BACKUP_REFERENCE_EQUALS_PRODUCTION_BRANCH: ${ref} is the active production branch itself, not a separate backup.`,
    )
  }
  if (!ISO_TIMESTAMP_RE.test(nowIso) || !Number.isFinite(Date.parse(nowIso))) {
    throw new Error('BACKUP_GATE_INVALID_CLOCK: evaluation timestamp must be valid ISO 8601 UTC.')
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('BACKUP_GATE_FETCH_UNAVAILABLE: HTTP client is required for Neon API verification.')
  }

  const nowMs = Date.parse(nowIso)

  const projectData = await neonGetJson({
    path: `/projects/${encodeURIComponent(contract.neonProjectId)}`,
    apiKey: neonApiKey,
    fetchImpl,
    timeoutMs,
  })
  const project = projectData?.project ?? projectData
  if (!project || project.id !== contract.neonProjectId) {
    throw new Error('BACKUP_GATE_NEON_PROJECT_NOT_FOUND: Neon API did not confirm configured project ID.')
  }

  const [branchesData, endpointsData] = await Promise.all([
    neonGetJson({
      path: `/projects/${encodeURIComponent(contract.neonProjectId)}/branches`,
      apiKey: neonApiKey,
      fetchImpl,
      timeoutMs,
    }),
    neonGetJson({
      path: `/projects/${encodeURIComponent(contract.neonProjectId)}/endpoints`,
      apiKey: neonApiKey,
      fetchImpl,
      timeoutMs,
    }),
  ])

  if (!Array.isArray(branchesData?.branches) || !Array.isArray(endpointsData?.endpoints)) {
    throw new Error(
      'BACKUP_GATE_NEON_API_INCOMPLETE_RESPONSE: Neon API omitted required branches or endpoints array.',
    )
  }
  const branches = branchesData.branches
  const endpoints = endpointsData.endpoints

  const prodBranch = branches.find((b) => b?.id === contract.productionBranchId)
  if (!prodBranch) {
    throw new Error(
      `BACKUP_GATE_PRODUCTION_BRANCH_MISSING: immutable branch ${contract.productionBranchId} not found in Neon project.`,
    )
  }
  if (prodBranch.primary !== true && prodBranch.default !== true) {
    throw new Error(
      `BACKUP_GATE_PRODUCTION_BRANCH_NOT_PRIMARY: branch ${contract.productionBranchId} is no longer primary/default in Neon.`,
    )
  }
  if (prodBranch.current_state !== 'ready') {
    throw new Error(
      `BACKUP_GATE_PRODUCTION_BRANCH_NOT_READY: production branch state is ${prodBranch.current_state ?? 'unknown'}.`,
    )
  }

  const prodEndpoint = endpoints.find((e) => e?.id === contract.productionEndpointId)
  if (!prodEndpoint) {
    throw new Error(
      `BACKUP_GATE_ENDPOINT_NOT_FOUND: endpoint ${contract.productionEndpointId} not found in Neon project.`,
    )
  }
  if (prodEndpoint.branch_id !== contract.productionBranchId) {
    throw new Error(
      `BACKUP_GATE_ENDPOINT_BRANCH_SWAP_DETECTED: endpoint ${contract.productionEndpointId} points to branch ${prodEndpoint.branch_id ?? 'unknown'}, expected ${contract.productionBranchId}.`,
    )
  }
  if (prodEndpoint.disabled === true) {
    throw new Error(`BACKUP_GATE_ENDPOINT_DISABLED: endpoint ${contract.productionEndpointId} is disabled in Neon.`)
  }
  if (prodEndpoint.type && prodEndpoint.type !== 'read_write') {
    throw new Error(`BACKUP_GATE_ENDPOINT_NOT_RW: endpoint ${contract.productionEndpointId} type is ${prodEndpoint.type}.`)
  }
  if (prodEndpoint.current_state && !NEON_ENDPOINT_ACTIVE_STATES.has(String(prodEndpoint.current_state))) {
    throw new Error(
      `BACKUP_GATE_ENDPOINT_UNAVAILABLE: endpoint ${contract.productionEndpointId} state is ${prodEndpoint.current_state}.`,
    )
  }

  let adapted
  if (NEON_IMMUTABLE_BRANCH_ID_RE.test(ref)) {
    const branchBackup = branches.find((b) => b?.id === ref)
    if (!branchBackup) {
      throw new Error(`BACKUP_NOT_FOUND_IN_NEON: branch ${ref} does not exist in Neon project ${contract.neonProjectId}.`)
    }
    adapted = adaptNeonBackupResource({
      resource: branchBackup,
      kind: 'branch',
      productionBranchId: contract.productionBranchId,
      nowMs,
    })
  } else {
    const snapshotsData = await neonGetJson({
      path: `/projects/${encodeURIComponent(contract.neonProjectId)}/snapshots`,
      apiKey: neonApiKey,
      fetchImpl,
      timeoutMs,
    })
    if (!Array.isArray(snapshotsData?.snapshots)) {
      throw new Error('BACKUP_GATE_NEON_API_INCOMPLETE_RESPONSE: Neon API omitted snapshots array.')
    }
    const snap = snapshotsData.snapshots.find((s) => s?.id === ref)
    if (!snap) {
      throw new Error(`BACKUP_NOT_FOUND_IN_NEON: snapshot ${ref} does not exist in Neon project ${contract.neonProjectId}.`)
    }
    adapted = adaptNeonBackupResource({
      resource: snap,
      kind: 'snapshot',
      productionBranchId: contract.productionBranchId,
      nowMs,
    })
  }

  if (!ISO_TIMESTAMP_RE.test(adapted.createdAt) || !Number.isFinite(Date.parse(adapted.createdAt))) {
    throw new Error(`BACKUP_TIMESTAMP_INVALID: Neon backup ${ref} returned invalid created_at timestamp.`)
  }

  const backupMs = Date.parse(adapted.createdAt)
  if (backupMs - nowMs > MAX_FUTURE_CLOCK_SKEW_MS) {
    throw new Error(
      `BACKUP_TIMESTAMP_IN_FUTURE: backup ${ref} created_at exceeds ${MAX_FUTURE_CLOCK_SKEW_MS / 1000}s NTP clock-skew tolerance.`,
    )
  }

  const ageMs = nowMs - backupMs
  const maxAllowedAgeMs = contract.maxBackupAgeMinutes * 60_000
  if (ageMs > maxAllowedAgeMs) {
    throw new Error(
      `BACKUP_STALE: backup ${ref} age (${(ageMs / 60_000).toFixed(2)}m) exceeds authorized ${contract.maxBackupAgeMinutes}m window.`,
    )
  }

  return {
    reference: adapted.reference,
    kind: adapted.kind,
    sourceBranchId: adapted.sourceBranchId,
    endpointId: prodEndpoint.id,
    createdAt: adapted.createdAt,
    verifiedByProvider: adapted.verifiedByProvider,
    providerState: adapted.providerState,
    recoveryCompatibility: adapted.recoveryCompatibility,
    ageSeconds: Math.max(0, Math.floor(ageMs / 1000)),
  }
}

export const verifyProductionBackup = async ({
  repoRoot = '.',
  databaseUrl,
  neonApiKey,
  neonProjectId,
  candidateSha,
  runId,
  runAttempt = 1,
  environment = 'production-migrations',
  backupReference,
  backupConfirmed,
  ledgerReviewed,
  preflightReportSha256,
  nowIso = new Date().toISOString(),
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_NEON_API_TIMEOUT_MS,
  env = process.env,
}) => {
  if (!/^[0-9a-f]{40}$/.test(String(candidateSha ?? ''))) {
    throw new Error('BACKUP_GATE_INVALID_CANDIDATE_SHA: full 40-character candidate SHA required.')
  }
  if (String(backupConfirmed) !== 'true' || String(ledgerReviewed) !== 'true') {
    throw new Error('BACKUP_GATE_CONFIRMATIONS_REQUIRED: backup_confirmed and ledger_reviewed must both be true.')
  }
  if (!HEX64_RE.test(String(preflightReportSha256 ?? ''))) {
    throw new Error('BACKUP_GATE_INVALID_PREFLIGHT_SHA256: preflight_report_sha256 must be 64 lowercase hex characters.')
  }

  const runtimePath = resolve(repoRoot, '.anclora', 'PRODUCTION_RUNTIME.md')
  const contract = parseBackupGateContract(readFileSync(runtimePath, 'utf8'), { env })
  const dbCheck = verifyDatabaseIdentityAgainstContract({ databaseUrl, contract })
  const neonBackup = await verifyNeonBackupState({
    neonApiKey,
    neonProjectId,
    contract,
    backupReference,
    nowIso,
    fetchImpl,
    timeoutMs,
  })

  const evidence = {
    schemaVersion: 'BackupVerificationEvidenceV1',
    verifiedAt: nowIso,
    policyDecision: 'OD-03',
    maxAllowedAgeMinutes: contract.maxBackupAgeMinutes,
    maxFutureClockSkewMs: MAX_FUTURE_CLOCK_SKEW_MS,
    evaluatorStatus: 'VERIFIED',
    workflowRun: {
      runId: Number(runId),
      runAttempt: Number(runAttempt ?? 1),
      candidateSha,
      environment,
    },
    contract: {
      databaseTargetFingerprint: dbCheck.observedFingerprint,
      neonProjectIdSha256: sha256Prefixed(contract.neonProjectId),
      productionBranchIdSha256: sha256Prefixed(contract.productionBranchId),
      productionEndpointIdSha256: sha256Prefixed(contract.productionEndpointId),
    },
    backup: {
      reference: neonBackup.reference,
      kind: neonBackup.kind,
      sourceBranchIdSha256: sha256Prefixed(neonBackup.sourceBranchId),
      endpointIdSha256: sha256Prefixed(neonBackup.endpointId),
      createdAt: neonBackup.createdAt,
      verifiedByProvider: neonBackup.verifiedByProvider,
      providerState: neonBackup.providerState,
      recoveryCompatibility: neonBackup.recoveryCompatibility,
      ageSeconds: neonBackup.ageSeconds,
    },
    preflightReportSha256,
  }
  evidence.evidenceDigest = computeBackupEvidenceDigest(evidence)
  assertNoSecretMaterial(evidence, 'backup-verification.json')
  return evidence
}

/**
 * Canonical G39 Promotion-Gate consumer check for MigrationAttestationV1.backupVerification.
 * Prepared for synchronized deployment across templates/promote.yml once all parity repos are authorized.
 */
export const verifyAttestationBackupG39 = ({
  attestation,
  backupVerificationArtifact = null,
  contractMarkdown,
  evaluatedAtIso = new Date().toISOString(),
  maxPointOfUseAgeMinutes = null,
}) => {
  const fail = (code, msg) => {
    throw new Error(`PROMOTION_BLOCKED_${code}: ${msg}`)
  }

  if (!attestation || typeof attestation !== 'object' || attestation.schemaVersion !== 'MigrationAttestationV1') {
    fail('MIGRATION_EVIDENCE_TAMPERED', 'Missing or invalid MigrationAttestationV1.')
  }
  if (computeAttestationDigest(attestation) !== attestation.attestationDigest) {
    fail('MIGRATION_EVIDENCE_TAMPERED', 'MigrationAttestationV1 attestationDigest verification failed.')
  }

  const contract = parseRuntimeContract(contractMarkdown)
  const expectedProjectId = (contract.DATABASE_NEON_PROJECT_ID ?? '').trim()
  const expectedBranchId = (contract.DATABASE_NEON_PRODUCTION_BRANCH_ID ?? '').trim()
  const expectedEndpointId = (contract.DATABASE_NEON_ENDPOINT_ID ?? '').trim()
  const expectedFingerprint = (contract.DATABASE_TARGET_FINGERPRINT ?? '').trim()
  const maxAgeRaw = (contract.MIGRATION_MAX_BACKUP_AGE_MINUTES ?? '').trim()
  const od03Active = Boolean(maxAgeRaw) || /^OD-03_ENFORCED/i.test(contract.MIGRATION_BACKUP_GATE_POLICY ?? '')

  if (!od03Active && !attestation.backupVerification && !backupVerificationArtifact) {
    return { status: 'NOT_REQUIRED_BY_CONTRACT' }
  }

  const bv = attestation.backupVerification
  if (!bv || typeof bv !== 'object') {
    fail('MIGRATION_BACKUP_EVIDENCE_MISSING', 'MigrationAttestationV1 missing mandatory backupVerification block under OD-03.')
  }
  if (bv.schemaVersion !== 'BackupVerificationEvidenceV1' || bv.policyDecision !== 'OD-03' || bv.evaluatorStatus !== 'VERIFIED') {
    fail('MIGRATION_BACKUP_TAMPERED', 'Invalid backupVerification schemaVersion, policyDecision, or evaluatorStatus.')
  }
  if (bv.verifiedByProvider !== true || bv.providerState !== 'ready') {
    fail('MIGRATION_BACKUP_NOT_READY', 'backupVerification does not record provider-confirmed ready state.')
  }
  if (
    !bv.backupReference ||
    typeof bv.backupReference !== 'string' ||
    bv.backupReference.length < 4 ||
    bv.backupReference === expectedBranchId ||
    bv.backupReference.includes('://')
  ) {
    fail('MIGRATION_BACKUP_TAMPERED', 'Invalid or unsafe backupReference in attestation.backupVerification.')
  }
  if (bv.candidateSha !== attestation.workflowRun?.candidateSha || Number(bv.runId) !== Number(attestation.workflowRun?.runId)) {
    fail('MIGRATION_BACKUP_SHA_MISMATCH', 'backupVerification candidateSha/runId differs from MigrationAttestationV1 workflowRun.')
  }
  if (bv.databaseTargetFingerprint !== expectedFingerprint || bv.databaseTargetFingerprint !== attestation.database?.targetFingerprint) {
    fail('MIGRATION_DATABASE_MISMATCH', 'backupVerification targetFingerprint differs from contract or attestation database.')
  }
  if (expectedProjectId && bv.neonProjectIdSha256 !== sha256Prefixed(expectedProjectId)) {
    fail('MIGRATION_BACKUP_PROJECT_MISMATCH', 'backupVerification neonProjectIdSha256 differs from contract project ID.')
  }
  if (expectedBranchId) {
    const expectedBranchHash = sha256Prefixed(expectedBranchId)
    if (bv.productionBranchIdSha256 !== expectedBranchHash || bv.sourceBranchIdSha256 !== expectedBranchHash) {
      fail('MIGRATION_BACKUP_BRANCH_MISMATCH', 'backupVerification branch hash differs from contract immutable production branch.')
    }
  }
  if (expectedEndpointId) {
    const expectedEndpointHash = sha256Prefixed(expectedEndpointId)
    if (bv.productionEndpointIdSha256 !== expectedEndpointHash || bv.endpointIdSha256 !== expectedEndpointHash) {
      fail('MIGRATION_BACKUP_ENDPOINT_MISMATCH', 'backupVerification endpoint hash differs from contract endpoint ID.')
    }
  }

  const contractMaxAgeMinutes = maxAgeRaw ? Number(maxAgeRaw) : PROPOSED_OD03_MAX_BACKUP_AGE_MINUTES
  if (!Number.isInteger(contractMaxAgeMinutes) || contractMaxAgeMinutes <= 0 || contractMaxAgeMinutes > PROPOSED_OD03_MAX_BACKUP_AGE_MINUTES) {
    fail('MIGRATION_BACKUP_THRESHOLD_INVALID', `Contract MIGRATION_MAX_BACKUP_AGE_MINUTES (${maxAgeRaw}) violates OD-03 limit (1..30).`)
  }
  if (
    typeof bv.maxAllowedAgeMinutes !== 'number' ||
    bv.maxAllowedAgeMinutes <= 0 ||
    bv.maxAllowedAgeMinutes > contractMaxAgeMinutes ||
    bv.maxFutureClockSkewMs !== MAX_FUTURE_CLOCK_SKEW_MS
  ) {
    fail('MIGRATION_BACKUP_POLICY_MISMATCH', 'backupVerification threshold or clock-skew tolerance conflicts with OD-03 policy.')
  }

  if (
    !ISO_TIMESTAMP_RE.test(String(bv.verifiedAt ?? '')) ||
    !ISO_TIMESTAMP_RE.test(String(bv.backupCreatedAt ?? '')) ||
    !ISO_TIMESTAMP_RE.test(String(attestation.generatedAt ?? ''))
  ) {
    fail('MIGRATION_BACKUP_TAMPERED', 'backupVerification timestamps are missing or malformed ISO 8601 UTC.')
  }
  const verifiedMs = Date.parse(bv.verifiedAt)
  const createdMs = Date.parse(bv.backupCreatedAt)
  const attGeneratedMs = Date.parse(attestation.generatedAt)
  if (!Number.isFinite(verifiedMs) || !Number.isFinite(createdMs) || !Number.isFinite(attGeneratedMs)) {
    fail('MIGRATION_BACKUP_TAMPERED', 'Unparseable backupVerification timestamps.')
  }
  if (createdMs - verifiedMs > MAX_FUTURE_CLOCK_SKEW_MS) {
    fail('MIGRATION_BACKUP_TIMESTAMP_FUTURE', 'backupCreatedAt exceeds 60s skew relative to verifiedAt.')
  }
  if (attGeneratedMs < verifiedMs || attGeneratedMs < createdMs) {
    fail('MIGRATION_BACKUP_TIMELINE_INVALID', 'MigrationAttestationV1 generatedAt precedes backup creation/verification.')
  }
  const ageMs = verifiedMs - createdMs
  if (ageMs > contractMaxAgeMinutes * 60_000 || typeof bv.ageSeconds !== 'number' || bv.ageSeconds > contractMaxAgeMinutes * 60) {
    fail('MIGRATION_BACKUP_EXPIRED', 'Backup exceeded contract freshness window prior to migration execution.')
  }

  if (maxPointOfUseAgeMinutes !== null) {
    const evalMs = Date.parse(evaluatedAtIso)
    if (!Number.isFinite(evalMs) || evalMs - createdMs > maxPointOfUseAgeMinutes * 60_000) {
      fail('MIGRATION_BACKUP_EXPIRED_AT_POINT_OF_USE', 'Backup evidence exceeded point-of-use maximum validity window.')
    }
  }

  if (backupVerificationArtifact !== null) {
    if (typeof backupVerificationArtifact !== 'object' || computeBackupEvidenceDigest(backupVerificationArtifact) !== backupVerificationArtifact.evidenceDigest) {
      fail('MIGRATION_BACKUP_TAMPERED', 'backup-verification.json evidenceDigest verification failed.')
    }
    if (
      backupVerificationArtifact.evidenceDigest !== bv.evidenceDigest ||
      backupVerificationArtifact.backup?.reference !== bv.backupReference ||
      backupVerificationArtifact.backup?.createdAt !== bv.backupCreatedAt ||
      backupVerificationArtifact.workflowRun?.candidateSha !== bv.candidateSha ||
      backupVerificationArtifact.contract?.databaseTargetFingerprint !== bv.databaseTargetFingerprint
    ) {
      fail('MIGRATION_BACKUP_TAMPERED', 'backup-verification.json artifact disagrees with MigrationAttestationV1.backupVerification.')
    }
  }

  return {
    status: 'VERIFIED_OD03_G39',
    backupReference: bv.backupReference,
    evidenceDigest: bv.evidenceDigest,
    ageSeconds: bv.ageSeconds,
  }
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
  const outputPath = resolve(args.output ?? 'backup-verification.json')
  try {
    const evidence = await verifyProductionBackup({
      repoRoot: args['repo-root'] ?? '.',
      databaseUrl: process.env.DATABASE_URL ?? process.env.PRODUCTION_MIGRATION_DATABASE_URL,
      neonApiKey: process.env.NEON_API_KEY,
      neonProjectId: args['neon-project-id'] ?? process.env.NEON_PROJECT_ID,
      candidateSha: args['candidate-sha'] ?? process.env.CANDIDATE_SHA ?? process.env.GITHUB_SHA,
      runId: args['run-id'] ?? process.env.GITHUB_RUN_ID,
      runAttempt: args['run-attempt'] ?? process.env.GITHUB_RUN_ATTEMPT ?? '1',
      environment: args.environment ?? 'production-migrations',
      backupReference: args['backup-reference'] ?? process.env.BACKUP_REFERENCE,
      backupConfirmed: args['backup-confirmed'] ?? process.env.BACKUP_CONFIRMED,
      ledgerReviewed: args['ledger-reviewed'] ?? process.env.LEDGER_REVIEWED,
      preflightReportSha256: args['preflight-report-sha256'] ?? process.env.PREFLIGHT_REPORT_SHA256,
    })
    writeFileSync(outputPath, JSON.stringify(evidence, null, 2) + '\n')
    writeFileSync(`${outputPath}.sha256`, `${sha256Hex(readFileSync(outputPath))}  ${outputPath.split('/').pop()}\n`)
    console.log(
      `BackupVerificationEvidenceV1 verified: ref=${evidence.backup.reference} kind=${evidence.backup.kind} ` +
      `ageSeconds=${evidence.backup.ageSeconds} maxMinutes=${evidence.maxAllowedAgeMinutes} digest=${evidence.evidenceDigest}`,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    assertNoSecretMaterial(message, 'stderr')
    console.error(`::error::${message}`)
    process.exit(1)
  }
}
