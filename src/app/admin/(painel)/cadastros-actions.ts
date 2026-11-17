'use server';

import { revalidatePath } from 'next/cache';
import { relogioApp } from '@/server/relogio';
import { db } from '@/server/db';
import * as cad from '@/server/cadastros';
import { exigirAdmin } from '@/server/http-sessao';

const deps = () => ({ db, clock: relogioApp });

/* Motoristas — busca por POST para o CPF nunca ir na URL (RF24-CA7) */

export async function buscarMotoristas(busca: string) {
  await exigirAdmin();
  return cad.listarMotoristas(deps(), busca);
}

export async function salvarMotorista(
  id: number | null,
  dados: { nome: string; cpf: string; telefone: string; regiaoId: number },
) {
  const admin = await exigirAdmin();
  return id === null
    ? cad.criarMotorista(deps(), admin.id, dados)
    : cad.editarMotorista(deps(), admin.id, id, dados);
}

export async function alterarAtivoMotorista(id: number, ativo: boolean) {
  const admin = await exigirAdmin();
  if (ativo) await cad.reativarMotorista(deps(), admin.id, id);
  else await cad.desativarMotorista(deps(), admin.id, id);
}

export async function redefinirSenhaMotorista(id: number) {
  const admin = await exigirAdmin();
  return cad.redefinirSenhaDoMotorista(deps(), admin.id, id);
}

export async function liberarGeracaoDeSenha(id: number) {
  const admin = await exigirAdmin();
  const l = await cad.liberarGeofence(deps(), admin.id, id);
  return { expiraEm: l.expiraEm.toISOString() };
}

/** RF24-CA9 — a função confere o papel; um ADMIN recebe a mensagem de erro. */
export async function excluirMotorista(id: number) {
  const admin = await exigirAdmin();
  return cad.excluirMotorista(
    deps(),
    { id: admin.id, papel: admin.papel === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN' },
    id,
  );
}

/* Bancadas e regiões: duas telas que leem os mesmos dados */

const recarregarBancadas = () => {
  revalidatePath('/admin/bancadas');
  revalidatePath('/admin/regioes');
};

export async function novaBancada(galpaoId: number, identificacao: string) {
  const admin = await exigirAdmin();
  const r = await cad.criarBancada(deps(), admin.id, galpaoId, identificacao);
  recarregarBancadas();
  return r;
}

export async function renomearBancada(bancadaId: number, identificacao: string) {
  const admin = await exigirAdmin();
  const r = await cad.renomearBancada(deps(), admin.id, bancadaId, identificacao);
  recarregarBancadas();
  return r;
}

export async function alterarAtivaBancada(bancadaId: number, ativa: boolean) {
  const admin = await exigirAdmin();
  const r = await cad.alternarBancada(deps(), admin.id, bancadaId, ativa);
  recarregarBancadas();
  return r;
}

export async function excluirBancada(bancadaId: number) {
  const admin = await exigirAdmin();
  const r = await cad.excluirBancada(deps(), admin.id, bancadaId);
  recarregarBancadas();
  return r;
}

export async function novaRegiao(codigo: string, bairro: string) {
  const admin = await exigirAdmin();
  const r = await cad.criarRegiao(deps(), admin.id, { codigo, nome: bairro });
  recarregarBancadas();
  return r;
}

export async function renomearBairro(regiaoId: number, de: string, para: string) {
  const admin = await exigirAdmin();
  const r = await cad.renomearBairro(deps(), admin.id, regiaoId, de, para);
  recarregarBancadas();
  return r;
}

export async function removerBairro(regiaoId: number, bairro: string) {
  const admin = await exigirAdmin();
  const r = await cad.removerBairro(deps(), admin.id, regiaoId, bairro);
  recarregarBancadas();
  return r;
}

export async function excluirRegiao(regiaoId: number) {
  const admin = await exigirAdmin();
  const r = await cad.excluirRegiao(deps(), admin.id, regiaoId);
  recarregarBancadas();
  return r;
}

export async function alterarAtivaRegiao(regiaoId: number, ativa: boolean) {
  const admin = await exigirAdmin();
  const r = await cad.alternarRegiao(deps(), admin.id, regiaoId, ativa);
  recarregarBancadas();
  return r;
}

export async function mapear(galpaoId: number, regiaoId: number, bancadaId: number | null) {
  const admin = await exigirAdmin();
  const r = await cad.definirMapeamento(deps(), admin.id, { galpaoId, regiaoId, bancadaId });
  recarregarBancadas();
  return r;
}

/* Configurações — ficam na Fila ao Vivo (RF26-CA3) */

export async function salvarConfiguracoes(dados: Parameters<typeof cad.salvarConfiguracoes>[2]) {
  const admin = await exigirAdmin();
  const r = await cad.salvarConfiguracoes(deps(), admin.id, dados);
  revalidatePath('/admin');
  return r;
}

/* Administradores — só super-admin (RF27-CA2) */

async function exigirSuper() {
  const admin = await exigirAdmin({ apenasSuper: true });
  if (admin.papel !== 'SUPER_ADMIN') throw new Error('Acesso negado');
  return admin;
}

export async function novoAdmin(nome: string, cpf: string) {
  const s = await exigirSuper();
  const r = await cad.criarAdmin(deps(), s.id, { nome, cpf });
  revalidatePath('/admin/administradores');
  return r;
}

export async function alterarAtivoAdmin(id: number, ativo: boolean) {
  const s = await exigirSuper();
  const r = ativo
    ? (await cad.reativarAdmin(deps(), s.id, id), { ok: true as const })
    : await cad.desativarAdmin(deps(), s.id, id);
  revalidatePath('/admin/administradores');
  return r;
}

export async function excluirAdminAction(id: number) {
  const s = await exigirSuper();
  const r = await cad.excluirAdmin(deps(), s.id, id);
  revalidatePath('/admin/administradores');
  return r;
}

export async function renomearAdminAction(id: number, nome: string) {
  const s = await exigirSuper();
  const r = await cad.renomearAdmin(deps(), s.id, id, nome);
  // o nome aparece também na barra lateral e no Conferente
  revalidatePath('/admin', 'layout');
  return r;
}

export async function redefinirSenhaAdmin(id: number) {
  const s = await exigirSuper();
  return cad.redefinirSenhaDoAdmin(deps(), s.id, id);
}
