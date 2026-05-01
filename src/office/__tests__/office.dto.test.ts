import { CreateOfficeSchema, OfficeTypeSchema } from '../dto/office.dto';

describe('Office DTO', () => {
  it('accepts a valid HO payload', () => {
    const result = CreateOfficeSchema.safeParse({
      bankName: 'Test Bank',
      officeType: 'HO',
      address: '1 Main St',
      contact: '+91 22 0000 0000',
      email: 'ho@bank.example',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-HO payload that omits parentOfficeId', () => {
    const result = CreateOfficeSchema.safeParse({
      bankName: 'Test Bank',
      officeType: 'Branch',
      address: '1 Main St',
      contact: '+91 22 0000 0000',
      email: 'br@bank.example',
    });
    expect(result.success).toBe(false);
  });

  it('OfficeTypeSchema enumerates 4 values', () => {
    expect(OfficeTypeSchema.safeParse('HO').success).toBe(true);
    expect(OfficeTypeSchema.safeParse('Zonal').success).toBe(true);
    expect(OfficeTypeSchema.safeParse('Regional').success).toBe(true);
    expect(OfficeTypeSchema.safeParse('Branch').success).toBe(true);
    expect(OfficeTypeSchema.safeParse('OTHER').success).toBe(false);
  });
});
