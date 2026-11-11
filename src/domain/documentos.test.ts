import { describe, expect, it } from 'vitest';
import {
  cpfValido,
  formatarCpf,
  formatarPlaca,
  mascararCpf,
  normalizarPlaca,
  placaValida,
} from './documentos';

describe('CPF', () => {
  it('RF01-CA5: aceita CPF com dígitos verificadores corretos, com ou sem máscara', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('52998224725')).toBe(true);
  });

  it('RF01-CA5: rejeita dígito verificador errado, tamanho errado e sequências repetidas', () => {
    expect(cpfValido('529.982.247-24')).toBe(false);
    expect(cpfValido('123')).toBe(false);
    expect(cpfValido('111.111.111-11')).toBe(false);
    expect(cpfValido('')).toBe(false);
  });

  it('formata a máscara aos poucos e mascara para log', () => {
    expect(formatarCpf('52998224725')).toBe('529.982.247-25');
    expect(formatarCpf('5299')).toBe('529.9');
    expect(mascararCpf('529.982.247-25')).toBe('***.***.***-25');
    expect(mascararCpf('abc')).toBe('***');
  });
});

describe('Placa', () => {
  it('RF08-CA1: aceita o formato antigo e o Mercosul, com ou sem hífen, em qualquer caixa', () => {
    for (const p of ['ABC1234', 'abc-1234', 'ABC1D23', 'abc-1d23', ' abc 1d23 ']) {
      expect(placaValida(p), p).toBe(true);
    }
  });

  it('RF08-CA1: rejeita placas inválidas', () => {
    for (const p of ['AB12345', 'ABCD123', 'ABC12D3', '1234ABC', '']) {
      expect(placaValida(p), p).toBe(false);
    }
  });

  it('RF08-CA1: armazena sem hífen em maiúsculas e exibe com hífen após a 3ª letra', () => {
    expect(normalizarPlaca('abc-1d23')).toBe('ABC1D23');
    expect(formatarPlaca('abc1d23')).toBe('ABC-1D23');
    expect(formatarPlaca('ab')).toBe('AB');
  });
});
