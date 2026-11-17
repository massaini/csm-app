'use client';

import { useState, type ReactNode } from 'react';
import {
  BarraDeBusca,
  estadoInicial,
  ordenarLocal,
  proximaOrdem,
  type Campo,
  type EstadoBusca,
  type Ordem,
} from '@/components/admin/busca';
import {
  BotaoExportar,
  CabecalhoDaTela,
  FALHA_AO_ENVIAR,
  Kpi,
  LinhaDeKpis,
  Paginacao,
  paginar,
  Tabela,
  useAgoraServidor,
  useAvisoTemporario,
  useConsulta,
} from '@/components/admin/comum';
import { Chip, MensagemDeErro } from '@/components/ui/basicos';
import { Confirmacao } from '@/components/ui/confirmacao';
import { formatarContagem, formatarDia } from '@/domain/formato';
import type { Consulta } from '@/server/filtros-admin';
import type { FilaAoVivo as Dados, LinhaFila } from '@/server/painel';
import { acaoChamar, acaoConcluir, acaoConfirmarChegada, type RespostaAdmin } from './actions';

const POLLING_MS = 4_000;
/** RF17-CA11: mesmo tamanho de página do Histórico (RF20-CA4). */
const POR_PAGINA_FILA = 50;

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

/** Contagem até o fim da tolerância: só esta célula re-renderiza a cada segundo. */
function ContagemAtePrazo({ prazoEm, agoraIso }: { prazoEm: string; agoraIso: string }) {
  const agora = useAgoraServidor(agoraIso);
  return (
    <span
      className="t-body-s tabular-nums text-text-secondary"
      title="Tempo até o fim da tolerância"
    >
      {agora === null ? '—' : formatarContagem(Date.parse(prazoEm) - agora)}
    </span>
  );
}

const CHIP = {
  AGUARDANDO: { tom: 'primary', texto: 'Aguardando' },
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
const STATUS_FILA = ['AGUARDANDO', 'CHAMADA', 'EM_ATENDIMENTO'] as const;

/** Ordenação pelas colunas (RF31-CA3); sem escolha, vale a ordem do servidor (RF17-CA6). */
const VALOR_DA_COLUNA: Record<string, (l: LinhaFila) => string | number | null> = {
  codigo: (l) => l.codigo,
  motorista: (l) => l.motorista,
  galpao: (l) => l.galpao,
  status: (l) => CHIP[l.status].texto,
  bancada: (l) => `${l.bancada.padStart(4, '0')}-${String(l.posicao ?? 0).padStart(4, '0')}`,
  tempo: (l) => l.tempoMin,
};

export function FilaAoVivo({ configuracoes }: { configuracoes?: ReactNode }) {
  const [busca, setBusca] = useState<EstadoBusca>(estadoInicial());
  const [ordem, setOrdem] = useState<Ordem | null>(null);
  const [pagina, setPagina] = useState(1);
  const numeros = (chave: string) => (busca.selecoes[chave] ?? []).map(Number);
  const consulta: Consulta = {
    tela: 'fila-ao-vivo',
    filtros: {
      texto: busca.texto,
      campo: busca.campoTexto as 'nome' | 'codigo',
      galpaoIds: numeros('galpao'),
      bancadaIds: numeros('bancada'),
      status: (busca.selecoes.status ?? []) as (typeof STATUS_FILA)[number][],
    },
  };
  const { dados, erro, recarregar } = useConsulta<Dados>(consulta, POLLING_MS);
  const [pendente, setPendente] = useState<Pendente>(null);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useAvisoTemporario();

  // contagem regressiva das chamadas, pelo relógio do servidor

  async function executar(acao: () => Promise<RespostaAdmin>) {
    setEnviando(true);
    try {
      const r = await acao();
      if (!r.ok && r.aviso) setAviso(r.aviso);
    } catch {
      setAviso(FALHA_AO_ENVIAR);
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

  const campos: Campo[] = [
    { chave: 'nome', rotulo: 'Nome', tipo: 'texto' },
    { chave: 'codigo', rotulo: 'Nº da senha', tipo: 'texto' },
    {
      chave: 'galpao',
      rotulo: 'Galpão',
      tipo: 'opcoes',
      opcoes: (dados?.galpoes ?? []).map((g) => ({ valor: String(g.id), rotulo: g.nome })),
    },
    {
      chave: 'bancada',
      rotulo: 'Bancada',
      tipo: 'opcoes',
      opcoes: (dados?.galpoes ?? []).flatMap((g) =>
        g.bancadas.map((b) => ({
          valor: String(b.id),
          rotulo: `${g.nome} · Bancada ${b.identificacao}`,
        })),
      ),
    },
    {
      chave: 'status',
      rotulo: 'Status',
      tipo: 'opcoes',
      opcoes: STATUS_FILA.map((s) => ({ valor: s, rotulo: CHIP[s].texto })),
    },
  ];
  // a fila inteira chega do servidor (as posições dependem de todas as senhas); a página e a
  // ordenação pelas colunas são feitas aqui, então ordenar vale para a fila toda (RF17-CA11)
  const todas = ordenarLocal(dados?.linhas ?? [], ordem, VALOR_DA_COLUNA);
  // a fila encolhe sozinha (chamadas concluídas): nunca fica numa página que deixou de existir
  const {
    linhas,
    pagina: paginaAtual,
    paginas,
  } = paginar(todas, pagina, POR_PAGINA_FILA);

  // qualquer mudança de filtro ou de ordem volta para a primeira página
  const mudarBusca = (e: EstadoBusca) => {
    setBusca(e);
    setPagina(1);
  };

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

      <BarraDeBusca campos={campos} estado={busca} aoMudar={mudarBusca} />

      {aviso || erro ? (
        <MensagemDeErro className="mt-base">
          {aviso ?? 'Sem conexão com o servidor. Tentando novamente…'}
        </MensagemDeErro>
      ) : null}

      <Tabela
        carregando={!dados}
        falhou={erro && !dados}
        vazia="Nenhum motorista na fila agora"
        ordem={ordem}
        aoOrdenar={(c) => {
          setOrdem(proximaOrdem(ordem, c));
          setPagina(1);
        }}
        colunas={[
          { titulo: 'Senha', ordenar: 'codigo' },
          { titulo: 'Motorista', ordenar: 'motorista' },
          { titulo: 'Galpão', ordenar: 'galpao' },
          { titulo: 'Status', ordenar: 'status' },
          { titulo: 'Posição/Bancada', ordenar: 'bancada' },
          { titulo: 'Tempo', classe: 'text-right', ordenar: 'tempo' },
          { titulo: 'Status de chamado', classe: 'w-[260px]' },
        ]}
      >
        {linhas.map((l) => (
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
                  <ContagemAtePrazo prazoEm={l.prazoEm!} agoraIso={dados!.agora} />
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

      <Paginacao
        pagina={paginaAtual}
        paginas={paginas}
        total={todas.length}
        aoMudar={setPagina}
      />

      {configuracoes}

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
