import type { Prisma, Senha } from '@/generated/prisma/client';
import { limitesDoDia } from '@/domain/dia';
import { somenteDigitos } from '@/domain/documentos';
import { minutosExibidos, temposDaSenha } from '@/domain/fila';
import { formatarDataHora, paraCsv } from '@/domain/formato';
import { ocupaBancada, statusEfetivo } from '@/domain/senha';
import type { Deps } from '@/server/senhas';

const hora = (d: Deps) => d.horaVirada ?? process.env.HORA_VIRADA ?? '00:00';
export const POR_PAGINA = 50;
export const LIMITE_EXPORTACAO = 10_000;

export interface FiltrosBase {
  galpaoId?: number | null;
  /** nome ou CPF; chega por POST, nunca pela URL (RNF02-CA4) */
  motorista?: string | null;
  codigo?: string | null;
}

export interface FiltrosFila extends FiltrosBase {
  bancadaId?: number | null;
}

export interface FiltrosPeriodo extends FiltrosBase {
  /** "AAAA-MM-DD", inclusivos */
  diaInicio: string;
  diaFim: string;
  pagina?: number;
}

function filtroMotoristaECodigo(f: FiltrosBase): Prisma.SenhaWhereInput[] {
  const e: Prisma.SenhaWhereInput[] = [];
  const termo = f.motorista?.trim();
  if (termo) {
    const digitos = somenteDigitos(termo);
    e.push({
      OR: [
        { motoristaNome: { contains: termo, mode: 'insensitive' } },
        ...(digitos.length >= 3 ? [{ motorista: { cpf: { contains: digitos } } }] : []),
      ],
    });
  }
  const codigo = f.codigo?.trim().toUpperCase();
  if (codigo) e.push({ codigo: { contains: codigo } });
  return e;
}

async function configuracao(deps: Deps) {
  return deps.db.configuracao.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

const minutos = (ms: number) => minutosExibidos(Math.max(0, ms));
const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/* ------------------------------------------------------------------ Fila ao Vivo */

export type StatusFila = 'AGUARDANDO' | 'CHAMADA' | 'EM_ATENDIMENTO';

export interface LinhaFila {
  id: number;
  codigo: string;
  /** preenchido quando a senha não é do dia operacional atual (RF17-CA2) */
  diaAnterior: string | null;
  motorista: string;
  galpao: string;
  bancada: string;
  bancadaId: number;
  status: StatusFila;
  /** posição na fila da bancada (só AGUARDANDO) */
  posicao: number | null;
  tempoMin: number;
  prazoEm: string | null;
  limiteEm: string | null;
  /** RF18-CA6: outra senha ocupa a bancada */
  bancadaOcupada: boolean;
}

export interface FilaAoVivo {
  agora: string;
  kpis: { aguardando: number; emAtendimento: number; tempoMedioFilaMin: number | null };
  linhas: LinhaFila[];
  galpoes: { id: number; nome: string; bancadas: { id: number; identificacao: string }[] }[];
}

const ORDEM_STATUS: Record<StatusFila, number> = { EM_ATENDIMENTO: 0, CHAMADA: 1, AGUARDANDO: 2 };

/** RF17 — todas as senhas ativas (sem filtro de período), pelo status efetivo. */
export async function filaAoVivo(deps: Deps, f: FiltrosFila = {}): Promise<FilaAoVivo> {
  const { db, clock } = deps;
  const agora = clock.agora();
  const cfg = await configuracao(deps);
  const { dia } = limitesDoDia(agora, hora(deps));

  const doLocal: Prisma.SenhaWhereInput = {
    ...(f.galpaoId ? { galpaoId: f.galpaoId } : {}),
    ...(f.bancadaId ? { bancadaId: f.bancadaId } : {}),
  };
  const ativasBrutas = await db.senha.findMany({
    where: { status: { in: ['AGUARDANDO', 'CHAMADA', 'EM_ATENDIMENTO'] }, ...doLocal },
    orderBy: [{ geradaEm: 'asc' }, { id: 'asc' }],
  });
  // CHAMADA vencida já é "perdeu a vez": sai da fila mesmo antes da varredura
  const ativas = ativasBrutas.filter(
    (s) => statusEfetivo(s, agora, cfg.carenciaSeg).status !== 'CANCELADA',
  );

  const posicoes = new Map<number, number>();
  const contador = new Map<number, number>();
  const ocupadas = new Map<number, number>();
  for (const s of ativas) {
    if (s.status === 'AGUARDANDO') {
      const n = (contador.get(s.bancadaId) ?? 0) + 1;
      contador.set(s.bancadaId, n);
      posicoes.set(s.id, n);
    } else if (ocupaBancada(s.status)) {
      ocupadas.set(s.bancadaId, s.id);
    }
  }

  const visiveis = new Set(
    (
      await db.senha.findMany({
        where: { id: { in: ativas.map((s) => s.id) }, AND: filtroMotoristaECodigo(f) },
        select: { id: true },
      })
    ).map((s) => s.id),
  );

  const linhas: LinhaFila[] = ativas
    .filter((s) => visiveis.has(s.id))
    .map((s) => {
      const desde = s.status === 'AGUARDANDO' ? s.geradaEm : (s.chamadaEm ?? s.geradaEm);
      const ocupante = ocupadas.get(s.bancadaId);
      return {
        id: s.id,
        codigo: s.codigo,
        diaAnterior: s.dia === dia ? null : s.dia,
        motorista: s.motoristaNome,
        galpao: s.galpaoNome,
        bancada: s.bancadaIdentificacao,
        bancadaId: s.bancadaId,
        status: s.status as StatusFila,
        posicao: posicoes.get(s.id) ?? null,
        tempoMin: minutos(agora.getTime() - desde.getTime()),
        prazoEm: s.prazoEm?.toISOString() ?? null,
        limiteEm: s.prazoEm
          ? new Date(s.prazoEm.getTime() + cfg.carenciaSeg * 1000).toISOString()
          : null,
        bancadaOcupada: ocupante !== undefined && ocupante !== s.id,
      };
    })
    .sort(
      (a, b) =>
        a.galpao.localeCompare(b.galpao) ||
        a.bancada.localeCompare(b.bancada, 'pt-BR', { numeric: true }) ||
        ORDEM_STATUS[a.status] - ORDEM_STATUS[b.status] ||
        (a.posicao ?? 0) - (b.posicao ?? 0),
    );

  const chamadasHoje = await db.senha.findMany({
    where: { dia, chamadaEm: { not: null }, ...doLocal },
    select: { geradaEm: true, chamadaEm: true },
  });
  const tempoMedio = media(chamadasHoje.map((s) => s.chamadaEm!.getTime() - s.geradaEm.getTime()));

  const galpoes = await db.galpao.findMany({
    where: { ativo: true },
    orderBy: { prefixoSenha: 'asc' },
    include: { bancadas: { where: { ativa: true }, orderBy: { identificacao: 'asc' } } },
  });

  return {
    agora: agora.toISOString(),
    kpis: {
      aguardando: ativas.filter((s) => s.status === 'AGUARDANDO').length,
      emAtendimento: ativas.filter((s) => s.status !== 'AGUARDANDO').length,
      tempoMedioFilaMin: tempoMedio === null ? null : minutos(tempoMedio),
    },
    linhas,
    galpoes: galpoes.map((g) => ({
      id: g.id,
      nome: g.nome,
      bancadas: g.bancadas.map((b) => ({ id: b.id, identificacao: b.identificacao })),
    })),
  };
}

/* ------------------------------------------------------- Histórico de Atendimentos */

function totalMin(s: Senha): number | null {
  if (s.status !== 'CONCLUIDA' || !s.chamadaEm || !s.concluidaEm) return null;
  return (
    temposDaSenha({
      geradaEm: s.geradaEm,
      chamadaEm: s.chamadaEm,
      aCaminhoEm: s.aCaminhoEm,
      concluidaEm: s.concluidaEm,
      concluidaPor: s.concluidaPor ?? 'MOTORISTA',
    })?.totalMin ?? null
  );
}

function wherePeriodo(f: FiltrosPeriodo, status: Prisma.SenhaWhereInput): Prisma.SenhaWhereInput {
  return {
    ...status,
    dia: { gte: f.diaInicio, lte: f.diaFim },
    ...(f.galpaoId ? { galpaoId: f.galpaoId } : {}),
    AND: filtroMotoristaECodigo(f),
  };
}

export interface LinhaAtendimento {
  id: number;
  geradaEm: string;
  motorista: string;
  codigo: string;
  bancada: string;
  totalMin: number | null;
  status: 'CONCLUIDA' | 'CANCELADA';
}

const FINALIZADAS = { status: { in: ['CONCLUIDA', 'CANCELADA'] as ('CONCLUIDA' | 'CANCELADA')[] } };

/** RF20 — Histórico de Atendimentos. */
export async function historicoAtendimentos(deps: Deps, f: FiltrosPeriodo) {
  const { db, clock } = deps;
  const cfg = await configuracao(deps);
  const { dia } = limitesDoDia(clock.agora(), hora(deps));
  const where = wherePeriodo(f, FINALIZADAS);
  const pagina = Math.max(1, f.pagina ?? 1);
  const [total, senhas, concluidas, cancelados, concluidosHoje] = await Promise.all([
    db.senha.count({ where }),
    db.senha.findMany({
      where,
      orderBy: [{ geradaEm: 'desc' }, { id: 'desc' }],
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    db.senha.findMany({
      where: {
        status: 'CONCLUIDA',
        dia: { gte: f.diaInicio, lte: f.diaFim },
        ...(f.galpaoId ? { galpaoId: f.galpaoId } : {}),
        concluidaPor: { not: 'SISTEMA' },
      },
    }),
    db.senha.count({
      where: { status: 'CANCELADA', dia, ...(f.galpaoId ? { galpaoId: f.galpaoId } : {}) },
    }),
    db.senha.count({
      where: { status: 'CONCLUIDA', dia, ...(f.galpaoId ? { galpaoId: f.galpaoId } : {}) },
    }),
  ]);
  // "Tempo médio": mesmas exclusões da média do dia (SISTEMA e carregamento acima do máximo)
  const totais = concluidas
    .filter((s) => s.chamadaEm && s.concluidaEm)
    .filter(
      (s) => (s.concluidaEm!.getTime() - s.chamadaEm!.getTime()) / 60_000 <= cfg.ocupacaoMaxMin,
    )
    .map((s) => s.concluidaEm!.getTime() - s.geradaEm.getTime());
  const tempoMedio = media(totais);

  return {
    kpis: {
      concluidosHoje,
      canceladosHoje: cancelados,
      tempoMedioMin: tempoMedio === null ? null : minutos(tempoMedio),
    },
    total,
    pagina,
    paginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
    linhas: senhas.map((s): LinhaAtendimento => ({
      id: s.id,
      geradaEm: s.geradaEm.toISOString(),
      motorista: s.motoristaNome,
      codigo: s.codigo,
      bancada: s.bancadaIdentificacao,
      totalMin: totalMin(s),
      status: s.status as 'CONCLUIDA' | 'CANCELADA',
    })),
  };
}

/* ---------------------------------------------------------------- Histórico de Senhas */

export type RotuloSenha = 'Aguardando' | 'Atendendo' | 'Atendida' | 'Cancelada';

function rotulo(s: Senha, agora: Date, carenciaSeg: number): RotuloSenha {
  const ef = statusEfetivo(s, agora, carenciaSeg).status;
  if (ef === 'AGUARDANDO') return 'Aguardando';
  if (ef === 'CHAMADA' || ef === 'EM_ATENDIMENTO') return 'Atendendo';
  if (ef === 'CONCLUIDA') return 'Atendida';
  return 'Cancelada';
}

export interface LinhaSenha {
  id: number;
  codigo: string;
  geradaEm: string;
  motorista: string;
  galpao: string;
  rota: string;
  status: RotuloSenha;
}

/** RF21 — Histórico de Senhas. */
export async function historicoSenhas(deps: Deps, f: FiltrosPeriodo) {
  const { db, clock } = deps;
  const agora = clock.agora();
  const cfg = await configuracao(deps);
  const { dia } = limitesDoDia(agora, hora(deps));
  const where = wherePeriodo(f, {});
  const pagina = Math.max(1, f.pagina ?? 1);
  const g = f.galpaoId ? { galpaoId: f.galpaoId } : {};
  const [total, senhas, geradasHoje, atendidasHoje, aguardando, canceladasHoje] = await Promise.all(
    [
      db.senha.count({ where }),
      db.senha.findMany({
        where,
        orderBy: [{ geradaEm: 'desc' }, { id: 'desc' }],
        skip: (pagina - 1) * POR_PAGINA,
        take: POR_PAGINA,
      }),
      db.senha.count({ where: { dia, ...g } }),
      db.senha.count({ where: { dia, status: 'CONCLUIDA', ...g } }),
      db.senha.count({ where: { status: 'AGUARDANDO', ...g } }),
      db.senha.count({ where: { dia, status: 'CANCELADA', ...g } }),
    ],
  );
  return {
    kpis: { geradasHoje, atendidasHoje, aguardando, canceladasHoje },
    total,
    pagina,
    paginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
    linhas: senhas.map((s): LinhaSenha => ({
      id: s.id,
      codigo: s.codigo,
      geradaEm: s.geradaEm.toISOString(),
      motorista: s.motoristaNome,
      galpao: s.galpaoNome,
      rota: `${s.regiaoCodigo} · ${s.regiaoNome}`,
      status: rotulo(s, agora, cfg.carenciaSeg),
    })),
  };
}

/* ------------------------------------------------------------------------ CSV (RF22) */

export type TelaExportavel = 'fila-ao-vivo' | 'atendimentos' | 'senhas';

const ROTULO_FILA: Record<StatusFila, string> = {
  AGUARDANDO: 'Aguardando',
  CHAMADA: 'Chamado',
  EM_ATENDIMENTO: 'Em atendimento',
};

export type ResultadoExportacao =
  { ok: true; nomeArquivo: string; csv: string } | { ok: false; erro: 'MUITAS_LINHAS' };

function nomeDoArquivo(tela: TelaExportavel, agora: Date): string {
  const [d, h] = formatarDataHora(agora).split(' ');
  const [dd, mm, aaaa] = d.split('/');
  return `${tela}_${aaaa}-${mm}-${dd}_${h.replace(':', '')}.csv`;
}

/** Exporta todas as linhas do filtro atual (todas as páginas), sem CPF (RF22). */
export async function exportarCsv(
  deps: Deps,
  tela: TelaExportavel,
  filtros: FiltrosFila | FiltrosPeriodo,
): Promise<ResultadoExportacao> {
  const agora = deps.clock.agora();
  const nomeArquivo = nomeDoArquivo(tela, agora);
  if (tela === 'fila-ao-vivo') {
    const { linhas } = await filaAoVivo(deps, filtros as FiltrosFila);
    return {
      ok: true,
      nomeArquivo,
      csv: paraCsv(
        ['Senha', 'Motorista', 'Galpão', 'Status', 'Posição/Bancada', 'Tempo (min)'],
        linhas.map((l) => [
          l.codigo,
          l.motorista,
          l.galpao,
          ROTULO_FILA[l.status],
          l.posicao ? `${l.posicao}º na fila · Bancada ${l.bancada}` : `Bancada ${l.bancada}`,
          l.tempoMin,
        ]),
      ),
    };
  }

  const fp = filtros as FiltrosPeriodo;
  const where = wherePeriodo(fp, tela === 'atendimentos' ? FINALIZADAS : {});
  if ((await deps.db.senha.count({ where })) > LIMITE_EXPORTACAO) {
    return { ok: false, erro: 'MUITAS_LINHAS' };
  }
  const senhas = await deps.db.senha.findMany({
    where,
    orderBy: [{ geradaEm: 'desc' }, { id: 'desc' }],
  });
  if (tela === 'atendimentos') {
    return {
      ok: true,
      nomeArquivo,
      csv: paraCsv(
        ['Data/Hora', 'Motorista', 'Senha', 'Bancada', 'Tempo total (min)', 'Status'],
        senhas.map((s) => [
          formatarDataHora(s.geradaEm),
          s.motoristaNome,
          s.codigo,
          s.bancadaIdentificacao,
          totalMin(s),
          s.status === 'CONCLUIDA' ? 'Concluído' : 'Cancelado',
        ]),
      ),
    };
  }
  const cfg = await configuracao(deps);
  return {
    ok: true,
    nomeArquivo,
    csv: paraCsv(
      ['Senha', 'Data/Hora', 'Motorista', 'Galpão', 'Rota', 'Status'],
      senhas.map((s) => [
        s.codigo,
        formatarDataHora(s.geradaEm),
        s.motoristaNome,
        s.galpaoNome,
        `${s.regiaoCodigo} · ${s.regiaoNome}`,
        rotulo(s, agora, cfg.carenciaSeg),
      ]),
    ),
  };
}
