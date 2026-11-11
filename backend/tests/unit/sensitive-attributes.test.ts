import { redactSensitive } from '../../src/utils/redact';
import {
  normalizeSensitiveAttributesInput,
  sanitizeLegacyProfileWithoutInference,
  SENSITIVE_PROFILE_COLLECTION_ENABLED,
  sensitiveAttributesSchema,
  SEX_AT_BIRTH_VALUES,
} from '../../src/utils/sensitive-attributes';
import { registerSchema, updateProfileSchema } from '../../src/utils/validators';
import { healthPlanOnboardingSchema } from '../../src/utils/health-plans.validators';

describe('optional sensitive profile attributes (TASK-018)', () => {
  it('keeps runtime collection disabled while TASK-003 legal sign-off is pending', () => {
    expect(SENSITIVE_PROFILE_COLLECTION_ENABLED).toBe(false);
    expect(SEX_AT_BIRTH_VALUES).toEqual(['male', 'female', 'prefer_not_say']);
  });

  it('validates explicit enum choices including prefer_not_say and trims genderIdentity', () => {
    expect(
      normalizeSensitiveAttributesInput({
        sexAtBirth: 'prefer_not_say',
        genderIdentity: '  non-binary  ',
      }),
    ).toEqual({
      sexAtBirth: 'prefer_not_say',
      genderIdentity: 'non-binary',
    });

    expect(
      normalizeSensitiveAttributesInput({
        sexAtBirth: 'female',
        genderIdentity: '   ',
      }),
    ).toEqual({
      sexAtBirth: 'female',
      genderIdentity: null,
    });

    expect(normalizeSensitiveAttributesInput({})).toEqual({
      sexAtBirth: null,
      genderIdentity: null,
    });
  });

  it('rejects unsupported sexAtBirth values and unexpected keys', () => {
    expect(sensitiveAttributesSchema.safeParse({ sexAtBirth: 'intersex' }).success).toBe(false);
    expect(sensitiveAttributesSchema.safeParse({ sex: 'male' }).success).toBe(false);
    expect(
      sensitiveAttributesSchema.safeParse({ genderIdentity: 'x'.repeat(81) }).success,
    ).toBe(false);
  });

  it('never infers sexAtBirth or genderIdentity from legacy profile or across fields', () => {
    expect(sanitizeLegacyProfileWithoutInference({ sex: 'male', age: 54 })).toEqual({
      sexAtBirth: null,
      genderIdentity: null,
    });
    expect(sanitizeLegacyProfileWithoutInference({ sex: 'female', age: 32 })).toEqual({
      sexAtBirth: null,
      genderIdentity: null,
    });
    expect(normalizeSensitiveAttributesInput({ sexAtBirth: 'male' })).toEqual({
      sexAtBirth: 'male',
      genderIdentity: null,
    });
  });

  it('redacts sexAtBirth and genderIdentity in structured logs', () => {
    const redacted = redactSensitive({
      email: 'user@example.com',
      sexAtBirth: 'female',
      genderIdentity: 'woman',
      nested: {
        sex_at_birth: 'prefer_not_say',
        gender_identity: 'non-binary',
      },
    });
    expect(redacted).toEqual({
      email: 'user@example.com',
      sexAtBirth: '[REDACTED]',
      genderIdentity: '[REDACTED]',
      nested: {
        sex_at_birth: '[REDACTED]',
        gender_identity: '[REDACTED]',
      },
    });
  });

  it('does not expose sexAtBirth or genderIdentity in active runtime validation schemas yet', () => {
    expect('sexAtBirth' in registerSchema.shape).toBe(false);
    expect('genderIdentity' in registerSchema.shape).toBe(false);
    expect('sexAtBirth' in updateProfileSchema.shape).toBe(false);
    expect('genderIdentity' in updateProfileSchema.shape).toBe(false);
    expect('sexAtBirth' in healthPlanOnboardingSchema.shape).toBe(false);
    expect('genderIdentity' in healthPlanOnboardingSchema.shape).toBe(false);

    const legacyProfile = updateProfileSchema.safeParse({ sex: 'female', age: 54 });
    expect(legacyProfile.success).toBe(true);
  });
});

