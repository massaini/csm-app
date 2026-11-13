import { FUSO } from './dia';

const dataHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** "dd/mm/aaaa hh:mm" no fuso de São Paulo (RF22-CA3, RNF04-CA4). */
export function formatarDataHora(d: Date): string {
  return dataHora.format(d).replace(',', '');
}

/** "dd/mm hh:mm", usado nas tabelas do painel. */
export function formatarDiaHora(d: Date): string {
  const [data, hora] = formatarDataHora(d).split(' ');
  return `${data.slice(0, 5)} ${hora}`;
}

/** "AAAA-MM-DD" → "dd/mm/aaaa". */
export function formatarDia(dia: string): string {
  const [a, m, d] = dia.split('-');
  return `${d}/${m}/${a}`;
}

/** Célula de CSV segura: neutraliza fórmulas (RF22-CA4) e escapa aspas e separadores. */
function celula(valor: string | number | null | undefined): string {
  let v = valor === null || valor === undefined ? '' : String(valor);
  if (/^[=+\-@]/.test(v)) v = `'${v}`;
  return /[";\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** CSV para o Excel em pt-BR: UTF-8 com BOM, separador ";", CRLF (RF22-CA3). */
export function paraCsv(cabecalho: string[], linhas: (string | number | null)[][]): string {
  const corpo = [cabecalho, ...linhas].map((l) => l.map(celula).join(';')).join('\r\n');
  return `﻿${corpo}\r\n`;
}
