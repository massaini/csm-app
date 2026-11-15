import type { Prisma, Senha } from '@/generated/prisma/client';
import { limitesDoDia } from '@/domain/dia';
import { minutosExibidos, temposDaSenha } from '@/domain/fila';
import { formatarDataHora, paraCsv } from '@/domain/formato';
import { ocupaBancada, statusEfetivo } from '@/domain/senha';
import type {
  ColunaHistorico,
  FiltrosFila,
  FiltrosHistorico,
  StatusHistorico,
} from '@/server/filtros-admin';
import type { Deps } from '@/server/senhas';

const hora = (d: Deps) => d.horaVirada ?? process.env.HORA_VIRADA ?? '00:00';
export const POR_PAGINA = 50;
export const LIMITE_EXPORTACAO = 10_000;

type Busca = Pick<FiltrosFila, 'texto' | 'campo'>;

/** RF31-CA1: texto na barra de busca, no campo escolhido; chega por POST (RNF02-CA4). */
function filtroBusca(f: Busca): Prisma.SenhaWhereInput[] {
  const termo = f.texto?.trim();
  if (!termo) return [];
  if (f.campo === 'codigo') return [{ codigo: { contains: termo.toUpperCase() } }];
  return [{ motoristaNome: { contains: termo, mode: 'insensitive' } }];
}

const emLista = <T>(xs: T[] | undefined) => (xs && xs.length ? { in: xs } : undefined);

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

  // galpão e bancada também filtram os KPIs; busca e status, não (6.0)
  const doLocal: Prisma.SenhaWhereInput = {
    ...(emLista(f.galpaoIds) ? { galpaoId: emLista(f.galpaoIds) } : {}),
    ...(emLista(f.bancadaIds) ? { bancadaId: emLista(f.bancadaIds) } : {}),
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
        where: { id: { in: ativas.map((s) => s.id) }, AND: filtroBusca(f) },
        select: { id: true },
      })
    ).map((s) => s.id),
  );

  const status = f.status?.length ? new Set(f.status) : null;
  const linhas: LinhaFila[] = ativas
    .filter((s) => visiveis.has(s.id) && (!status || status.has(s.status as StatusFila)))
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

/* ------------------------------------------------------------------- Histórico (RF20) */

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

function esperaMin(s: Senha): number | null {
  return s.chamadaEm ? minutos(s.chamadaEm.getTime() - s.geradaEm.getTime()) : null;
}

export type RotuloSenha = 'Aguardando' | 'Atendendo' | 'Concluída' | 'Cancelada';

function rotulo(s: Senha, agora: Date, carenciaSeg: number): RotuloSenha {
  const ef = statusEfetivo(s, agora, carenciaSeg).status;
  if (ef === 'AGUARDANDO') return 'Aguardando';
  if (ef === 'CHAMADA' || ef === 'EM_ATENDIMENTO') return 'Atendendo';
  if (ef === 'CONCLUIDA') return 'Concluída';
  return 'Cancelada';
}

const STATUS_DO_FILTRO: Record<StatusHistorico, Senha['status'][]> = {
  AGUARDANDO: ['AGUARDANDO'],
  ATENDENDO: ['CHAMADA', 'EM_ATENDIMENTO'],
  CONCLUIDA: ['CONCLUIDA'],
  CANCELADA: ['CANCELADA'],
};

const CAMPO_DA_COLUNA: Record<ColunaHistorico, keyof Prisma.SenhaOrderByWithRelationInput> = {
  geradaEm: 'geradaEm',
  codigo: 'codigo',
  motorista: 'motoristaNome',
  galpao: 'galpaoNome',
  bancada: 'bancadaIdentificacao',
  rota: 'regiaoCodigo',
  status: 'status',
};

/** Só galpão e período: é o recorte dos KPIs (6.0). */
function doGalpao(f: FiltrosHistorico): Prisma.SenhaWhereInput {
  return emLista(f.galpaoIds) ? { galpaoId: emLista(f.galpaoIds) } : {};
}

function whereHistorico(f: FiltrosHistorico): Prisma.SenhaWhereInput {
  const status = f.status?.flatMap((s) => STATUS_DO_FILTRO[s]);
  return {
    dia: { gte: f.diaInicio, lte: f.diaFim },
    ...doGalpao(f),
    ...(emLista(f.bancadaIds) ? { bancadaId: emLista(f.bancadaIds) } : {}),
    ...(emLista(f.rotas) ? { regiaoCodigo: emLista(f.rotas) } : {}),
    ...(emLista(status) ? { status: emLista(status) } : {}),
    ...(f.motoristaId ? { motoristaId: f.motoristaId } : {}),
    AND: filtroBusca(f),
  };
}

function ordemHistorico(f: FiltrosHistorico): Prisma.SenhaOrderByWithRelationInput[] {
  const { coluna, direcao } = f.ordem ?? { coluna: 'geradaEm', direcao: 'desc' };
  return [{ [CAMPO_DA_COLUNA[coluna]]: direcao }, { geradaEm: 'desc' }, { id: 'desc' }];
}

export interface LinhaHistorico {
  id: number;
  geradaEm: string;
  codigo: string;
  motorista: string;
  galpao: string;
  bancada: string;
  rota: string;
  esperaMin: number | null;
  totalMin: number | null;
  status: RotuloSenha;
}

/** RF20 — Histórico: todas as senhas do período, com KPIs, contagens do filtro e paginação. */
export async function historico(deps: Deps, f: FiltrosHistorico) {
  const { db, clock } = deps;
  const agora = clock.agora();
  const cfg = await configuracao(deps);
  const { dia } = limitesDoDia(agora, hora(deps));
  const where = whereHistorico(f);
  const pagina = Math.max(1, f.pagina ?? 1);
  const g = doGalpao(f);
  const [
    total,
    concluidas,
    canceladas,
    senhas,
    paraMedia,
    geradasHoje,
    concluidasHoje,
    canceladasHoje,
  ] = await Promise.all([
    db.senha.count({ where }),
    db.senha.count({ where: { AND: [where, { status: 'CONCLUIDA' }] } }),
    db.senha.count({ where: { AND: [where, { status: 'CANCELADA' }] } }),
    db.senha.findMany({
      where,
      orderBy: ordemHistorico(f),
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    db.senha.findMany({
      where: {
        status: 'CONCLUIDA',
        dia: { gte: f.diaInicio, lte: f.diaFim },
        ...g,
        concluidaPor: { not: 'SISTEMA' },
      },
    }),
    db.senha.count({ where: { dia, ...g } }),
    db.senha.count({ where: { dia, status: 'CONCLUIDA', ...g } }),
    db.senha.count({ where: { dia, status: 'CANCELADA', ...g } }),
  ]);
  // "Tempo médio": mesmas exclusões da média do dia (SISTEMA e carregamento acima do máximo)
  const totais = paraMedia
    .filter((s) => s.chamadaEm && s.concluidaEm)
    .filter(
      (s) => (s.concluidaEm!.getTime() - s.chamadaEm!.getTime()) / 60_000 <= cfg.ocupacaoMaxMin,
    )
    .map((s) => s.concluidaEm!.getTime() - s.geradaEm.getTime());
  const tempoMedio = media(totais);

  return {
    kpis: {
      geradasHoje,
      concluidasHoje,
      canceladasHoje,
      tempoMedioMin: tempoMedio === null ? null : minutos(tempoMedio),
    },
    /** RF20-CA6: contagens do filtro inteiro, para o subtítulo */
    total,
    totalConcluidas: concluidas,
    totalCanceladas: canceladas,
    pagina,
    paginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
    linhas: senhas.map((s): LinhaHistorico => ({
      id: s.id,
      geradaEm: s.geradaEm.toISOString(),
      codigo: s.codigo,
      motorista: s.motoristaNome,
      galpao: s.galpaoNome,
      bancada: s.bancadaIdentificacao,
      rota: `${s.regiaoCodigo} · ${s.regiaoNome}`,
      esperaMin: esperaMin(s),
      totalMin: totalMin(s),
      status: rotulo(s, agora, cfg.carenciaSeg),
    })),
  };
}

/* ------------------------------------------------------------------------ CSV (RF22) */

export type TelaExportavel = 'fila-ao-vivo' | 'historico';

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

/** Exporta todas as linhas do filtro atual (todas as páginas, na ordem da tela), sem CPF (RF22). */
export async function exportarCsv(
  deps: Deps,
  tela: TelaExportavel,
  filtros: FiltrosFila | FiltrosHistorico,
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

  const fh = filtros as FiltrosHistorico;
  const where = whereHistorico(fh);
  if ((await deps.db.senha.count({ where })) > LIMITE_EXPORTACAO) {
    return { ok: false, erro: 'MUITAS_LINHAS' };
  }
  const [senhas, cfg] = await Promise.all([
    deps.db.senha.findMany({ where, orderBy: ordemHistorico(fh) }),
    configuracao(deps),
  ]);
  return {
    ok: true,
    nomeArquivo,
    csv: paraCsv(
      [
        'Data/Hora',
        'Senha',
        'Motorista',
        'Galpão',
        'Bancada',
        'Rota',
        'Espera (min)',
        'Tempo total (min)',
        'Status',
      ],
      senhas.map((s) => [
        formatarDataHora(s.geradaEm),
        s.codigo,
        s.motoristaNome,
        s.galpaoNome,
        s.bancadaIdentificacao,
        `${s.regiaoCodigo} · ${s.regiaoNome}`,
        esperaMin(s),
        totalMin(s),
        rotulo(s, agora, cfg.carenciaSeg),
      ]),
    ),
  };
}
