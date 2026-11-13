'use client';

import { useState } from 'react';
import {
  BarraDeFiltros,
  BotaoExportar,
  CabecalhoDaTela,
  CampoFiltro,
  Kpi,
  LinhaDeKpis,
  Paginacao,
  Tabela,
  useConsulta,
} from '@/components/admin/comum';
import { Chip } from '@/components/ui/basicos';
import { formatarDia, formatarDiaHora } from '@/domain/formato';
import type { Consulta } from '@/server/filtros-admin';
import type { historicoAtendimentos, historicoSenhas, RotuloSenha } from '@/server/painel';

type DadosAtendimentos = Awaited<ReturnType<typeof historicoAtendimentos>>;
type DadosSenhas = Awaited<ReturnType<typeof historicoSenhas>>;

function useFiltrosPeriodo(diaInicio: string, diaFim: string) {
  const [f, setF] = useState({
    diaInicio,
    diaFim,
    motorista: '',
    codigo: '',
    galpaoId: null as number | null,
    pagina: 1,
  });
  const mudar = (parcial: Partial<typeof f>) =>
    setF((atual) => ({ ...atual, pagina: 1, ...parcial }));
  return [f, mudar] as const;
}

function Filtros({
  f,
  mudar,
  galpoes,
}: {
  f: ReturnType<typeof useFiltrosPeriodo>[0];
  mudar: ReturnType<typeof useFiltrosPeriodo>[1];
  galpoes: { id: number; nome: string }[];
}) {
  return (
    <BarraDeFiltros>
      <CampoFiltro rotulo="Período">
        {(c) => (
          <div className="flex gap-xs">
            <input
              type="date"
              aria-label="Início do período"
              className={c}
              value={f.diaInicio}
              max={f.diaFim}
              onChange={(e) => e.target.value && mudar({ diaInicio: e.target.value })}
            />
            <input
              type="date"
              aria-label="Fim do período"
              className={c}
              value={f.diaFim}
              min={f.diaInicio}
              onChange={(e) => e.target.value && mudar({ diaFim: e.target.value })}
            />
          </div>
        )}
      </CampoFiltro>
      <CampoFiltro rotulo="Motorista">
        {(c) => (
          <input
            className={c}
            placeholder="Buscar nome ou CPF"
            value={f.motorista}
            onChange={(e) => mudar({ motorista: e.target.value })}
          />
        )}
      </CampoFiltro>
      <CampoFiltro rotulo="Nº da senha">
        {(c) => (
          <input
            className={c}
            placeholder="Buscar nº da senha"
            value={f.codigo}
            onChange={(e) => mudar({ codigo: e.target.value })}
          />
        )}
      </CampoFiltro>
      <CampoFiltro rotulo="Galpão">
        {(c) => (
          <select
            className={c}
            value={f.galpaoId ?? ''}
            onChange={(e) => mudar({ galpaoId: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Todos os galpões</option>
            {galpoes.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </select>
        )}
      </CampoFiltro>
    </BarraDeFiltros>
  );
}

const periodo = (f: { diaInicio: string; diaFim: string }) =>
  f.diaInicio === f.diaFim
    ? formatarDia(f.diaInicio)
    : `${formatarDia(f.diaInicio)} – ${formatarDia(f.diaFim)}`;

/** Tela `171:95` — Histórico de Atendimentos (RF20). */
export function HistoricoAtendimentos({
  padrao,
  galpoes,
}: {
  padrao: { diaInicio: string; diaFim: string };
  galpoes: { id: number; nome: string }[];
}) {
  const [f, mudar] = useFiltrosPeriodo(padrao.diaInicio, padrao.diaFim);
  const consulta: Consulta = { tela: 'atendimentos', filtros: f };
  const { dados, erro } = useConsulta<DadosAtendimentos>(consulta);

  return (
    <main>
      <CabecalhoDaTela
        titulo="Histórico de Atendimentos"
        subtitulo={
          dados
            ? `${periodo(f)} · ${dados.totalConcluidos} atendimentos concluídos · ${dados.totalCancelados} cancelados`
            : periodo(f)
        }
        acao={<BotaoExportar consulta={consulta} />}
      />
      <LinhaDeKpis>
        <Kpi rotulo="Concluídos hoje" valor={dados?.kpis.concluidosHoje ?? '—'} />
        <Kpi rotulo="Cancelados hoje" valor={dados?.kpis.canceladosHoje ?? '—'} />
        <Kpi
          rotulo="Tempo médio"
          valor={dados?.kpis.tempoMedioMin == null ? '—' : `${dados.kpis.tempoMedioMin} min`}
          destaque
        />
      </LinhaDeKpis>
      <Filtros f={f} mudar={mudar} galpoes={galpoes} />
      {erro ? (
        <p role="alert" className="t-body-s mt-base text-danger">
          Sem conexão com o servidor.
        </p>
      ) : null}
      <Tabela
        carregando={!dados}
        vazia="Nenhum atendimento no período"
        colunas={[
          { titulo: 'Data / Hora' },
          { titulo: 'Motorista' },
          { titulo: 'Senha' },
          { titulo: 'Bancada' },
          { titulo: 'Tempo total' },
          { titulo: 'Status' },
        ]}
      >
        {(dados?.linhas ?? []).map((l) => (
          <tr key={l.id} className="t-body-m">
            <td className="t-body-s px-base py-md text-text-secondary">
              {formatarDiaHora(new Date(l.geradaEm))}
            </td>
            <td className="t-body-m-strong px-base py-md">{l.motorista}</td>
            <td className="t-body-m-strong px-base py-md text-primary">{l.codigo}</td>
            <td className="t-body-s px-base py-md text-text-secondary">{l.bancada}</td>
            <td className="px-base py-md">{l.totalMin === null ? '—' : `${l.totalMin} min`}</td>
            <td className="px-base py-md">
              {l.status === 'CONCLUIDA' ? (
                <Chip tom="success">Concluído</Chip>
              ) : (
                <Chip tom="danger">Cancelado</Chip>
              )}
            </td>
          </tr>
        ))}
      </Tabela>
      {dados ? (
        <Paginacao
          pagina={dados.pagina}
          paginas={dados.paginas}
          total={dados.total}
          aoMudar={(p) => mudar({ pagina: p })}
        />
      ) : null}
    </main>
  );
}

const CHIP_SENHA: Record<RotuloSenha, 'warning' | 'success' | 'neutral' | 'danger'> = {
  Aguardando: 'warning',
  Atendendo: 'success',
  Atendida: 'neutral',
  Cancelada: 'danger',
};

/** Tela `172:170` — Histórico de Senhas (RF21), com a barra de filtros (P18). */
export function HistoricoSenhas({
  padrao,
  galpoes,
}: {
  padrao: { diaInicio: string; diaFim: string };
  galpoes: { id: number; nome: string }[];
}) {
  const [f, mudar] = useFiltrosPeriodo(padrao.diaInicio, padrao.diaFim);
  const consulta: Consulta = { tela: 'senhas', filtros: f };
  const { dados, erro } = useConsulta<DadosSenhas>(consulta);

  return (
    <main>
      <CabecalhoDaTela
        titulo="Histórico de Senhas"
        subtitulo={dados ? `${periodo(f)} · ${dados.total} senhas geradas` : periodo(f)}
        acao={<BotaoExportar consulta={consulta} />}
      />
      <LinhaDeKpis>
        <Kpi rotulo="Geradas hoje" valor={dados?.kpis.geradasHoje ?? '—'} destaque />
        <Kpi rotulo="Atendidas" valor={dados?.kpis.atendidasHoje ?? '—'} />
        <Kpi rotulo="Aguardando" valor={dados?.kpis.aguardando ?? '—'} />
        <Kpi rotulo="Canceladas" valor={dados?.kpis.canceladasHoje ?? '—'} />
      </LinhaDeKpis>
      <Filtros f={f} mudar={mudar} galpoes={galpoes} />
      {erro ? (
        <p role="alert" className="t-body-s mt-base text-danger">
          Sem conexão com o servidor.
        </p>
      ) : null}
      <Tabela
        carregando={!dados}
        vazia="Nenhuma senha no período"
        colunas={[
          { titulo: 'Senha' },
          { titulo: 'Data / Hora' },
          { titulo: 'Motorista' },
          { titulo: 'Galpão' },
          { titulo: 'Rota' },
          { titulo: 'Status' },
        ]}
      >
        {(dados?.linhas ?? []).map((l) => (
          <tr key={l.id} className="t-body-m">
            <td className="t-body-m-strong px-base py-md text-primary">{l.codigo}</td>
            <td className="t-body-s px-base py-md text-text-secondary">
              {formatarDiaHora(new Date(l.geradaEm))}
            </td>
            <td className="t-body-m-strong px-base py-md">{l.motorista}</td>
            <td className="t-body-s px-base py-md text-text-secondary">{l.galpao}</td>
            <td className="t-body-s px-base py-md text-text-secondary">{l.rota}</td>
            <td className="px-base py-md">
              <Chip tom={CHIP_SENHA[l.status]}>{l.status}</Chip>
            </td>
          </tr>
        ))}
      </Tabela>
      {dados ? (
        <Paginacao
          pagina={dados.pagina}
          paginas={dados.paginas}
          total={dados.total}
          aoMudar={(p) => mudar({ pagina: p })}
        />
      ) : null}
    </main>
  );
}
