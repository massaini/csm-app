'use server';

import { relogioSistema } from '@/domain/clock';
import { db } from '@/server/db';
import {
  estadoDoMotorista,
  marcarResultadoVisto,
  type EstadoMotorista,
} from '@/server/fila-motorista';
import { exigirMotorista } from '@/server/http-sessao';
import {
  cancelarPeloMotorista,
  concluirSenha,
  confirmarChegada,
  gerarSenha,
  type CodigoResultado,
} from '@/server/senhas';

/** Contrato das mutações (PRD §6.0): o app nunca mostra CONFLITO como erro, só renderiza o estado. */
export interface RespostaDaAcao {
  codigo: CodigoResultado;
  mensagem?: string;
  estado: EstadoMotorista;
}

const deps = () => ({ db, clock: relogioSistema });

const MENSAGENS: Partial<Record<CodigoResultado, string>> = {
  FORA_DO_RAIO: 'Você está fora do pátio. Aproxime-se ou peça liberação ao administrador.',
  SEM_BANCADA: 'Sua região não é atendida neste galpão. Fale com o administrador.',
  PLACA_INVALIDA: 'Placa inválida. Use o formato ABC-1234 ou ABC-1D23.',
  NAO_ENCONTRADO: 'Não foi possível concluir. Atualize a tela e tente de novo.',
};

async function responder(motoristaId: number, codigo: CodigoResultado): Promise<RespostaDaAcao> {
  return {
    codigo,
    mensagem: MENSAGENS[codigo],
    estado: await estadoDoMotorista(deps(), motoristaId),
  };
}

export async function acaoGerarSenha(entrada: {
  galpaoId: number;
  placa: string;
  leitura: { lat: number; lng: number; precisaoM: number } | null;
}): Promise<RespostaDaAcao> {
  const m = await exigirMotorista();
  const r = await gerarSenha(deps(), { motoristaId: m.id, ...entrada });
  return responder(m.id, r.codigo);
}

export async function acaoCancelar(senhaId: number): Promise<RespostaDaAcao> {
  const m = await exigirMotorista();
  const r = await cancelarPeloMotorista(deps(), { senhaId, motoristaId: m.id });
  return responder(m.id, r.codigo);
}

export async function acaoEstouACaminho(senhaId: number): Promise<RespostaDaAcao> {
  const m = await exigirMotorista();
  const r = await confirmarChegada(deps(), {
    senhaId,
    por: { tipo: 'MOTORISTA', motoristaId: m.id },
  });
  return responder(m.id, r.codigo);
}

export async function acaoConcluir(senhaId: number): Promise<RespostaDaAcao> {
  const m = await exigirMotorista();
  const r = await concluirSenha(deps(), { senhaId, por: { tipo: 'MOTORISTA', motoristaId: m.id } });
  return responder(m.id, r.codigo);
}

export async function acaoVerResultado(): Promise<RespostaDaAcao> {
  const m = await exigirMotorista();
  await marcarResultadoVisto(deps(), m.id);
  return responder(m.id, 'OK');
}
