import fs from 'fs';
import path from 'path';
import {
  AGE_BANDS,
  classifySafety,
  getAdaptation,
  getEligibleModalitiesForAge,
  getPhaseForWeek,
  HEALTH_PLAN_MODALITY_BANDS,
  isInCohort,
  normalizeVariantPreference,
  resolveAgeBand,
  suggestModalitiesForProfile,
  validateAgeBands,
  validateNonOverlappingBands,
} from '../../src/services/health-plans.domain';

describe('health plan domain rules', () => {
  it.each([
    [17, false],
    [18, false],
    [49, false],
    [50, true],
    [59, true],
    [60, true],
    [61, false],
  ])('handles Ruta Vital cohort boundary %s', (age, expected) => {
    expect(isInCohort(age)).toBe(expected);
  });

  it('rejects unknown age (null or undefined) for cohort eligibility (TASK-008)', () => {
    expect(isInCohort(null)).toBe(false);
    expect(isInCohort(undefined)).toBe(false);
    expect(isInCohort(null, 50, 60)).toBe(false);
  });

  describe('10-modality age/sex bands (TASK-020)', () => {
    it('validates that all 10 modality bands have integer boundaries >= 18 and zero overlap per variant', () => {
      expect(HEALTH_PLAN_MODALITY_BANDS).toHaveLength(10);
      expect(validateNonOverlappingBands()).toEqual({ valid: true, errors: [] });
    });

    it('detects overlapping or invalid bands when given malformed definitions', () => {
      const overlapping = [
        ...HEALTH_PLAN_MODALITY_BANDS.slice(0, 2),
        { code: 'P03' as const, variant: 'M' as const, ageMin: 29, ageMax: 39, nameEs: 'Solape', nameEn: 'Overlap' },
      ];
      const result = validateNonOverlappingBands(overlapping);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Overlap detected between P01 and P03');
    });

    it.each([
      [null, []],
      [undefined, []],
      [14, []],
      [17, []],
      [18, ['P01', 'P02']],
      [29, ['P01', 'P02']],
      [30, ['P03', 'P04']],
      [39, ['P03', 'P04']],
      [40, ['P05', 'P06']],
      [49, ['P05', 'P06']],
      [50, ['P07', 'P08']],
      [59, ['P07', 'P08']],
      [60, ['P09', 'P10']],
      [61, ['P09', 'P10']],
      [75, ['P09', 'P10']],
    ])('resolves boundary age %s to modalities %j', (age, expectedCodes) => {
      expect(getEligibleModalitiesForAge(age).map((m) => m.code)).toEqual(expectedCodes);
    });

    it('validates AGE_BANDS A1-A5 cleanly without gaps or overlaps', () => {
      expect(AGE_BANDS.map((band) => band.code)).toEqual(['A1', 'A2', 'A3', 'A4', 'A5']);
      expect(validateAgeBands()).toEqual({ valid: true, errors: [] });
      expect(
        validateAgeBands([
          ...AGE_BANDS.slice(0, 2),
          { code: 'A3', ageMin: 39, ageMax: 49, labelEs: 'Solape', labelEn: 'Overlap' },
        ]).valid,
      ).toBe(false);
    });

    it.each([
      [17, null],
      [18, 'A1'],
      [29, 'A1'],
      [30, 'A2'],
      [39, 'A2'],
      [40, 'A3'],
      [49, 'A3'],
      [50, 'A4'],
      [59, 'A4'],
      [60, 'A5'],
      [61, 'A5'],
      [null, null],
      [Number.NaN, null],
      [29.5, null],
      [-5, null],
    ])('resolves age band for boundary/invalid input %s -> %s', (age, expectedBand) => {
      expect(resolveAgeBand(age)?.code ?? null).toBe(expectedBand);
    });

    it('filters by variant when requested and keeps neutral options when unconfirmed', () => {
      expect(getEligibleModalitiesForAge(52, 'M').map((m) => m.code)).toEqual(['P07']);
      expect(getEligibleModalitiesForAge(52, 'F').map((m) => m.code)).toEqual(['P08']);
      expect(normalizeVariantPreference('male')).toBe('M');
      expect(normalizeVariantPreference('female')).toBe('F');
      expect(normalizeVariantPreference('prefer_not_say')).toBeNull();
      expect(normalizeVariantPreference('NEUTRAL')).toBeNull();
      expect(normalizeVariantPreference(undefined)).toBeNull();
    });

    it('suggests modalities without auto-enrolling and without inferring sex', () => {
      const neutral = suggestModalitiesForProfile({ age: 40 });
      expect(neutral.eligible).toBe(true);
      expect(neutral.reason).toBe('ELIGIBLE');
      expect(neutral.ageBand?.code).toBe('A3');
      expect(neutral.suggestionMode).toBe('NEUTRAL_OPTIONS');
      expect(neutral.autoEnroll).toBe(false);
      expect(neutral.suggestedModalities.map((m) => m.code)).toEqual(['P05', 'P06']);

      const preferNotSay = suggestModalitiesForProfile({ age: 61, variantPreference: 'prefer_not_say' });
      expect(preferNotSay.suggestionMode).toBe('NEUTRAL_OPTIONS');
      expect(preferNotSay.autoEnroll).toBe(false);
      expect(preferNotSay.suggestedModalities.map((m) => m.code)).toEqual(['P09', 'P10']);

      const explicit = suggestModalitiesForProfile({ age: 30, variantPreference: 'F' });
      expect(explicit.suggestionMode).toBe('EXPLICIT_VARIANT');
      expect(explicit.autoEnroll).toBe(false);
      expect(explicit.suggestedModalities.map((m) => m.code)).toEqual(['P04']);
    });

    it('rejects minors, null age, and invalid ages deterministically', () => {
      expect(suggestModalitiesForProfile({ age: 17 })).toMatchObject({
        eligible: false,
        reason: 'UNDER_18',
        ageBand: null,
        suggestionMode: 'NONE',
        autoEnroll: false,
        suggestedModalities: [],
      });
      expect(suggestModalitiesForProfile({ age: null })).toMatchObject({
        eligible: false,
        reason: 'AGE_REQUIRED',
        ageBand: null,
        autoEnroll: false,
        suggestedModalities: [],
      });
      expect(suggestModalitiesForProfile({ age: 40.5 })).toMatchObject({
        eligible: false,
        reason: 'INVALID_AGE',
        ageBand: null,
        autoEnroll: false,
        suggestedModalities: [],
      });
      expect(suggestModalitiesForProfile({ age: Number.NaN })).toMatchObject({
        eligible: false,
        reason: 'INVALID_AGE',
        ageBand: null,
        autoEnroll: false,
        suggestedModalities: [],
      });
    });

    it('enforces architectural boundary: core engines do not import health-plans.* and domain stays pure', () => {
      const filesToCheck = [
        path.resolve(__dirname, '../../src/services/workouts.service.ts'),
        path.resolve(__dirname, '../../src/services/nutrition.service.ts'),
        path.resolve(__dirname, '../../src/services/gamification.service.ts'),
        path.resolve(__dirname, '../../src/services/progression/progression.service.ts'),
      ];
      for (const file of filesToCheck) {
        const content = fs.readFileSync(file, 'utf8');
        expect(content).not.toMatch(/health-plans\.(domain|service)/);
      }
      const domainContent = fs.readFileSync(
        path.resolve(__dirname, '../../src/services/health-plans.domain.ts'),
        'utf8',
      );
      expect(domainContent).not.toMatch(/from\s+['"].*(prisma|workouts|nutrition|gamification|progression)/);
    });
  });

  it('fails closed when a professional review signal is present', () => {
    expect(classifySafety(['recent_injury', 'unrelated_note'])).toEqual({
      category: 'PROFESSIONAL_REVIEW_RECOMMENDED',
      reasonCodes: ['recent_injury'],
    });
  });

  it('keeps ordinary onboarding self-managed', () => {
    expect(classifySafety([]).category).toBe('SELF_MANAGED');
  });

  it('reduces after interruption or poor recovery', () => {
    expect(getAdaptation({ missedWeek: true })).toBe('REDUCE');
    expect(getAdaptation({ poorRecovery: true })).toBe('REDUCE');
    expect(getAdaptation({ completedEarly: true })).toBe('PROGRESS');
  });

  it('maps weeks to the approved phase model', () => {
    expect(getPhaseForWeek(1).key).toBe('FOUNDATION');
    expect(getPhaseForWeek(5).key).toBe('CAPACITY_BUILDING');
    expect(getPhaseForWeek(13).key).toBe('CONSOLIDATION');
    expect(getPhaseForWeek(25).key).toBe('MAINTENANCE');
  });
});
