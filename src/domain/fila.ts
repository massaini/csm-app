import type { ConcluidaPor } from './senha';

const MIN = 60_000;

/** Minutos inteiros exibidos (floor), a partir de milissegundos brutos. */
export function minutosExibidos(ms: number): number {
  return Math.floor(ms / MIN);
}

export interface AtendimentoConcluido {
  chamadaEm: Date;
  concluidaEm: Date;
  concluidaPor: ConcluidaPor;
}

/**
 * Média do dia, em minutos (sem arredondar), do carregamento (concluidaEm − chamadaEm)
 * das senhas concluídas do galpão. Ignora conclusões do SISTEMA e durações acima de
 * `ocupacaoMaxMin`. Sem amostra, usa `tempoPadraoMin`.
 */
export function mediaDoDiaMin(
  concluidas: AtendimentoConcluido[],
  tempoPadraoMin: number,
  ocupacaoMaxMin: number,
): number {
  const duracoes = concluidas
    .filter((c) => c.concluidaPor !== 'SISTEMA')
    .map((c) => (c.concluidaEm.getTime() - c.chamadaEm.getTime()) / MIN)
    .filter((m) => m >= 0 && m <= ocupacaoMaxMin);
  if (duracoes.length === 0) return tempoPadraoMin;
  return duracoes.reduce((a, b) => a + b, 0) / duracoes.length;
}

/** Posição 1-based na fila da bancada (FIFO por `geradaEm`); null se não estiver na fila. */
export function posicaoNaFila(fila: { id: string; geradaEm: Date }[], id: string): number | null {
  const ordenada = [...fila].sort((a, b) => a.geradaEm.getTime() - b.geradaEm.getTime());
  const i = ordenada.findIndex((s) => s.id === id);
  return i === -1 ? null : i + 1;
}

/** Tempo estimado em minutos: (posição − 1) × média do dia, arredondado para cima. */
export function tempoEstimadoMin(posicao: number, mediaMin: number): number {
  return Math.ceil((posicao - 1) * mediaMin);
}

export function textoTempoEstimado(posicao: number, mediaMin: number): string {
  const min = tempoEstimadoMin(posicao, mediaMin);
  return min === 0 ? 'Você é o próximo' : `~${min} min`;
}

/** Texto abaixo da senha em `13:2`. */
export function textoProximidade(posicao: number): string {
  return posicao <= 2 ? 'Sua vez está próxima' : 'Acompanhe sua posição';
}

/** Card "Fila estimada agora" em `233:440`: N na bancada que o motorista receberia. */
export function textoFilaEstimada(n: number, mediaMin: number): string {
  if (n === 0) return 'Sem fila · você será o próximo';
  const min = Math.ceil(n * mediaMin);
  return `${n} ${n === 1 ? 'motorista' : 'motoristas'} · ~${min} min de espera`;
}

export interface MarcosDaSenha {
  geradaEm: Date;
  chamadaEm: Date;
  aCaminhoEm: Date | null;
  concluidaEm: Date;
  concluidaPor: ConcluidaPor;
}

export interface TemposDaSenha {
  /** chamadaEm − geradaEm */
  esperaMin: number;
  /** concluidaEm − chamadaEm */
  carregamentoMin: number;
  /** concluidaEm − geradaEm, calculado a partir dos valores brutos */
  totalMin: number;
}

/** Tempos exibidos; null para conclusões do SISTEMA (aparecem como "—"). */
export function temposDaSenha(m: MarcosDaSenha): TemposDaSenha | null {
  if (m.concluidaPor === 'SISTEMA') return null;
  return {
    esperaMin: minutosExibidos(m.chamadaEm.getTime() - m.geradaEm.getTime()),
    carregamentoMin: minutosExibidos(m.concluidaEm.getTime() - m.chamadaEm.getTime()),
    totalMin: minutosExibidos(m.concluidaEm.getTime() - m.geradaEm.getTime()),
  };
}

/** Métrica da seção 8 do PRD: aCaminhoEm − geradaEm (equivale aos 30 min de hoje). */
export function tempoAteIniciarMin(geradaEm: Date, aCaminhoEm: Date): number {
  return minutosExibidos(aCaminhoEm.getTime() - geradaEm.getTime());
}
