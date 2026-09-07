import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateRegistrationDto } from './dto/create-registration.dto';

describe('CreateRegistrationDto document validation', () => {
  it('accepts a valid formatted CPF', async () => {
    const dto = plainToInstance(CreateRegistrationDto, { document: '529.982.247-25' });

    const errors = await validate(dto);

    expect(errors.find((error) => error.property === 'document')?.constraints?.isCpfCnpj).toBeUndefined();
  });

  it('rejects a CPF with an invalid check digit', async () => {
    const dto = plainToInstance(CreateRegistrationDto, { document: '529.982.247-26' });

    const errors = await validate(dto);

    expect(errors.find((error) => error.property === 'document')?.constraints?.isCpfCnpj).toBeDefined();
  });
});
