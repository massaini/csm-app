export const FUSO = 'America/Sao_Paulo';

interface Partes {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
}

const formatador = new Intl.DateTimeFormat('en-US', {
  timeZone: FUSO,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

function partesNoFuso(instante: Date): Partes & { segundo: number } {
  const m: Record<string, number> = {};
  for (const p of formatador.formatToParts(instante)) {
    if (p.type !== 'literal') m[p.type] = Number(p.value);
  }
  return {
    ano: m.year,
    mes: m.month,
    dia: m.day,
    hora: m.hour,
    minuto: m.minute,
    segundo: m.second,
  };
}

/** diferença (local − UTC) em ms no instante dado; negativa no fuso de São Paulo */
function offsetMs(instante: Date): number {
  const p = partesNoFuso(instante);
  const localComoUtc = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  return localComoUtc - Math.floor(instante.getTime() / 1000) * 1000;
}

function localParaUtc(ano: number, mes: number, dia: number, hora: number, minuto: number): Date {
  const palpite = Date.UTC(ano, mes - 1, dia, hora, minuto);
  let utc = palpite - offsetMs(new Date(palpite));
  utc = palpite - offsetMs(new Date(utc));
  return new Date(utc);
}

function pad(n: number, tam = 2): string {
  return String(n).padStart(tam, '0');
}

export function dataParaString(ano: number, mes: number, dia: number): string {
  return `${pad(ano, 4)}-${pad(mes)}-${pad(dia)}`;
}

function somarDias(ano: number, mes: number, dia: number, n: number) {
  const d = new Date(Date.UTC(ano, mes - 1, dia + n));
  return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
}

export function paraHoraVirada(hhmm: string): { hora: number; minuto: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59)
    throw new Error(`HORA_VIRADA inválida: ${hhmm}`);
  return { hora: Number(m[1]), minuto: Number(m[2]) };
}

export interface LimitesDoDia {
  /** dia operacional, "AAAA-MM-DD" */
  dia: string;
  inicio: Date;
  /** exclusivo */
  fim: Date;
}

/** Dia operacional que contém `instante`: de HORA_VIRADA até a próxima HORA_VIRADA, em São Paulo. */
export function limitesDoDia(instante: Date, horaVirada = '00:00'): LimitesDoDia {
  const { hora, minuto } = paraHoraVirada(horaVirada);
  const p = partesNoFuso(instante);
  const base =
    p.hora * 60 + p.minuto < hora * 60 + minuto
      ? somarDias(p.ano, p.mes, p.dia, -1)
      : { ano: p.ano, mes: p.mes, dia: p.dia };
  const prox = somarDias(base.ano, base.mes, base.dia, 1);
  return {
    dia: dataParaString(base.ano, base.mes, base.dia),
    inicio: localParaUtc(base.ano, base.mes, base.dia, hora, minuto),
    fim: localParaUtc(prox.ano, prox.mes, prox.dia, hora, minuto),
  };
}

export interface Quinzena {
  /** "AAAA-MM-DD", inclusivo */
  diaInicio: string;
  /** "AAAA-MM-DD", inclusivo */
  diaFim: string;
}

/** Quinzena do dia operacional informado: dias 1–15 ou 16–último do mês. */
export function quinzenaDoDia(dia: string): Quinzena {
  const [ano, mes, d] = dia.split('-').map(Number);
  if (d <= 15)
    return { diaInicio: dataParaString(ano, mes, 1), diaFim: dataParaString(ano, mes, 15) };
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return { diaInicio: dataParaString(ano, mes, 16), diaFim: dataParaString(ano, mes, ultimo) };
}

/** Últimos `n` dias operacionais terminando em `dia` (inclusivo nos dois extremos). */
export function ultimosDias(dia: string, n: number): { diaInicio: string; diaFim: string } {
  const [ano, mes, d] = dia.split('-').map(Number);
  const ini = somarDias(ano, mes, d, -(n - 1));
  return { diaInicio: dataParaString(ini.ano, ini.mes, ini.dia), diaFim: dia };
}

export function codigoSenha(prefixo: string, numero: number): string {
  return `${prefixo}-${pad(numero, 3)}`;
}
