import { describe, expect, it } from 'vitest';
import {
  cpfValido,
  formatarCpf,
  formatarPlaca,
  formatarTelefone,
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

describe('Telefone', () => {
  it('RF24-CA1: formata celular (11 dígitos) e fixo (10 dígitos) com DDD', () => {
    expect(formatarTelefone('11987654321')).toBe('(11) 98765-4321');
    expect(formatarTelefone('1134567890')).toBe('(11) 3456-7890');
    expect(formatarTelefone('(11) 98765-4321')).toBe('(11) 98765-4321');
  });

  it('RF24-CA1: a máscara é progressiva enquanto se digita e ignora o excesso', () => {
    expect(formatarTelefone('')).toBe('');
    expect(formatarTelefone('1')).toBe('(1');
    expect(formatarTelefone('11')).toBe('(11');
    expect(formatarTelefone('119')).toBe('(11) 9');
    expect(formatarTelefone('119876')).toBe('(11) 9876');
    expect(formatarTelefone('1198765')).toBe('(11) 9876-5');
    expect(formatarTelefone('119876543210000')).toBe('(11) 98765-4321');
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
