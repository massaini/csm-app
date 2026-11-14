import { describe, expect, it } from 'vitest';
import {
  formatarContagem,
  formatarCronometro,
  formatarDataHora,
  formatarDia,
  formatarDiaHora,
  paraCsv,
} from './formato';

describe('formatação', () => {
  it('RNF04-CA4: datas e horas em America/Sao_Paulo, formato brasileiro', () => {
    const d = new Date('2026-11-11T02:30:00Z'); // 23:30 do dia 10 em São Paulo
    expect(formatarDataHora(d)).toBe('10/11/2026 23:30');
    expect(formatarDiaHora(d)).toBe('10/11 23:30');
    expect(formatarDia('2026-11-03')).toBe('03/11/2026');
  });
});

describe('CSV', () => {
  it('RF22-CA3: UTF-8 com BOM, separador ";" e CRLF; zero linhas gera só o cabeçalho', () => {
    const csv = paraCsv(['Senha', 'Motorista'], []);
    expect(csv).toBe('﻿Senha;Motorista\r\n');
    expect(paraCsv(['A', 'B'], [['x', 1]])).toBe('﻿A;B\r\nx;1\r\n');
  });

  it('RF22-CA4: células que começam com = + - @ recebem o prefixo apóstrofo', () => {
    const csv = paraCsv(['c'], [['=SOMA(1;2)'], ['+1'], ['-2'], ['@x'], ['normal']]);
    const linhas = csv.replace('﻿', '').trim().split('\r\n');
    expect(linhas.slice(1)).toEqual([`"'=SOMA(1;2)"`, "'+1", "'-2", "'@x", 'normal']);
  });

  it('RF22-CA3: escapa aspas e separadores dentro do valor', () => {
    const csv = paraCsv(['c'], [['João "Zé"; Silva'], [null]]);
    expect(csv).toBe('﻿c\r\n"João ""Zé""; Silva"\r\n\r\n');
  });
});

describe('contagem e cronômetro das telas', () => {
  it('RF13-CA1: a contagem regressiva arredonda para cima e para em 0:00', () => {
    expect(formatarContagem(5 * 60_000)).toBe('5:00');
    expect(formatarContagem(4 * 60_000 + 59_001)).toBe('5:00');
    expect(formatarContagem(61_000)).toBe('1:01');
    expect(formatarContagem(999)).toBe('0:01');
    expect(formatarContagem(0)).toBe('0:00');
    expect(formatarContagem(-30_000)).toBe('0:00');
  });

  it('RF14-CA1: o cronômetro do carregamento mostra hh:mm:ss e não fica negativo', () => {
    expect(formatarCronometro(0)).toBe('00:00:00');
    expect(formatarCronometro(12 * 60_000 + 34_900)).toBe('00:12:34');
    expect(formatarCronometro(3_600_000 + 5_000)).toBe('01:00:05');
    expect(formatarCronometro(-1_000)).toBe('00:00:00');
  });
});
