const mockFindUnique = jest.fn();
const mockDefinitionFindUnique = jest.fn();
const mockUpsert = jest.fn();

jest.mock('../../src/config/database', () => ({
  prisma: {
    user: { findUnique: mockFindUnique },
    healthPlanDefinition: { findUnique: mockDefinitionFindUnique },
    healthPlanEnrollment: { upsert: mockUpsert },
  },
}));

import { enroll } from '../../src/services/health-plans.service';

describe('TASK-008: health-plans.service.enroll age eligibility guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDefinitionFindUnique.mockResolvedValue({
      id: 'plan-ruta-vital',
      key: 'ruta-vital-50-60',
      status: 'published',
      minAge: 50,
      maxAge: 60,
    });
  });

  it.each([null, undefined, 17, 49, 61, 55.5])(
    'rejects ineligible user age (%p) with 422',
    async (age) => {
      mockFindUnique.mockResolvedValue({ age });
      await expect(enroll('user-1')).rejects.toMatchObject({ statusCode: 422 });
      expect(mockUpsert).not.toHaveBeenCalled();
    },
  );

  it('rejects when user does not exist', async () => {
    mockFindUnique.mockResolvedValue(null);
    await expect(enroll('missing-user')).rejects.toMatchObject({ statusCode: 422 });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it.each([50, 55, 60])('allows eligible user age %i inside 50-60 cohort', async (age) => {
    mockFindUnique.mockResolvedValue({ age });
    mockUpsert.mockResolvedValue({ id: 'enr-1', status: 'active' });
    const res = await enroll('user-1');
    expect(res).toEqual({ id: 'enr-1', status: 'active' });
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });
});
