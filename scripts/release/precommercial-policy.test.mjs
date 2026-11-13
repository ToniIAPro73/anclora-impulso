import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { evaluatePrecommercialPolicy } from './precommercial-policy.mjs'

const contractPath = new URL('../../.anclora/PRODUCTION_RUNTIME.md', import.meta.url)
const contractMarkdown = readFileSync(contractPath, 'utf8')

test('PRIVATE_PRECOMMERCIAL permite uso privado del propietario sin las dos revisiones diferidas', () => {
  const res = evaluatePrecommercialPolicy({
    contractMarkdown,
    targetMode: 'private_owner_use',
    technicalGatesOk: true,
    completedReviews: [],
  })
  assert.equal(res.allowed, true)
  assert.equal(res.reason, 'PRIVATE_PRECOMMERCIAL_ALLOWED')
  assert.deepEqual(res.deferredReviews, [
    'EXTERNAL_LEGAL_REVIEW',
    'MEDICAL_NUTRITIONAL_PROFESSIONAL_REVIEW',
  ])
})

test('transición a comercialización exige reevaluación de revisiones diferidas', () => {
  const blocked = evaluatePrecommercialPolicy({
    contractMarkdown,
    targetMode: 'commercialization',
    technicalGatesOk: true,
    completedReviews: [],
  })
  assert.equal(blocked.allowed, false)
  assert.equal(blocked.reason, 'REEVALUATION_REQUIRED')
  assert.deepEqual(blocked.pendingReviews, [
    'EXTERNAL_LEGAL_REVIEW',
    'MEDICAL_NUTRITIONAL_PROFESSIONAL_REVIEW',
  ])

  const unblocked = evaluatePrecommercialPolicy({
    contractMarkdown,
    targetMode: 'commercialization',
    technicalGatesOk: true,
    completedReviews: [
      'EXTERNAL_LEGAL_REVIEW',
      'MEDICAL_NUTRITIONAL_PROFESSIONAL_REVIEW',
    ],
  })
  assert.equal(unblocked.allowed, true)
  assert.equal(unblocked.reason, 'REEVALUATION_SATISFIED')
})

test('apertura a usuarios externos o distribución personalizada no puede usar excepción privada', () => {
  for (const mode of ['external_users', 'personalized_plan_distribution']) {
    const res = evaluatePrecommercialPolicy({
      contractMarkdown,
      targetMode: mode,
      technicalGatesOk: true,
      completedReviews: [],
    })
    assert.equal(res.allowed, false)
    assert.equal(res.reason, 'REEVALUATION_REQUIRED')
  }
})

test('no se eluden gates técnicos de seguridad ni afirmaciones clínicas certificadas', () => {
  const techFail = evaluatePrecommercialPolicy({
    contractMarkdown,
    targetMode: 'private_owner_use',
    technicalGatesOk: false,
  })
  assert.equal(techFail.allowed, false)
  assert.equal(techFail.reason, 'TECHNICAL_GATE_FAILED')

  const claimFail = evaluatePrecommercialPolicy({
    contractMarkdown,
    targetMode: 'private_owner_use',
    technicalGatesOk: true,
    clinicalCertificationClaim: true,
  })
  assert.equal(claimFail.allowed, false)
  assert.equal(claimFail.reason, 'CLINICAL_CERTIFICATION_CLAIM_FORBIDDEN')
})

test('no permite bypass genérico fuera de anclora-impulso', () => {
  const otherRepoContract = contractMarkdown.replace(
    'PRIVATE_PRECOMMERCIAL_SCOPE=anclora-impulso',
    'PRIVATE_PRECOMMERCIAL_SCOPE=anclora-other',
  )
  const res = evaluatePrecommercialPolicy({
    contractMarkdown: otherRepoContract,
    targetMode: 'private_owner_use',
    technicalGatesOk: true,
  })
  assert.equal(res.allowed, false)
  assert.equal(res.reason, 'INVALID_SCOPE_NON_IMPULSO')
})

