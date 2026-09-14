import { classifySafety, getAdaptation, getPhaseForWeek, isInCohort } from './health-plans.domain';

describe('health plan domain rules', () => {
  it.each([[49, false], [50, true], [59, true], [60, true], [61, false]])('handles cohort boundary %s', (age, expected) => {
    expect(isInCohort(age)).toBe(expected);
  });

  it('allows unknown age for explicit opt-in onboarding', () => {
    expect(isInCohort(null)).toBe(true);
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
