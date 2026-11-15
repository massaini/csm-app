'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  BarraDeBusca,
  estadoInicial,
  proximaOrdem,
  textoDoPeriodo,
  type AtalhoDePeriodo,
  type Campo,
  type EstadoBusca,
  type Periodo,
} from '@/components/admin/busca';
import {
  BotaoExportar,
  CabecalhoDaTela,
  Kpi,
  LinhaDeKpis,
  Paginacao,
  Tabela,
  useConsulta,
} from '@/components/admin/comum';
import { Chip, MensagemDeErro } from '@/components/ui/basicos';
import { formatarDiaHora } from '@/domain/formato';
import {
  STATUS_HISTORICO,
  type ColunaHistorico,
  type Consulta,
  type StatusHistorico,
} from '@/server/filtros-admin';
import type { historico, RotuloSenha } from '@/server/painel';

type Dados = Awaited<ReturnType<typeof historico>>;

const ROTULO_STATUS: Record<StatusHistorico, string> = {
  AGUARDANDO: 'Aguardando',
  ATENDENDO: 'Atendendo',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
};

const CHIP: Record<RotuloSenha, 'primary' | 'solido' | 'success' | 'danger'> = {
  Aguardando: 'primary',
  Atendendo: 'solido',
  Concluída: 'success',
  Cancelada: 'danger',
};

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const min = (v: number | null) => (v === null ? '—' : `${v} min`);

/** RF20 — Histórico (Histórico de Senhas e de Atendimentos unificados, P28). */
export function Historico({
  padrao,
  atalhos,
  galpoes,
  rotas,
  motorista,
}: {
  padrao: Periodo;
  atalhos: AtalhoDePeriodo[];
  galpoes: { id: number; nome: string; bancadas: { id: number; identificacao: string }[] }[];
  rotas: { codigo: string; nome: string }[];
  /** RF20-CA7: aberto pelo "Ver histórico" do motorista */
  motorista: { id: number; nome: string } | null;
}) {
  const router = useRouter();
  const [busca, setBusca] = useState<EstadoBusca>(estadoInicial({ periodo: padrao }));
  const [ordem, setOrdem] = useState<{ coluna: ColunaHistorico; direcao: 'asc' | 'desc' }>({
    coluna: 'geradaEm',
    direcao: 'desc',
  });
  const [pagina, setPagina] = useState(1);
  const [doMotorista, setDoMotorista] = useState(motorista);

  const periodo = busca.periodo ?? padrao;
  const numeros = (chave: string) => (busca.selecoes[chave] ?? []).map(Number);
  const consulta: Consulta = {
    tela: 'historico',
    filtros: {
      texto: busca.texto,
      campo: busca.campoTexto as 'nome' | 'codigo',
      galpaoIds: numeros('galpao'),
      bancadaIds: numeros('bancada'),
      rotas: busca.selecoes.rota ?? [],
      status: (busca.selecoes.status ?? []) as StatusHistorico[],
      motoristaId: doMotorista?.id ?? null,
      diaInicio: periodo.diaInicio,
      diaFim: periodo.diaFim,
      pagina,
      ordem,
    },
  };
  const { dados, erro } = useConsulta<Dados>(consulta);

  // qualquer mudança de filtro volta para a primeira página
  const mudarBusca = (e: EstadoBusca) => {
    setBusca(e);
    setPagina(1);
  };

  const campos: Campo[] = [
    { chave: 'nome', rotulo: 'Nome', tipo: 'texto' },
    { chave: 'codigo', rotulo: 'Nº da senha', tipo: 'texto' },
    { chave: 'periodo', rotulo: 'Período', tipo: 'periodo', atalhos },
    {
      chave: 'galpao',
      rotulo: 'Galpão',
      tipo: 'opcoes',
      opcoes: galpoes.map((g) => ({ valor: String(g.id), rotulo: g.nome })),
    },
    {
      chave: 'bancada',
      rotulo: 'Bancada',
      tipo: 'opcoes',
      opcoes: galpoes.flatMap((g) =>
        g.bancadas.map((b) => ({
          valor: String(b.id),
          rotulo: `${g.nome} · Bancada ${b.identificacao}`,
        })),
      ),
    },
    {
      chave: 'rota',
      rotulo: 'Rota',
      tipo: 'opcoes',
      opcoes: rotas.map((r) => ({ valor: r.codigo, rotulo: `${r.codigo} · ${r.nome}` })),
    },
    {
      chave: 'status',
      rotulo: 'Status',
      tipo: 'opcoes',
      opcoes: STATUS_HISTORICO.map((s) => ({ valor: s, rotulo: ROTULO_STATUS[s] })),
    },
  ];

  return (
    <main>
      <CabecalhoDaTela
        titulo="Histórico"
        subtitulo={
          dados
            ? `${textoDoPeriodo(periodo)} · ${plural(dados.total, 'senha', 'senhas')} · ${plural(
                dados.totalConcluidas,
                'concluída',
                'concluídas',
              )} · ${plural(dados.totalCanceladas, 'cancelada', 'canceladas')}`
            : textoDoPeriodo(periodo)
        }
        acao={<BotaoExportar consulta={consulta} />}
      />
      <LinhaDeKpis>
        <Kpi rotulo="Geradas hoje" valor={dados?.kpis.geradasHoje ?? '—'} />
        <Kpi rotulo="Concluídas hoje" valor={dados?.kpis.concluidasHoje ?? '—'} />
        <Kpi rotulo="Canceladas hoje" valor={dados?.kpis.canceladasHoje ?? '—'} />
        <Kpi
          rotulo="Tempo médio"
          valor={dados?.kpis.tempoMedioMin == null ? '—' : `${dados.kpis.tempoMedioMin} min`}
          destaque
        />
      </LinhaDeKpis>

      <BarraDeBusca
        campos={campos}
        estado={busca}
        aoMudar={mudarBusca}
        periodoPadrao={padrao}
        etiquetasExtras={
          doMotorista
            ? [
                {
                  texto: `Motorista: ${doMotorista.nome}`,
                  aoRemover: () => {
                    setDoMotorista(null);
                    setPagina(1);
                    router.replace('/admin/historico');
                  },
                },
              ]
            : []
        }
      />

      {erro ? (
        <MensagemDeErro className="mt-base">Sem conexão com o servidor.</MensagemDeErro>
      ) : null}
      <Tabela
        carregando={!dados}
        falhou={erro && !dados}
        vazia="Nenhuma senha no período"
        ordem={ordem}
        aoOrdenar={(c) => {
          setOrdem(
            proximaOrdem(ordem, c, c === 'geradaEm' ? 'desc' : 'asc') as {
              coluna: ColunaHistorico;
              direcao: 'asc' | 'desc';
            },
          );
          setPagina(1);
        }}
        colunas={[
          { titulo: 'Data / Hora', ordenar: 'geradaEm' },
          { titulo: 'Senha', ordenar: 'codigo' },
          { titulo: 'Motorista', ordenar: 'motorista' },
          { titulo: 'Galpão', ordenar: 'galpao' },
          { titulo: 'Bancada', ordenar: 'bancada' },
          { titulo: 'Rota', ordenar: 'rota' },
          { titulo: 'Espera', classe: 'text-right' },
          { titulo: 'Tempo total', classe: 'text-right' },
          { titulo: 'Status', ordenar: 'status' },
        ]}
      >
        {(dados?.linhas ?? []).map((l) => (
          <tr key={l.id} className="t-body-m">
            <td className="t-body-s whitespace-nowrap px-base py-md text-text-secondary">
              {formatarDiaHora(new Date(l.geradaEm))}
            </td>
            <td className="t-body-m-strong px-base py-md text-primary">{l.codigo}</td>
            <td className="t-body-m-strong px-base py-md">{l.motorista}</td>
            <td className="t-body-s px-base py-md text-text-secondary">{l.galpao}</td>
            <td className="t-body-s px-base py-md text-text-secondary">{l.bancada}</td>
            <td className="t-body-s px-base py-md text-text-secondary">{l.rota}</td>
            <td className="px-base py-md text-right tabular-nums">{min(l.esperaMin)}</td>
            <td className="px-base py-md text-right tabular-nums">{min(l.totalMin)}</td>
            <td className="px-base py-md">
              <Chip tom={CHIP[l.status]}>{l.status}</Chip>
            </td>
          </tr>
        ))}
      </Tabela>
      {dados ? (
        <Paginacao
          pagina={dados.pagina}
          paginas={dados.paginas}
          total={dados.total}
          aoMudar={setPagina}
        />
      ) : null}
    </main>
  );
}
