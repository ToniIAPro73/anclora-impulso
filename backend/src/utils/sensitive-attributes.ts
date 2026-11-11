import { z } from 'zod';

/**
 * Isolated optional sensitive identity attributes for TASK-018.
 * Collection remains strictly INACTIVE until TASK-003 legal/privacy sign-off
 * (special-category data consent, DPIA/legal basis, retention, and UI opt-in).
 */
export const SENSITIVE_PROFILE_COLLECTION_ENABLED = false as const;

export const SEX_AT_BIRTH_VALUES = ['male', 'female', 'prefer_not_say'] as const;
export type SexAtBirth = (typeof SEX_AT_BIRTH_VALUES)[number];

export type GenderIdentity = string;

export interface OptionalSensitiveProfileAttributes {
  sexAtBirth: SexAtBirth | null;
  genderIdentity: GenderIdentity | null;
}

export const sexAtBirthSchema = z.enum(SEX_AT_BIRTH_VALUES);

const emptyStringToNull = (value: unknown) => {
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
};

export const genderIdentitySchema = z.preprocess(
  emptyStringToNull,
  z.string().trim().min(1).max(80).nullable(),
);

export const sensitiveAttributesSchema = z
  .object({
    sexAtBirth: sexAtBirthSchema.nullable().optional(),
    genderIdentity: genderIdentitySchema.optional(),
  })
  .strict();

export type SensitiveAttributesInput = z.infer<typeof sensitiveAttributesSchema>;

export function normalizeSensitiveAttributesInput(input: unknown): OptionalSensitiveProfileAttributes {
  const parsed = sensitiveAttributesSchema.parse(input);
  return {
    sexAtBirth: parsed.sexAtBirth ?? null,
    genderIdentity: parsed.genderIdentity ?? null,
  };
}

/**
 * Guarantees legacy `User.sex` and `User.age` never trigger automatic inference
 * into special-category fields when preparing additive records.
 */
export function sanitizeLegacyProfileWithoutInference(_legacyProfile: {
  sex?: string | null;
  age?: number | null;
}): OptionalSensitiveProfileAttributes {
  return {
    sexAtBirth: null,
    genderIdentity: null,
  };
}

