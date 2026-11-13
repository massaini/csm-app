'use client';

import { useState } from 'react';
import {
  BarraDeFiltros,
  BotaoExportar,
  CabecalhoDaTela,
  CampoFiltro,
  Kpi,
  LinhaDeKpis,
  Tabela,
  useAgoraServidor,
  useAvisoTemporario,
  useConsulta,
} from '@/components/admin/comum';
import { Chip } from '@/components/ui/basicos';
import { Confirmacao } from '@/components/ui/confirmacao';
import { formatarDia } from '@/domain/formato';
import type { Consulta } from '@/server/filtros-admin';
import type { FilaAoVivo as Dados, LinhaFila } from '@/server/painel';
import { acaoChamar, acaoConcluir, acaoConfirmarChegada, type RespostaAdmin } from './actions';

const POLLING_MS = 4_000;

const subtitulo = (iso: string) => {
  const d = new Date(iso);
  const fuso = { timeZone: 'America/Sao_Paulo' } as const;
  const data = d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...fuso,
  });
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', ...fuso });
  return `Estado em tempo real · ${data.charAt(0).toUpperCase()}${data.slice(1)} — ${hora}`;
};

function mmss(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const CHIP = {
  AGUARDANDO: { tom: 'warning', texto: 'Aguardando' },
  CHAMADA: { tom: 'solido', texto: 'Chamado' },
  EM_ATENDIMENTO: { tom: 'success', texto: 'Em atendimento' },
} as const;

/** RF18-CA2 — com concordância de número. */
function textoForaDeOrdem(n: number) {
  return `Há ${n} ${n === 1 ? 'motorista' : 'motoristas'} antes nesta bancada. Chamar mesmo assim?`;
}

type Pendente =
  { tipo: 'fora-de-ordem'; linha: LinhaFila } | { tipo: 'concluir'; linha: LinhaFila } | null;

/** Tela `170:26` — Fila ao Vivo (RF17, RF18, RF19). */
export function FilaAoVivo() {
  const [motorista, setMotorista] = useState('');
  const [codigo, setCodigo] = useState('');
  const [galpaoId, setGalpaoId] = useState<number | null>(null);
  const [bancadaId, setBancadaId] = useState<number | null>(null);
  const consulta: Consulta = {
    tela: 'fila-ao-vivo',
    filtros: { motorista, codigo, galpaoId, bancadaId },
  };
  const { dados, erro, recarregar } = useConsulta<Dados>(consulta, POLLING_MS);
  const [pendente, setPendente] = useState<Pendente>(null);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useAvisoTemporario();

  // contagem regressiva das chamadas, pelo relógio do servidor
  const agora = useAgoraServidor(dados?.agora);

  async function executar(acao: () => Promise<RespostaAdmin>) {
    setEnviando(true);
    try {
      const r = await acao();
      if (!r.ok && r.aviso) setAviso(r.aviso);
    } catch {
      setAviso('Sem conexão. Tente novamente.');
    } finally {
      setEnviando(false);
      setPendente(null);
      await recarregar();
    }
  }

  function chamar(l: LinhaFila) {
    // RF18-CA2: fora da ordem da bancada pede confirmação
    if ((l.posicao ?? 1) > 1) setPendente({ tipo: 'fora-de-ordem', linha: l });
    else void executar(() => acaoChamar(l.id));
  }

  const bancadas = dados?.galpoes.find((g) => g.id === galpaoId)?.bancadas ?? [];

  return (
    <main>
      <CabecalhoDaTela
        titulo="Fila ao Vivo"
        subtitulo={dados ? subtitulo(dados.agora) : 'Estado em tempo real'}
        acao={<BotaoExportar consulta={consulta} />}
      />

      <LinhaDeKpis>
        <Kpi rotulo="Aguardando" valor={dados?.kpis.aguardando ?? '—'} destaque />
        <Kpi rotulo="Em atendimento" valor={dados?.kpis.emAtendimento ?? '—'} />
        <Kpi
          rotulo="Tempo médio na fila"
          valor={
            dados?.kpis.tempoMedioFilaMin == null ? '—' : `${dados.kpis.tempoMedioFilaMin} min`
          }
        />
      </LinhaDeKpis>

      <BarraDeFiltros>
        <CampoFiltro rotulo="Motorista">
          {(c) => (
            <input
              className={c}
              placeholder="Buscar nome ou CPF"
              value={motorista}
              onChange={(e) => setMotorista(e.target.value)}
            />
          )}
        </CampoFiltro>
        <CampoFiltro rotulo="Nº da senha">
          {(c) => (
            <input
              className={c}
              placeholder="Buscar nº da senha"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
            />
          )}
        </CampoFiltro>
        <CampoFiltro rotulo="Galpão">
          {(c) => (
            <select
              className={c}
              value={galpaoId ?? ''}
              onChange={(e) => {
                setGalpaoId(e.target.value ? Number(e.target.value) : null);
                setBancadaId(null);
              }}
            >
              <option value="">Todos os galpões</option>
              {dados?.galpoes.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                </option>
              ))}
            </select>
          )}
        </CampoFiltro>
        <CampoFiltro rotulo="Bancada">
          {(c) => (
            <select
              className={c}
              disabled={!galpaoId}
              value={bancadaId ?? ''}
              onChange={(e) => setBancadaId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">{galpaoId ? 'Todas as bancadas' : 'Escolha um galpão'}</option>
              {bancadas.map((b) => (
                <option key={b.id} value={b.id}>
                  Bancada {b.identificacao}
                </option>
              ))}
            </select>
          )}
        </CampoFiltro>
      </BarraDeFiltros>

      {aviso || erro ? (
        <p role="alert" className="t-body-s mt-base text-danger">
          {aviso ?? 'Sem conexão com o servidor. Tentando de novo…'}
        </p>
      ) : null}

      <Tabela
        carregando={!dados}
        vazia="Nenhum motorista na fila agora"
        colunas={[
          { titulo: 'Senha' },
          { titulo: 'Motorista' },
          { titulo: 'Galpão' },
          { titulo: 'Status' },
          { titulo: 'Posição/Bancada' },
          { titulo: 'Tempo', classe: 'text-right' },
          { titulo: 'Status de chamado', classe: 'w-[260px]' },
        ]}
      >
        {(dados?.linhas ?? []).map((l) => (
          <tr key={l.id} className="t-body-m">
            <td className="t-body-m-strong px-base py-md text-primary">
              {l.codigo}
              {l.diaAnterior ? (
                <span className="t-caption ml-sm text-text-muted">
                  {formatarDia(l.diaAnterior)}
                </span>
              ) : null}
            </td>
            <td className="px-base py-md">{l.motorista}</td>
            <td className="t-body-s px-base py-md text-text-secondary">{l.galpao}</td>
            <td className="px-base py-md">
              <Chip tom={CHIP[l.status].tom}>{CHIP[l.status].texto}</Chip>
            </td>
            <td className="t-body-s px-base py-md text-text-secondary">
              {l.posicao ? `${l.posicao}º na fila · Bancada ${l.bancada}` : `Bancada ${l.bancada}`}
            </td>
            <td className="t-body-m-strong px-base py-md text-right tabular-nums">
              {l.tempoMin} min
            </td>
            <td className="px-base py-sm">
              {l.status === 'AGUARDANDO' ? (
                <button
                  className="t-button-m h-[36px] rounded-md bg-primary px-base text-on-primary disabled:bg-elevated disabled:text-text-muted"
                  disabled={enviando || l.bancadaOcupada}
                  onClick={() => chamar(l)}
                >
                  {l.bancadaOcupada ? 'Bancada ocupada' : 'Chamar'}
                </button>
              ) : null}
              {l.status === 'CHAMADA' ? (
                <div className="flex items-center gap-md">
                  <span
                    className="t-body-s tabular-nums text-text-secondary"
                    title="Tempo até o fim da tolerância"
                  >
                    {agora === null ? '—' : mmss(Date.parse(l.prazoEm!) - agora)}
                  </span>
                  <button
                    className="t-button-m h-[36px] rounded-md border border-border-strong px-base text-primary disabled:opacity-50"
                    disabled={enviando}
                    onClick={() => void executar(() => acaoConfirmarChegada(l.id))}
                  >
                    Confirmar chegada
                  </button>
                </div>
              ) : null}
              {l.status === 'EM_ATENDIMENTO' ? (
                <button
                  className="t-button-m h-[36px] rounded-md border border-border-strong px-base text-primary disabled:opacity-50"
                  disabled={enviando}
                  onClick={() => setPendente({ tipo: 'concluir', linha: l })}
                >
                  Concluir
                </button>
              ) : null}
            </td>
          </tr>
        ))}
      </Tabela>

      <Confirmacao
        aberta={pendente?.tipo === 'fora-de-ordem'}
        titulo="Chamar fora da ordem?"
        texto={textoForaDeOrdem((pendente?.linha.posicao ?? 1) - 1)}
        confirmar="Chamar"
        voltar="Cancelar"
        pendente={enviando}
        aoFechar={() => setPendente(null)}
        aoConfirmar={() => pendente && void executar(() => acaoChamar(pendente.linha.id))}
      />
      <Confirmacao
        aberta={pendente?.tipo === 'concluir'}
        titulo="Concluir atendimento?"
        texto={`Concluir atendimento de ${pendente?.linha.motorista ?? ''} (${pendente?.linha.codigo ?? ''})?`}
        confirmar="Concluir"
        voltar="Cancelar"
        pendente={enviando}
        aoFechar={() => setPendente(null)}
        aoConfirmar={() => pendente && void executar(() => acaoConcluir(pendente.linha.id))}
      />
    </main>
  );
}
