import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

export function normalizeCpfCnpj(value: string): string { return value.replace(/\D/g, ''); }

function isValidCpfOrCnpj(value: string): boolean {
  if (!/^\d{11}$|^\d{14}$/.test(value) || /^([0-9])\1+$/.test(value)) return false;
  const check = (length: number, initialFactor: number) => {
    let sum = 0;
    for (let i = 0; i < length; i += 1) sum += Number(value[i]) * (initialFactor - i);
    const remainder = sum % 11;
    return Number(value[length]) === (remainder < 2 ? 0 : 11 - remainder);
  };
  if (value.length === 11) return check(9, 10) && check(10, 11);
  const cnpjCheck = (length: number) => {
    const factors = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const remainder = factors.reduce((sum, factor, index) => sum + Number(value[index]) * factor, 0) % 11;
    return Number(value[length]) === (remainder < 2 ? 0 : 11 - remainder);
  };
  return cnpjCheck(12) && cnpjCheck(13);
}

export function IsCpfCnpj(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => registerDecorator({ name: 'isCpfCnpj', target: object.constructor, propertyName, options: validationOptions, validator: { validate(value: unknown) { return typeof value === 'string' && isValidCpfOrCnpj(normalizeCpfCnpj(value)); }, defaultMessage(args: ValidationArguments) { return `${args.property} must be a valid CPF or CNPJ`; } } });
}
