import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateOrganizationDto } from './create-organization.dto';

describe('CreateOrganizationDto', () => {
  const valid = {
    name: 'Oficina Central', phone: '81999999999', admin: { name: 'Ana', email: 'ana@example.com' },
    firstDueDate: '2026-10-10', billingDay: 10,
  };

  it('accepts the required registration data and the default Contracted Price', async () => {
    await expect(validate(plainToInstance(CreateOrganizationDto, valid))).resolves.toHaveLength(0);
  });

  it.each([
    ['name'], ['phone'], ['admin'], ['firstDueDate'], ['billingDay'],
  ])('requires %s', async (field) => {
    const input = { ...valid } as Record<string, unknown>;
    delete input[field];
    expect(await validate(plainToInstance(CreateOrganizationDto, input))).not.toHaveLength(0);
  });

  it.each([0, 29, 1.5])('rejects billing day %s', async (billingDay) => {
    expect(await validate(plainToInstance(CreateOrganizationDto, { ...valid, billingDay }))).not.toHaveLength(0);
  });

  it.each(['79', '79.9', '-1.00', 'free'])('rejects malformed Contracted Price %s', async (contractedPrice) => {
    expect(await validate(plainToInstance(CreateOrganizationDto, { ...valid, contractedPrice }))).not.toHaveLength(0);
  });

  it('rejects legacy provisioning controls from the public registration contract', async () => {
    const instance = plainToInstance(CreateOrganizationDto, { ...valid, planVersionId: 'plan', commercialAccountId: 'account', trialEnabled: true });
    const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(['planVersionId', 'commercialAccountId', 'trialEnabled']));
  });
});
