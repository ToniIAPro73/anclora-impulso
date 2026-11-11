import fs from 'fs';
import path from 'path';
import {
  classifySafety,
  getAdaptation,
  getEligibleModalitiesForAge,
  getPhaseForWeek,
  HEALTH_PLAN_MODALITY_BANDS,
  isInCohort,
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
      [75, ['P09', 'P10']],
    ])('resolves boundary age %s to modalities %j', (age, expectedCodes) => {
      expect(getEligibleModalitiesForAge(age).map((m) => m.code)).toEqual(expectedCodes);
    });

    it('filters by variant when requested', () => {
      expect(getEligibleModalitiesForAge(52, 'M').map((m) => m.code)).toEqual(['P07']);
      expect(getEligibleModalitiesForAge(52, 'F').map((m) => m.code)).toEqual(['P08']);
    });

    it('enforces architectural boundary: core engines do not import health-plans.*', () => {
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
