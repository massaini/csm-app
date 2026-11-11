import { describe, expect, it } from 'vitest';
import { codigoSenha, limitesDoDia, quinzenaDoDia, ultimosDias } from './dia';

const iso = (d: Date) => d.toISOString();

describe('dia operacional (America/Sao_Paulo)', () => {
  it('Dia operacional: 23:30 em São Paulo ainda é o dia local, não o dia UTC seguinte', () => {
    const l = limitesDoDia(new Date('2026-11-11T02:30:00Z'));
    expect(l.dia).toBe('2026-11-10');
    expect(iso(l.inicio)).toBe('2026-11-10T03:00:00.000Z');
    expect(iso(l.fim)).toBe('2026-11-11T03:00:00.000Z');
  });

  it('Dia operacional: a virada às 00:00 local começa o dia seguinte (limite exclusivo no fim)', () => {
    expect(limitesDoDia(new Date('2026-11-11T02:59:59Z')).dia).toBe('2026-11-10');
    expect(limitesDoDia(new Date('2026-11-11T03:00:00Z')).dia).toBe('2026-11-11');
  });

  it('Dia operacional: respeita HORA_VIRADA diferente de 00:00', () => {
    const antes = limitesDoDia(new Date('2026-11-11T05:00:00Z'), '04:00');
    expect(antes.dia).toBe('2026-11-10');
    expect(iso(antes.inicio)).toBe('2026-11-10T07:00:00.000Z');
    expect(limitesDoDia(new Date('2026-11-11T07:00:00Z'), '04:00').dia).toBe('2026-11-11');
  });

  it('Dia operacional: rejeita HORA_VIRADA inválida', () => {
    expect(() => limitesDoDia(new Date(), '25:00')).toThrow(/HORA_VIRADA/);
    expect(() => limitesDoDia(new Date(), 'meia-noite')).toThrow(/HORA_VIRADA/);
  });

  it('Dia operacional: funciona na virada de mês e de ano', () => {
    expect(limitesDoDia(new Date('2027-01-01T01:00:00Z')).dia).toBe('2026-12-31');
    expect(limitesDoDia(new Date('2026-03-01T02:00:00Z')).dia).toBe('2026-02-28');
  });
});

describe('quinzena e períodos', () => {
  it('RF21-CA3: dias 1–15 e 16–último do mês', () => {
    expect(quinzenaDoDia('2026-10-12')).toEqual({ diaInicio: '2026-10-01', diaFim: '2026-10-15' });
    expect(quinzenaDoDia('2026-10-16')).toEqual({ diaInicio: '2026-10-16', diaFim: '2026-10-31' });
    expect(quinzenaDoDia('2026-02-20')).toEqual({ diaInicio: '2026-02-16', diaFim: '2026-02-28' });
    expect(quinzenaDoDia('2028-02-20').diaFim).toBe('2028-02-29');
  });

  it('RF20-CA3: últimos 7 dias incluem hoje nos dois extremos', () => {
    expect(ultimosDias('2026-10-12', 7)).toEqual({ diaInicio: '2026-10-06', diaFim: '2026-10-12' });
    expect(ultimosDias('2026-03-03', 7)).toEqual({ diaInicio: '2026-02-25', diaFim: '2026-03-03' });
  });
});

describe('código da senha', () => {
  it('Código: prefixo do galpão + sequência com 3 dígitos', () => {
    expect(codigoSenha('A', 1)).toBe('A-001');
    expect(codigoSenha('E', 42)).toBe('E-042');
    expect(codigoSenha('B', 1000)).toBe('B-1000');
  });
});
