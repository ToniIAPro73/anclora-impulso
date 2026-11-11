import request from 'supertest';
import app from '../../src/app';

describe('TASK-007: Express static /dashboard retirement', () => {
  it('does not serve /dashboard publicly (returns 404)', async () => {
    const res = await request(app).get('/dashboard');
    expect(res.status).toBe(404);
  });

  it('does not serve /dashboard/dashboard.html publicly (returns 404)', async () => {
    const res = await request(app).get('/dashboard/dashboard.html');
    expect(res.status).toBe(404);
  });
});

