import request from 'supertest';
import app from '../../app';

describe('GET /api/banks/registry', () => {
  it('returns a non-empty array of {name, logoKey}', async () => {
    const res = await request(app).get('/api/banks/registry');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('name');
    expect(res.body.data[0]).toHaveProperty('logoKey');
  });

  it('does not require authentication (registry is public)', async () => {
    const res = await request(app).get('/api/banks/registry');
    expect(res.status).toBe(200);
  });
});
