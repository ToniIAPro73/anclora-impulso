import { readFileSync } from 'node:fs'

const REQUIRED_TECHNICAL_CONTROLS = [
  'SECURITY_AND_PRIVACY',
  'IDENTITY_AND_AUTHORIZATION',
  'DATA_PROTECTION',
  'LEDGER_INTEGRITY',
  'BACKUP_AND_RECOVERY',
  'OD03_AND_G39',
  'AUDIT_AND_TRACEABILITY',
  'HEALTH_RECOMMENDATION_SAFETY',
]

const REEVALUATION_MODES = new Set([
  'commercialization',
  'external_users',
  'personalized_plan_distribution',
])

export function parseRuntimeContract(markdown) {
  const out = {}
  for (const line of String(markdown ?? '').split(/\r?\n/)) {
    const m = /^([A-Z][A-Z0-9_]+)=(.*)$/.exec(line)
    if (m) out[m[1]] = m[2].trim()
  }
  return out
}

export function evaluatePrecommercialPolicy({
  contractMarkdown,
  targetMode = 'private_owner_use',
  technicalGatesOk = true,
  completedReviews = [],
  clinicalCertificationClaim = false,
} = {}) {
  const contract = parseRuntimeContract(contractMarkdown)

  if (contract.PRIVATE_PRECOMMERCIAL_SCOPE !== 'anclora-impulso' || contract.REPOSITORY !== 'anclora-impulso') {
    return {
      allowed: false,
      reason: 'INVALID_SCOPE_NON_IMPULSO',
      deferredReviews: [],
      enforcedControls: REQUIRED_TECHNICAL_CONTROLS,
    }
  }

  if (contract.PRODUCT_LIFECYCLE_STAGE !== 'PRIVATE_PRECOMMERCIAL') {
    return {
      allowed: false,
      reason: 'MISSING_OR_INVALID_LIFECYCLE_STAGE',
      deferredReviews: [],
      enforcedControls: REQUIRED_TECHNICAL_CONTROLS,
    }
  }

  if (contract.PRIVATE_PRECOMMERCIAL_TECHNICAL_GATES_EXEMPT !== 'false' || !technicalGatesOk) {
    return {
      allowed: false,
      reason: 'TECHNICAL_GATE_FAILED',
      deferredReviews: [],
      enforcedControls: REQUIRED_TECHNICAL_CONTROLS,
    }
  }

  if (clinicalCertificationClaim || contract.PRIVATE_PRECOMMERCIAL_CLINICAL_CERTIFICATION_CLAIMS_ALLOWED !== 'false') {
    return {
      allowed: false,
      reason: 'CLINICAL_CERTIFICATION_CLAIM_FORBIDDEN',
      deferredReviews: [],
      enforcedControls: REQUIRED_TECHNICAL_CONTROLS,
    }
  }

  const deferred = (contract.DEFERRED_NON_TECHNICAL_REVIEWS ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  const done = new Set(completedReviews)
  const pendingDeferred = deferred.filter(r => !done.has(r))

  if (REEVALUATION_MODES.has(targetMode)) {
    if (pendingDeferred.length > 0) {
      return {
        allowed: false,
        reason: 'REEVALUATION_REQUIRED',
        pendingReviews: pendingDeferred,
        enforcedControls: REQUIRED_TECHNICAL_CONTROLS,
      }
    }
    return {
      allowed: true,
      reason: 'REEVALUATION_SATISFIED',
      pendingReviews: [],
      enforcedControls: REQUIRED_TECHNICAL_CONTROLS,
    }
  }

  if (targetMode !== 'private_owner_use') {
    return {
      allowed: false,
      reason: 'UNSUPPORTED_TARGET_MODE',
      enforcedControls: REQUIRED_TECHNICAL_CONTROLS,
    }
  }

  if (contract.PRIVATE_PRECOMMERCIAL_OWNER_ONLY !== 'true' || contract.EXTERNAL_USERS_ALLOWED !== 'false' || contract.COMMERCIALIZATION_ALLOWED !== 'false') {
    return {
      allowed: false,
      reason: 'PRIVATE_PRECOMMERCIAL_BOUNDARY_VIOLATION',
      enforcedControls: REQUIRED_TECHNICAL_CONTROLS,
    }
  }

  return {
    allowed: true,
    reason: 'PRIVATE_PRECOMMERCIAL_ALLOWED',
    deferredReviews: pendingDeferred,
    enforcedControls: REQUIRED_TECHNICAL_CONTROLS,
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const md = readFileSync(new URL('../../.anclora/PRODUCTION_RUNTIME.md', import.meta.url), 'utf8')
  console.log(JSON.stringify(evaluatePrecommercialPolicy({ contractMarkdown: md }), null, 2))
}

