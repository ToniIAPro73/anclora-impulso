/**
 * Health: la comprobación de BD es opt-in (?deep=1) para permitir el scale-to-zero de Neon.
 * No usa base de datos real: PrismaClient está mockeado y falla si se consulta.
 */
const mockQueryRaw = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({ $queryRaw: mockQueryRaw })),
}));

jest.mock('../../src/config/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

import { getHealthStatus, getSimpleHealthStatus } from '../../src/services/health.service';

describe('health service: optional database check', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('light mode never queries the database (detailed)', async () => {
    mockQueryRaw.mockRejectedValue(new Error('must not be called'));

    const status = await getHealthStatus();

    expect(mockQueryRaw).not.toHaveBeenCalled();
    expect(status.checks.database).toEqual({ status: 'pass', message: 'skipped' });
  });

  it('light mode never queries the database (simple)', async () => {
    mockQueryRaw.mockRejectedValue(new Error('must not be called'));

    await expect(getSimpleHealthStatus()).resolves.toEqual({ status: 'ok' });
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('deep mode queries the database and reports healthy', async () => {
    mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const status = await getHealthStatus(true);
    await expect(getSimpleHealthStatus(true)).resolves.toEqual({ status: 'ok' });

    expect(mockQueryRaw).toHaveBeenCalledTimes(2);
    expect(status.checks.database.status).toBe('pass');
  });

  it('deep mode reports unhealthy / error when the database fails', async () => {
    mockQueryRaw.mockRejectedValue(new Error('db down'));

    const status = await getHealthStatus(true);

    expect(status.checks.database.status).toBe('fail');
    expect(status.status).toBe('unhealthy');
    await expect(getSimpleHealthStatus(true)).resolves.toEqual({ status: 'error' });
  });
});
