export type StatusSenha = 'AGUARDANDO' | 'CHAMADA' | 'EM_ATENDIMENTO' | 'CONCLUIDA' | 'CANCELADA';
export type MotivoCancelamento = 'MOTORISTA' | 'EXPIRADA' | 'FIM_DO_DIA' | 'MOTORISTA_DESATIVADO';
export type ConcluidaPor = 'MOTORISTA' | 'ADMIN' | 'SISTEMA';

const SEGUINTES: Record<StatusSenha, StatusSenha[]> = {
  AGUARDANDO: ['CHAMADA', 'CANCELADA'],
  CHAMADA: ['EM_ATENDIMENTO', 'CANCELADA'],
  EM_ATENDIMENTO: ['CONCLUIDA', 'CANCELADA'],
  CONCLUIDA: [],
  CANCELADA: [],
};

/** De quais status cada motivo pode cancelar. */
const ORIGENS_DO_CANCELAMENTO: Record<MotivoCancelamento, StatusSenha[]> = {
  MOTORISTA: ['AGUARDANDO'],
  EXPIRADA: ['CHAMADA'],
  FIM_DO_DIA: ['AGUARDANDO'],
  MOTORISTA_DESATIVADO: ['AGUARDANDO', 'CHAMADA', 'EM_ATENDIMENTO'],
};

export function podeTransitar(
  de: StatusSenha,
  para: StatusSenha,
  motivo?: MotivoCancelamento,
): boolean {
  if (!SEGUINTES[de].includes(para)) return false;
  if (para !== 'CANCELADA') return true;
  return motivo !== undefined && ORIGENS_DO_CANCELAMENTO[motivo].includes(de);
}

export function estaAtiva(status: StatusSenha): boolean {
  return status === 'AGUARDANDO' || status === 'CHAMADA' || status === 'EM_ATENDIMENTO';
}

/** Uma bancada atende um motorista por vez: CHAMADA e EM_ATENDIMENTO a ocupam. */
export function ocupaBancada(status: StatusSenha): boolean {
  return status === 'CHAMADA' || status === 'EM_ATENDIMENTO';
}

/** Limite inclusivo (relógio do servidor) para "Estou a caminho" / "Confirmar chegada". */
export function limiteDeChegada(prazoEm: Date, carenciaSeg: number): Date {
  return new Date(prazoEm.getTime() + carenciaSeg * 1000);
}

export function dentroDoLimiteDeChegada(agora: Date, prazoEm: Date, carenciaSeg: number): boolean {
  return agora.getTime() <= limiteDeChegada(prazoEm, carenciaSeg).getTime();
}

export interface SenhaParaStatus {
  status: StatusSenha;
  prazoEm: Date | null;
}

export type StatusEfetivo =
  | { status: Exclude<StatusSenha, 'CANCELADA'>; motivo?: undefined }
  | { status: 'CANCELADA'; motivo: MotivoCancelamento | null };

/**
 * Status efetivo: leituras tratam uma CHAMADA vencida (prazo + carência) como
 * CANCELADA (EXPIRADA) sem gravar; a persistência é feita por escritas e pelo job.
 */
export function statusEfetivo(
  senha: SenhaParaStatus,
  agora: Date,
  carenciaSeg: number,
): StatusEfetivo {
  if (senha.status === 'CHAMADA' && senha.prazoEm) {
    if (!dentroDoLimiteDeChegada(agora, senha.prazoEm, carenciaSeg)) {
      return { status: 'CANCELADA', motivo: 'EXPIRADA' };
    }
  }
  if (senha.status === 'CANCELADA') return { status: 'CANCELADA', motivo: null };
  return { status: senha.status };
}
