import express from 'express';
import request from 'supertest';
import { requireUserKind, requireSubtreeScope } from '../rbac.middleware';

function makeApp(middleware: express.RequestHandler[], context: any) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.context = context;
    next();
  });
  app.post('/check', ...middleware, (_req, res) => {
    res.json({ ok: true });
  });
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.statusCode ?? 500).json({ error: err.message });
  });
  return app;
}

describe('requireUserKind', () => {
  it('passes when context.userKind matches', async () => {
    const app = makeApp([requireUserKind('app')], { userKind: 'app' });
    const res = await request(app).post('/check');
    expect(res.status).toBe(200);
  });

  it('rejects 403 on mismatch', async () => {
    const app = makeApp([requireUserKind('app')], { userKind: 'bank' });
    const res = await request(app).post('/check');
    expect(res.status).toBe(403);
  });
});

describe('requireSubtreeScope', () => {
  it('passes when target equals user officeId', async () => {
    const app = makeApp([requireSubtreeScope('targetOfficeId')], {
      userKind: 'bank',
      officeId: 'office-A',
      officeAncestors: [],
    });
    const res = await request(app).post('/check').send({ targetOfficeId: 'office-A' });
    expect(res.status).toBe(200);
  });

  it('passes when user is in target ancestors (user can act on descendants)', async () => {
    const app = makeApp(
      [requireSubtreeScope('targetOfficeId', { ancestorsResolver: () => Promise.resolve(['office-A']) })],
      { userKind: 'bank', officeId: 'office-A', officeAncestors: [] },
    );
    const res = await request(app).post('/check').send({ targetOfficeId: 'office-X' });
    expect(res.status).toBe(200);
  });

  it('rejects 403 when target is outside subtree', async () => {
    const app = makeApp(
      [requireSubtreeScope('targetOfficeId', { ancestorsResolver: () => Promise.resolve(['office-Z']) })],
      { userKind: 'bank', officeId: 'office-A', officeAncestors: [] },
    );
    const res = await request(app).post('/check').send({ targetOfficeId: 'office-X' });
    expect(res.status).toBe(403);
  });

  it('app users bypass subtree scope check', async () => {
    const app = makeApp(
      [requireSubtreeScope('targetOfficeId', { ancestorsResolver: () => Promise.resolve(['office-Z']) })],
      { userKind: 'app', appRole: 'admin' },
    );
    const res = await request(app).post('/check').send({ targetOfficeId: 'office-X' });
    expect(res.status).toBe(200);
  });
});
