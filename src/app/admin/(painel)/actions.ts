'use server';

import { relogioSistema } from '@/domain/clock';
import { db } from '@/server/db';
import { exigirAdmin } from '@/server/http-sessao';
import { enviarChamada } from '@/server/push';
import {
  chamarSenha,
  concluirSenha,
  confirmarChegada,
  type CodigoResultado,
} from '@/server/senhas';

export interface RespostaAdmin {
  ok: boolean;
  codigo: CodigoResultado;
  /** aviso curto para o painel quando a ação não vale mais (PRD §6.0) */
  aviso?: string;
}

const deps = () => ({ db, clock: relogioSistema });

const AVISOS: Partial<Record<CodigoResultado, string>> = {
  CONFLITO: 'A senha mudou de estado ou a bancada está ocupada. A lista foi atualizada.',
  NAO_ENCONTRADO: 'Senha não encontrada.',
};

const resposta = (codigo: CodigoResultado): RespostaAdmin => ({
  ok: codigo === 'OK',
  codigo,
  aviso: AVISOS[codigo],
});

export async function acaoChamar(senhaId: number): Promise<RespostaAdmin> {
  const admin = await exigirAdmin();
  const r = await chamarSenha(deps(), { senhaId, adminId: admin.id });
  if (r.ok) {
    // RF18-CA5: falha no push nunca desfaz a chamada; o app também troca de tela pelo SSE
    try {
      await enviarChamada(deps(), senhaId);
    } catch (e) {
      console.error(
        JSON.stringify({ nivel: 'erro', evento: 'push.chamada', senhaId, erro: String(e) }),
      );
    }
  }
  return resposta(r.codigo);
}

export async function acaoConfirmarChegada(senhaId: number): Promise<RespostaAdmin> {
  const admin = await exigirAdmin();
  const r = await confirmarChegada(deps(), { senhaId, por: { tipo: 'ADMIN', adminId: admin.id } });
  return resposta(r.codigo);
}

export async function acaoConcluir(senhaId: number): Promise<RespostaAdmin> {
  const admin = await exigirAdmin();
  const r = await concluirSenha(deps(), { senhaId, por: { tipo: 'ADMIN', adminId: admin.id } });
  return resposta(r.codigo);
}
