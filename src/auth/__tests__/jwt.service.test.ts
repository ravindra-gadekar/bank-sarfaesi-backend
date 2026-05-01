import { jwtService } from '../services/jwt.service';

describe('jwtService — access token claims', () => {
  it('round-trips userKind, officeId, officeType, officeAncestors, bankRootId', () => {
    const token = jwtService.signAccessToken({
      email: 'a@x.com',
      userId: '507f1f77bcf86cd799439011',
      branchId: '507f1f77bcf86cd799439020',
      role: 'admin',
      userKind: 'bank',
      officeId: '507f1f77bcf86cd799439020',
      officeType: 'Branch',
      officeAncestors: ['507f1f77bcf86cd799439001', '507f1f77bcf86cd799439010'],
      bankRootId: '507f1f77bcf86cd799439001',
    });
    const decoded = jwtService.verifyAccessToken(token);
    expect(decoded.userKind).toBe('bank');
    expect(decoded.officeId).toBe('507f1f77bcf86cd799439020');
    expect(decoded.officeType).toBe('Branch');
    expect(decoded.officeAncestors).toEqual([
      '507f1f77bcf86cd799439001',
      '507f1f77bcf86cd799439010',
    ]);
    expect(decoded.bankRootId).toBe('507f1f77bcf86cd799439001');
  });

  it('signs an identity-only token (email only) — claims default to undefined', () => {
    const token = jwtService.signAccessToken({ email: 'identity@x.com' });
    const decoded = jwtService.verifyAccessToken(token);
    expect(decoded.email).toBe('identity@x.com');
    expect(decoded.userKind).toBeUndefined();
    expect(decoded.officeAncestors).toBeUndefined();
  });
});
