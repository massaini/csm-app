import { z } from 'zod';
import { Prisma } from '@/generated/prisma/client';
import { limitesDoDia } from '@/domain/dia';
import { cpfValido, somenteDigitos } from '@/domain/documentos';
import {
  LIMITES,
  desativarUsuario,
  gerarSenhaTemporaria,
  hashDaSenha,
  redefinirSenha,
  type AuthDeps,
} from '@/server/auth';

const hora = () => process.env.HORA_VIRADA ?? '00:00';
const ATIVAS = ['AGUARDANDO', 'CHAMADA', 'EM_ATENDIMENTO'] as const;

export type Erros = Record<string, string>;
export type Resultado<T = object> = ({ ok: true } & T) | { ok: false; erros: Erros };

const falha = (erros: Erros): { ok: false; erros: Erros } => ({ ok: false, erros });

async function auditar(
  deps: AuthDeps,
  adminId: number,
  acao: string,
  alvoTipo: string,
  alvoId: number | string,
  dados?: Prisma.InputJsonValue,
) {
  await deps.db.auditoria.create({
    data: {
      atorTipo: 'ADMIN',
      atorId: adminId,
      acao,
      alvoTipo,
      alvoId: String(alvoId),
      dados: dados ?? Prisma.JsonNull,
      instante: deps.clock.agora(),
    },
  });
}

/* ----------------------------------------------------------------- Motoristas (RF24) */

export interface MotoristaListado {
  id: number;
  nome: string;
  cpf: string;
  telefone: string | null;
  regiaoId: number;
  regiao: string;
  ativo: boolean;
  deveTrocarSenha: boolean;
  /** RF24-CA6: liberação de geofence válida e ainda não usada */
  liberado: boolean;
}

/** Busca por nome ou CPF (chega por POST, nunca pela URL: RF24-CA7). */
export async function listarMotoristas(deps: AuthDeps, busca = ''): Promise<MotoristaListado[]> {
  const agora = deps.clock.agora();
  const termo = busca.trim();
  const digitos = somenteDigitos(termo);
  const motoristas = await deps.db.motorista.findMany({
    where: termo
      ? {
          OR: [
            { nome: { contains: termo, mode: 'insensitive' } },
            ...(digitos.length >= 3 ? [{ cpf: { contains: digitos } }] : []),
          ],
        }
      : {},
    orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    take: 200,
    include: {
      regiao: true,
      liberacoes: { where: { usadaEm: null, expiraEm: { gt: agora } }, take: 1 },
    },
  });
  return motoristas.map((m) => ({
    id: m.id,
    nome: m.nome,
    cpf: m.cpf,
    telefone: m.telefone,
    regiaoId: m.regiaoId,
    regiao: `${m.regiao.codigo} · ${m.regiao.nome}`,
    ativo: m.ativo,
    deveTrocarSenha: m.deveTrocarSenha,
    liberado: m.liberacoes.length > 0,
  }));
}

const esquemaMotorista = z.object({
  nome: z.string().trim().min(3, 'Informe o nome completo').max(100),
  telefone: z
    .string()
    .trim()
    .transform((t) => somenteDigitos(t))
    .refine(
      (t) => t === '' || (t.length >= 10 && t.length <= 11),
      'Telefone com DDD (10 ou 11 dígitos)',
    ),
  regiaoId: z.coerce.number().int().positive('Escolha a região'),
});

function errosDoZod(e: z.ZodError): Erros {
  const erros: Erros = {};
  for (const i of e.issues) erros[String(i.path[0] ?? 'geral')] ??= i.message;
  return erros;
}

async function regiaoAtiva(deps: AuthDeps, regiaoId: number) {
  const r = await deps.db.regiao.findUnique({ where: { id: regiaoId } });
  return !!r?.ativa;
}

/** RF24-CA1/CA2 — cria com senha temporária (72 h), mostrada uma única vez ao admin. */
export async function criarMotorista(
  deps: AuthDeps,
  adminId: number,
  entrada: { nome: string; cpf: string; telefone: string; regiaoId: number | string },
): Promise<Resultado<{ id: number; senhaTemporaria: string }>> {
  const cpf = somenteDigitos(entrada.cpf);
  const v = esquemaMotorista.safeParse(entrada);
  const erros: Erros = v.success ? {} : errosDoZod(v.error);
  if (!cpfValido(cpf)) erros.cpf = 'CPF inválido';
  else if (await deps.db.motorista.findUnique({ where: { cpf } })) erros.cpf = 'CPF já cadastrado';
  if (v.success && !(await regiaoAtiva(deps, v.data.regiaoId))) erros.regiaoId = 'Região inválida';
  if (Object.keys(erros).length || !v.success) return falha(erros);

  const senhaTemporaria = gerarSenhaTemporaria();
  const m = await deps.db.motorista.create({
    data: {
      nome: v.data.nome,
      cpf,
      telefone: v.data.telefone || null,
      regiaoId: v.data.regiaoId,
      senhaHash: await hashDaSenha(senhaTemporaria),
      deveTrocarSenha: true,
      senhaTemporariaExpiraEm: new Date(deps.clock.agora().getTime() + LIMITES.senhaTemporariaMs),
    },
  });
  await auditar(deps, adminId, 'cadastro.motorista.criar', 'MOTORISTA', m.id);
  return { ok: true, id: m.id, senhaTemporaria };
}

/** RF24-CA3 — trocar a região não altera a senha ativa (ela guarda o snapshot). */
export async function editarMotorista(
  deps: AuthDeps,
  adminId: number,
  id: number,
  entrada: { nome: string; telefone: string; regiaoId: number | string },
): Promise<Resultado> {
  const v = esquemaMotorista.safeParse(entrada);
  if (!v.success) return falha(errosDoZod(v.error));
  if (!(await regiaoAtiva(deps, v.data.regiaoId))) return falha({ regiaoId: 'Região inválida' });
  const antes = await deps.db.motorista.findUniqueOrThrow({ where: { id } });
  await deps.db.motorista.update({
    where: { id },
    data: { nome: v.data.nome, telefone: v.data.telefone || null, regiaoId: v.data.regiaoId },
  });
  await auditar(deps, adminId, 'cadastro.motorista.editar', 'MOTORISTA', id, {
    antes: { nome: antes.nome, telefone: antes.telefone, regiaoId: antes.regiaoId },
    depois: { nome: v.data.nome, telefone: v.data.telefone || null, regiaoId: v.data.regiaoId },
  });
  return { ok: true };
}

/** RF24-CA4 — desativar segue o RF06 (derruba sessões e cancela a senha ativa). */
export async function desativarMotorista(deps: AuthDeps, adminId: number, id: number) {
  await desativarUsuario(deps, { tipo: 'MOTORISTA', usuarioId: id, porAdminId: adminId });
}

export async function reativarMotorista(deps: AuthDeps, adminId: number, id: number) {
  await deps.db.motorista.update({ where: { id }, data: { ativo: true } });
  await auditar(deps, adminId, 'cadastro.motorista.reativar', 'MOTORISTA', id);
}

/** RF24-CA5 — nova temporária, derruba sessões e zera o bloqueio do CPF. */
export async function redefinirSenhaDoMotorista(deps: AuthDeps, adminId: number, id: number) {
  return redefinirSenha(deps, { tipo: 'MOTORISTA', usuarioId: id, porAdminId: adminId });
}

/** RF24-CA6 — liberação válida até o fim do dia operacional ou até ser usada. */
export async function liberarGeofence(deps: AuthDeps, adminId: number, motoristaId: number) {
  const agora = deps.clock.agora();
  const { fim } = limitesDoDia(agora, hora());
  const existente = await deps.db.liberacaoGeofence.findFirst({
    where: { motoristaId, usadaEm: null, expiraEm: { gt: agora } },
  });
  if (existente) return existente;
  const l = await deps.db.liberacaoGeofence.create({
    data: { motoristaId, adminId, criadaEm: agora, expiraEm: fim },
  });
  await auditar(deps, adminId, 'cadastro.liberar_geofence', 'MOTORISTA', motoristaId, {
    expiraEm: fim.toISOString(),
  });
  return l;
}

/* ----------------------------------------------------- Bancadas e Regiões (RF25) */

export async function dadosBancadasRegioes(deps: AuthDeps) {
  const [galpoes, regioes, mapeamentos] = await Promise.all([
    deps.db.galpao.findMany({
      orderBy: { prefixoSenha: 'asc' },
      include: { bancadas: { orderBy: { identificacao: 'asc' } } },
    }),
    deps.db.regiao.findMany({ orderBy: { codigo: 'asc' } }),
    deps.db.regiaoBancada.findMany(),
  ]);
  return {
    galpoes: galpoes.map((g) => ({
      id: g.id,
      nome: g.nome,
      bancadas: g.bancadas.map((b) => ({
        id: b.id,
        identificacao: b.identificacao,
        ativa: b.ativa,
      })),
    })),
    regioes: regioes.map((r) => ({ id: r.id, codigo: r.codigo, nome: r.nome, ativa: r.ativa })),
    mapa: Object.fromEntries(mapeamentos.map((m) => [`${m.galpaoId}:${m.regiaoId}`, m.bancadaId])),
  };
}

const identificacao = z.string().trim().min(1, 'Informe a identificação').max(10);

export async function criarBancada(
  deps: AuthDeps,
  adminId: number,
  galpaoId: number,
  ident: string,
): Promise<Resultado> {
  const v = identificacao.safeParse(ident);
  if (!v.success) return falha({ identificacao: v.error.issues[0].message });
  try {
    const b = await deps.db.bancada.create({ data: { galpaoId, identificacao: v.data } });
    await auditar(deps, adminId, 'cadastro.bancada.criar', 'BANCADA', b.id);
    return { ok: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return falha({ identificacao: 'Já existe uma bancada com essa identificação neste galpão' });
    }
    throw e;
  }
}

export async function renomearBancada(
  deps: AuthDeps,
  adminId: number,
  bancadaId: number,
  ident: string,
): Promise<Resultado> {
  const v = identificacao.safeParse(ident);
  if (!v.success) return falha({ identificacao: v.error.issues[0].message });
  try {
    await deps.db.bancada.update({ where: { id: bancadaId }, data: { identificacao: v.data } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return falha({ identificacao: 'Já existe uma bancada com essa identificação neste galpão' });
    }
    throw e;
  }
  await auditar(deps, adminId, 'cadastro.bancada.renomear', 'BANCADA', bancadaId, {
    identificacao: v.data,
  });
  return { ok: true };
}

/** RF25-CA4 — bloqueia desativar bancada com senhas ativas. */
export async function alternarBancada(
  deps: AuthDeps,
  adminId: number,
  bancadaId: number,
  ativa: boolean,
): Promise<Resultado> {
  if (!ativa) {
    const n = await deps.db.senha.count({ where: { bancadaId, status: { in: [...ATIVAS] } } });
    if (n > 0) {
      return falha({
        geral: `Não é possível desativar: há ${n} ${n === 1 ? 'senha ativa' : 'senhas ativas'} nesta bancada.`,
      });
    }
  }
  await deps.db.bancada.update({ where: { id: bancadaId }, data: { ativa } });
  await auditar(
    deps,
    adminId,
    ativa ? 'cadastro.bancada.reativar' : 'cadastro.bancada.desativar',
    'BANCADA',
    bancadaId,
  );
  return { ok: true };
}

const esquemaRegiao = z.object({
  codigo: z.string().trim().min(1, 'Informe o código').max(10),
  nome: z.string().trim().min(2, 'Informe o nome').max(80),
});

export async function criarRegiao(
  deps: AuthDeps,
  adminId: number,
  entrada: { codigo: string; nome: string },
): Promise<Resultado> {
  const v = esquemaRegiao.safeParse(entrada);
  if (!v.success) return falha(errosDoZod(v.error));
  try {
    const r = await deps.db.regiao.create({ data: v.data });
    await auditar(deps, adminId, 'cadastro.regiao.criar', 'REGIAO', r.id);
    return { ok: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return falha({ codigo: 'Já existe uma região com esse código' });
    }
    throw e;
  }
}

export async function renomearRegiao(
  deps: AuthDeps,
  adminId: number,
  regiaoId: number,
  nome: string,
): Promise<Resultado> {
  const v = esquemaRegiao.shape.nome.safeParse(nome);
  if (!v.success) return falha({ nome: v.error.issues[0].message });
  await deps.db.regiao.update({ where: { id: regiaoId }, data: { nome: v.data } });
  await auditar(deps, adminId, 'cadastro.regiao.renomear', 'REGIAO', regiaoId, { nome: v.data });
  return { ok: true };
}

/** RF25-CA4 — bloqueia desativar região com motoristas ativos. */
export async function alternarRegiao(
  deps: AuthDeps,
  adminId: number,
  regiaoId: number,
  ativa: boolean,
): Promise<Resultado> {
  if (!ativa) {
    const n = await deps.db.motorista.count({ where: { regiaoId, ativo: true } });
    if (n > 0) {
      return falha({
        geral: `Não é possível desativar: há ${n} ${n === 1 ? 'motorista ativo' : 'motoristas ativos'} nesta região.`,
      });
    }
  }
  await deps.db.regiao.update({ where: { id: regiaoId }, data: { ativa } });
  await auditar(
    deps,
    adminId,
    ativa ? 'cadastro.regiao.reativar' : 'cadastro.regiao.desativar',
    'REGIAO',
    regiaoId,
  );
  return { ok: true };
}

/** RF25-CA3/CA5 — (galpão, região) → bancada ativa do galpão, ou nenhuma. */
export async function definirMapeamento(
  deps: AuthDeps,
  adminId: number,
  e: { galpaoId: number; regiaoId: number; bancadaId: number | null },
): Promise<Resultado> {
  const chave = { galpaoId_regiaoId: { galpaoId: e.galpaoId, regiaoId: e.regiaoId } };
  if (e.bancadaId === null) {
    await deps.db.regiaoBancada.deleteMany({
      where: { galpaoId: e.galpaoId, regiaoId: e.regiaoId },
    });
  } else {
    const b = await deps.db.bancada.findUnique({ where: { id: e.bancadaId } });
    if (!b || b.galpaoId !== e.galpaoId || !b.ativa) {
      return falha({ geral: 'Escolha uma bancada ativa deste galpão.' });
    }
    await deps.db.regiaoBancada.upsert({
      where: chave,
      update: { bancadaId: e.bancadaId },
      create: { galpaoId: e.galpaoId, regiaoId: e.regiaoId, bancadaId: e.bancadaId },
    });
  }
  await auditar(deps, adminId, 'cadastro.mapeamento', 'REGIAO', e.regiaoId, {
    galpaoId: e.galpaoId,
    bancadaId: e.bancadaId,
  });
  return { ok: true };
}

/* -------------------------------------------------------------- Configurações (RF26) */

export const esquemaConfiguracao = z.object({
  toleranciaMin: z.coerce.number().int().min(1).max(30),
  carenciaSeg: z.coerce.number().int().min(0).max(120),
  tempoPadraoMin: z.coerce.number().int().min(1).max(120),
  ocupacaoMaxMin: z.coerce.number().int().min(30).max(480),
  raios: z.record(z.string(), z.coerce.number().int().min(50).max(2000)),
});

export async function lerConfiguracoes(deps: AuthDeps) {
  const cfg = await deps.db.configuracao.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
  const locais = await deps.db.local.findMany({
    orderBy: { id: 'asc' },
    include: { galpoes: { select: { nome: true }, orderBy: { prefixoSenha: 'asc' } } },
  });
  return {
    toleranciaMin: cfg.toleranciaMin,
    carenciaSeg: cfg.carenciaSeg,
    tempoPadraoMin: cfg.tempoPadraoMin,
    ocupacaoMaxMin: cfg.ocupacaoMaxMin,
    locais: locais.map((l) => ({
      id: l.id,
      nome: l.nome,
      raioMetros: l.raioMetros,
      galpoes: l.galpoes.map((g) => g.nome),
    })),
  };
}

/** RF26 — valida os limites e audita valor anterior e novo de cada alteração. */
export async function salvarConfiguracoes(
  deps: AuthDeps,
  adminId: number,
  entrada: z.input<typeof esquemaConfiguracao>,
): Promise<Resultado> {
  const v = esquemaConfiguracao.safeParse(entrada);
  if (!v.success) {
    const erros: Erros = {};
    for (const i of v.error.issues) {
      const campo = i.path[0] === 'raios' ? `raio-${String(i.path[1])}` : String(i.path[0]);
      erros[campo] ??= 'Valor fora do limite permitido';
    }
    return falha(erros);
  }
  const antes = await lerConfiguracoes(deps);
  const { raios, ...cfg } = v.data;
  await deps.db.$transaction(async (tx) => {
    await tx.configuracao.update({ where: { id: 1 }, data: cfg });
    for (const [localId, raioMetros] of Object.entries(raios)) {
      await tx.local.update({ where: { id: Number(localId) }, data: { raioMetros } });
    }
  });
  const mudancas: Record<string, { antes: number; depois: number }> = {};
  for (const k of ['toleranciaMin', 'carenciaSeg', 'tempoPadraoMin', 'ocupacaoMaxMin'] as const) {
    if (antes[k] !== cfg[k]) mudancas[k] = { antes: antes[k], depois: cfg[k] };
  }
  for (const l of antes.locais) {
    const novo = raios[String(l.id)];
    if (novo !== undefined && novo !== l.raioMetros)
      mudancas[`raio:${l.nome}`] = { antes: l.raioMetros, depois: novo };
  }
  if (Object.keys(mudancas).length) {
    await auditar(deps, adminId, 'configuracao.alterar', 'CONFIGURACAO', 1, mudancas);
  }
  return { ok: true };
}

/* ---------------------------------------------------- Administradores (RF27, só super) */

export async function listarAdmins(deps: AuthDeps) {
  const admins = await deps.db.admin.findMany({ orderBy: [{ papel: 'desc' }, { nome: 'asc' }] });
  return admins.map((a) => ({
    id: a.id,
    nome: a.nome,
    cpf: a.cpf,
    papel: a.papel,
    ativo: a.ativo,
    deveTrocarSenha: a.deveTrocarSenha,
  }));
}

export async function criarAdmin(
  deps: AuthDeps,
  superId: number,
  entrada: { nome: string; cpf: string },
): Promise<Resultado<{ id: number; senhaTemporaria: string }>> {
  const cpf = somenteDigitos(entrada.cpf);
  const nome = entrada.nome.trim();
  const erros: Erros = {};
  if (nome.length < 3) erros.nome = 'Informe o nome completo';
  if (!cpfValido(cpf)) erros.cpf = 'CPF inválido';
  else if (await deps.db.admin.findUnique({ where: { cpf } })) erros.cpf = 'CPF já cadastrado';
  if (Object.keys(erros).length) return falha(erros);

  const senhaTemporaria = gerarSenhaTemporaria();
  const a = await deps.db.admin.create({
    data: {
      nome,
      cpf,
      senhaHash: await hashDaSenha(senhaTemporaria),
      papel: 'ADMIN',
      deveTrocarSenha: true,
      senhaTemporariaExpiraEm: new Date(deps.clock.agora().getTime() + LIMITES.senhaTemporariaMs),
    },
  });
  await auditar(deps, superId, 'cadastro.admin.criar', 'ADMIN', a.id);
  return { ok: true, id: a.id, senhaTemporaria };
}

export async function desativarAdmin(
  deps: AuthDeps,
  superId: number,
  id: number,
): Promise<Resultado> {
  const alvo = await deps.db.admin.findUniqueOrThrow({ where: { id } });
  if (alvo.papel === 'SUPER_ADMIN')
    return falha({ geral: 'O super-admin não pode ser desativado.' });
  await desativarUsuario(deps, { tipo: 'ADMIN', usuarioId: id, porAdminId: superId });
  return { ok: true };
}

export async function reativarAdmin(deps: AuthDeps, superId: number, id: number) {
  await deps.db.admin.update({ where: { id }, data: { ativo: true } });
  await auditar(deps, superId, 'cadastro.admin.reativar', 'ADMIN', id);
}

export async function redefinirSenhaDoAdmin(deps: AuthDeps, superId: number | null, id: number) {
  return redefinirSenha(deps, { tipo: 'ADMIN', usuarioId: id, porAdminId: superId });
}

/** RF27-CA3 — transfere o papel de super-admin (comando do desenvolvedor). */
export async function transferirSuperAdmin(deps: AuthDeps, cpfNovo: string): Promise<Resultado> {
  const cpf = somenteDigitos(cpfNovo);
  const novo = await deps.db.admin.findUnique({ where: { cpf } });
  if (!novo || !novo.ativo) return falha({ cpf: 'Não existe administrador ativo com esse CPF' });
  if (novo.papel === 'SUPER_ADMIN') return { ok: true };
  await deps.db.$transaction(async (tx) => {
    // o índice único parcial exige rebaixar o atual antes de promover o novo
    await tx.admin.updateMany({ where: { papel: 'SUPER_ADMIN' }, data: { papel: 'ADMIN' } });
    await tx.admin.update({ where: { id: novo.id }, data: { papel: 'SUPER_ADMIN' } });
    await tx.auditoria.create({
      data: {
        acao: 'admin.transferir_super',
        alvoTipo: 'ADMIN',
        alvoId: String(novo.id),
        instante: deps.clock.agora(),
      },
    });
  });
  return { ok: true };
}
