import request from 'supertest';
import app from '../../app';

describe('Self-signup endpoints are removed', () => {
  it('POST /api/onboarding/branch returns 404', async () => {
    const res = await request(app)
      .post('/api/onboarding/branch')
      .send({
        bankName: 'X',
        branchName: 'X',
        branchCode: 'X',
        ifscCode: 'X',
        branchAddress: 'X',
        city: 'X',
        district: 'X',
        state: 'X',
        pinCode: '1',
        email: 'x@y.com',
      });
    expect(res.status).toBe(404);
  });

  it('POST /api/onboarding/letterhead returns 404', async () => {
    const res = await request(app).post('/api/onboarding/letterhead').send({});
    expect(res.status).toBe(404);
  });
});
