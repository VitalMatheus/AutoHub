import { describe, expect, it } from 'vitest';
import { formatCpfCnpj, formatPhone } from './input-masks';

describe('máscaras de campos', () => {
  it('aplica a máscara de CPF progressivamente', () => {
    expect(formatCpfCnpj('529')).toBe('529');
    expect(formatCpfCnpj('52998224725')).toBe('529.982.247-25');
  });

  it('aplica a máscara de CNPJ progressivamente', () => {
    expect(formatCpfCnpj('123456789012')).toBe('12.345.678/9012');
    expect(formatCpfCnpj('12345678000195')).toBe('12.345.678/0001-95');
  });

  it('remove pontuação e limita CPF ou CNPJ ao tamanho máximo', () => {
    expect(formatCpfCnpj('529.982.247-25')).toBe('529.982.247-25');
    expect(formatCpfCnpj('12.345.678/0001-950000')).toBe('12.345.678/0001-95');
  });

  it('formata telefone fixo com dez dígitos', () => {
    expect(formatPhone('8133334444')).toBe('(81) 3333-4444');
  });

  it('formata telefone celular com onze dígitos', () => {
    expect(formatPhone('81999999999')).toBe('(81) 99999-9999');
  });

  it('remove pontuação do telefone e limita ao máximo de onze dígitos', () => {
    expect(formatPhone('(81) 3333-4444')).toBe('(81) 3333-4444');
    expect(formatPhone('(81) 99999-999900')).toBe('(81) 99999-9999');
  });
});
