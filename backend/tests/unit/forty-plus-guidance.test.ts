import {
  buildNutritionPersonalizationGuidance,
  buildWorkoutPersonalizationGuidance,
  getNutritionGuidanceEntries,
  getWorkoutGuidanceEntries,
  NUTRITION_GUIDANCE_REGISTRY,
  WORKOUT_GUIDANCE_REGISTRY,
  type GuidanceEntry,
} from '../../src/services/forty-plus-guidance';

const BANNED_UNVERIFIED_CLINICAL_TERMS = [
  /menopausia/i,
  /perimenopausia/i,
  /salud\s+osea/i,
  /sensibilidad\s+a\s+la\s+insulina/i,
  /grasa\s+abdominal\/visceral/i,
  /grasa\s+visceral/i,
  /transicion\s+hormonal/i,
  /hormonal/i,
  /omega-3/i,
  /calcio\s+dietetico/i,
  /1,3-1,6\s*g\/kg/i,
];

function assertValidProvenance(entries: readonly GuidanceEntry[]) {
  expect(entries.length).toBeGreaterThan(0);
  const now = Date.now();
  const maxAgeMs = 365 * 24 * 60 * 60 * 1000;

  for (const entry of entries) {
    expect(entry.id.trim().length).toBeGreaterThan(0);
    expect(entry.text.trim().length).toBeGreaterThan(0);
    expect(entry.sourceTitle.trim().length).toBeGreaterThan(0);
    expect(['WHO_GLOBAL_GUIDELINE', 'GENERIC_FITNESS_GUIDANCE']).toContain(entry.evidenceLevel);

    const parsedDate = Date.parse(entry.reviewedAt);
    expect(Number.isNaN(parsedDate)).toBe(false);
    expect(now - parsedDate).toBeLessThan(maxAgeMs);

    if (entry.evidenceLevel === 'WHO_GLOBAL_GUIDELINE') {
      expect(entry.sourceUrl).toMatch(/^https:\/\/www\.who\.int\//);
    }

    for (const pattern of BANNED_UNVERIFIED_CLINICAL_TERMS) {
      expect(entry.text).not.toMatch(pattern);
    }
  }
}

describe('TASK-009: forty-plus & sex guidance provenance', () => {
  it('requires provenance metadata and non-expired reviewDate on every registered workout claim', () => {
    assertValidProvenance(WORKOUT_GUIDANCE_REGISTRY);
  });

  it('requires provenance metadata and non-expired reviewDate on every registered nutrition claim', () => {
    assertValidProvenance(NUTRITION_GUIDANCE_REGISTRY);
  });

  it('returns empty guidance below age 40 or when age is missing', () => {
    expect(buildWorkoutPersonalizationGuidance(39, 'female')).toBe('');
    expect(buildWorkoutPersonalizationGuidance(null, 'male')).toBe('');
    expect(buildNutritionPersonalizationGuidance({ age: 35, sex: 'female' })).toBe('');
    expect(buildNutritionPersonalizationGuidance({ age: undefined, sex: null })).toBe('');
  });

  it.each(['female', 'male', null] as const)(
    'returns attributed workout and nutrition entries for age 40+ (%s)',
    (sex) => {
      const workoutEntries = getWorkoutGuidanceEntries(45, sex);
      const nutritionEntries = getNutritionGuidanceEntries({
        age: 45,
        sex,
        weightKg: 75,
        targetWeightKg: 70,
        trainingDaysPerWeek: 4,
      });

      assertValidProvenance(workoutEntries);
      assertValidProvenance(nutritionEntries);

      const workoutText = buildWorkoutPersonalizationGuidance(45, sex);
      const nutritionText = buildNutritionPersonalizationGuidance({
        age: 45,
        sex,
        weightKg: 75,
        targetWeightKg: 70,
        trainingDaysPerWeek: 4,
      });
      expect(workoutText.length).toBeGreaterThan(0);
      expect(nutritionText.length).toBeGreaterThan(0);
    },
  );
});

