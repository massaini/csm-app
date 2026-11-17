'use client';

import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { Button } from '@/components/ui/button';
import { Confirmacao } from '@/components/ui/confirmacao';
import { POLLING_COM_SSE_MS, useEventos } from '@/components/use-eventos';
import type { Consulta } from '@/server/filtros-admin';
import { MensagemDeErro } from '@/components/ui/basicos';

type RespostaConsulta<T> = { tipo: 'ok'; dados: T } | { tipo: 'login' } | { tipo: 'erro' };

async function buscarConsulta<T>(corpo: string): Promise<RespostaConsulta<T>> {
  try {
    const r = await fetch('/api/admin/consulta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: corpo,
      cache: 'no-store',
    });
    if (r.status === 401) return { tipo: 'login' };
    if (!r.ok) return { tipo: 'erro' };
    return { tipo: 'ok', dados: (await r.json()) as T };
  } catch {
    return { tipo: 'erro' };
  }
}

/** Busca os dados de uma tela do painel por POST; com `pollingMs`, recarrega sozinho. */
export function useConsulta<T>(consulta: Consulta, pollingMs?: number) {
  const router = useRouter();
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState(false);
  const chave = JSON.stringify(consulta);
  // descarta respostas de filtros antigos que chegarem depois das novas
  const ultima = useRef(chave);
  useEffect(() => {
    ultima.current = chave;
  }, [chave]);

  const recarregar = useCallback(
    () =>
      buscarConsulta<T>(chave).then((r) => {
        if (r.tipo === 'login') return router.replace('/admin/login');
        if (r.tipo === 'erro') return setErro(true);
        if (ultima.current === chave) {
          setDados(r.dados);
          setErro(false);
        }
      }),
    [chave, router],
  );

  // tempo real só nas telas ao vivo (com polling); os históricos carregam sob demanda
  const sseConectado = useEventos(
    pollingMs ? '/api/stream?perfil=admin' : '',
    () => void recarregar(),
  );

  useEffect(() => {
    void recarregar();
    if (!pollingMs) return;
    const id = setInterval(recarregar, sseConectado ? POLLING_COM_SSE_MS : pollingMs);
    const aoVoltar = () => document.visibilityState === 'visible' && void recarregar();
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [recarregar, pollingMs, sseConectado]);

  return { dados, erro, recarregar };
}

export const FALHA_AO_ENVIAR =
  'Não foi possível concluir. Verifique sua internet e tente novamente.';

/** Roda uma server action; falha de rede ou do servidor devolve `null` em vez de travar a tela. */
export async function tentar<T>(acao: () => Promise<T>): Promise<T | null> {
  try {
    return await acao();
  } catch {
    return null;
  }
}

/** "Agora" no relógio do servidor, atualizado a cada segundo (contagens do painel). */
export function useAgoraServidor(agoraIso: string | undefined): number | null {
  const desvio = useRef(0);
  const [agora, setAgora] = useState<number | null>(null);
  useEffect(() => {
    if (agoraIso) desvio.current = Date.parse(agoraIso) - Date.now();
  }, [agoraIso]);
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now() + desvio.current), 1_000);
    return () => clearInterval(id);
  }, []);
  return agora;
}

export function CabecalhoDaTela({
  titulo,
  subtitulo,
  acao,
}: {
  titulo: string;
  subtitulo: ReactNode;
  acao?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-xl">
      <div>
        <p className="t-caption text-text-muted">Administrador › {titulo}</p>
        <h1 className="t-title-l mt-xs">{titulo}</h1>
        <p className="t-body-s mt-sm text-text-secondary">{subtitulo}</p>
      </div>
      {acao}
    </header>
  );
}

export function LinhaDeKpis({ children }: { children: ReactNode }) {
  return <div className="mt-xl flex gap-base">{children}</div>;
}

export function Kpi({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: ReactNode;
  destaque?: boolean;
}) {
  return (
    <div className="flex-1 rounded-lg border border-border-strong/60 bg-surface px-xl py-base">
      <p className="t-overline text-text-muted">{rotulo}</p>
      <p className={`t-title-l mt-xs ${destaque ? 'text-primary' : ''}`}>{valor}</p>
    </div>
  );
}

/**
 * Botão pequeno das ações em linha das tabelas do painel. `perigo` usa a cor danger (desativar);
 * a cor vem por prop porque duas classes text-* juntas não têm ordem garantida.
 */
export function BotaoDaTabela({
  perigo = false,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { perigo?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={`t-button-m h-[32px] whitespace-nowrap rounded-md border border-border-strong px-md disabled:opacity-40 ${
        perigo ? 'text-danger' : 'text-primary'
      } ${className}`}
    />
  );
}

export interface Coluna {
  titulo: string;
  classe?: string;
  /** chave de ordenação; sem ela a coluna não ordena (RF31-CA3) */
  ordenar?: string;
}

function SetaDeOrdem({ direcao }: { direcao: 'asc' | 'desc' | null }) {
  return (
    <svg
      aria-hidden
      width="10"
      height="12"
      viewBox="0 0 10 12"
      className={direcao ? 'text-primary' : 'text-text-muted'}
    >
      <path d="M5 1 8.5 5h-7z" fill="currentColor" opacity={direcao === 'desc' ? 0.35 : 1} />
      <path d="M5 11 1.5 7h7z" fill="currentColor" opacity={direcao === 'asc' ? 0.35 : 1} />
    </svg>
  );
}

/** Tabela do painel: cabeçalho elevado, linhas zebradas, estados vazio/carregando/falha e ordenação. */
export function Tabela({
  colunas,
  vazia,
  children,
  carregando,
  falhou = false,
  ordem = null,
  aoOrdenar,
}: {
  colunas: Coluna[];
  vazia: string;
  carregando: boolean;
  /** a primeira carga falhou: não há dados para mostrar */
  falhou?: boolean;
  ordem?: { coluna: string; direcao: 'asc' | 'desc' } | null;
  aoOrdenar?: (coluna: string) => void;
  children: ReactNode[];
}) {
  return (
    <div className="mt-xl overflow-x-auto rounded-lg border border-border-strong/60">
      <table className="w-full border-collapse text-left">
        <thead className="bg-elevated">
          <tr>
            {colunas.map((c) => {
              const ativa = c.ordenar && ordem?.coluna === c.ordenar ? ordem.direcao : null;
              return (
                <th
                  key={c.titulo || 'acoes'}
                  aria-sort={
                    ativa === 'asc' ? 'ascending' : ativa === 'desc' ? 'descending' : undefined
                  }
                  className={`t-overline px-base py-md text-text-secondary ${c.classe ?? ''}`}
                >
                  {c.ordenar && aoOrdenar ? (
                    <button
                      type="button"
                      onClick={() => aoOrdenar(c.ordenar!)}
                      className="t-overline -mx-xs inline-flex items-center gap-xs rounded-sm px-xs uppercase hover:text-text-primary"
                    >
                      {c.titulo}
                      <SetaDeOrdem direcao={ativa} />
                    </button>
                  ) : c.titulo ? (
                    c.titulo
                  ) : (
                    <span className="sr-only">Ações</span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="[&>tr:nth-child(even)]:bg-surface [&>tr:nth-child(odd)]:bg-bg">
          {children.length === 0 ? (
            <tr>
              <td
                colSpan={colunas.length}
                className="t-body-m px-base py-2xl text-center text-text-secondary"
              >
                {falhou ? 'Não foi possível carregar.' : carregando ? 'Carregando…' : vazia}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Recorta uma lista já ordenada em páginas (RF17-CA11). Se a lista encolher e a página pedida
 * deixar de existir, devolve a última.
 */
export function paginar<T>(itens: T[], pagina: number, porPagina: number) {
  const paginas = Math.max(1, Math.ceil(itens.length / porPagina));
  const atual = Math.min(Math.max(1, pagina), paginas);
  return {
    linhas: itens.slice((atual - 1) * porPagina, atual * porPagina),
    pagina: atual,
    paginas,
  };
}

/**
 * Barra de paginação das tabelas do painel (RF17-CA11, RF20-CA4). Aparece sempre que há
 * registros, mesmo com uma página só, para o admin ver o total e saber que a lista é paginada.
 */
export function Paginacao({
  pagina,
  paginas,
  total,
  aoMudar,
}: {
  pagina: number;
  paginas: number;
  total: number;
  aoMudar: (p: number) => void;
}) {
  if (total === 0) return null;
  return (
    <nav
      aria-label="Paginação"
      className="t-body-s mt-base flex items-center justify-end gap-md text-text-secondary"
    >
      <span>
        Página {pagina} de {paginas} · {total} {total === 1 ? 'registro' : 'registros'}
      </span>
      <button
        type="button"
        className="rounded-md border border-border px-md py-xs disabled:opacity-40"
        disabled={pagina <= 1}
        onClick={() => aoMudar(pagina - 1)}
      >
        Anterior
      </button>
      <button
        type="button"
        className="rounded-md border border-border px-md py-xs disabled:opacity-40"
        disabled={pagina >= paginas}
        onClick={() => aoMudar(pagina + 1)}
      >
        Próxima
      </button>
    </nav>
  );
}

/** Botão "Exportar" com o modal `216:470` e o download do CSV (RF22). */
export function BotaoExportar({ consulta }: { consulta: Consulta }) {
  const [aberto, setAberto] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function exportar() {
    setBaixando(true);
    setErro(null);
    try {
      const r = await fetch('/api/admin/exportar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(consulta),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErro(j.mensagem ?? 'Não foi possível exportar.');
        return;
      }
      const nome =
        /filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') ?? '')?.[1] ?? 'export.csv';
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = nome;
      a.click();
      URL.revokeObjectURL(url);
      setAberto(false);
    } finally {
      setBaixando(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-xs">
      <Button kind="secondary" bloco={false} className="w-[228px]" onClick={() => setAberto(true)}>
        ↓ Exportar
      </Button>
      {erro ? <MensagemDeErro>{erro}</MensagemDeErro> : null}
      <Confirmacao
        aberta={aberto}
        titulo="Exportar?"
        texto="Isso vai baixar os dados desta tabela para o seu computador."
        confirmar={baixando ? 'Exportando…' : 'Sim, exportar'}
        voltar="Cancelar"
        pendente={baixando}
        aoFechar={() => setAberto(false)}
        aoConfirmar={() => void exportar()}
      />
    </div>
  );
}

export function useAvisoTemporario() {
  const [aviso, setAviso] = useState<string | null>(null);
  useEffect(() => {
    if (!aviso) return;
    const id = setTimeout(() => setAviso(null), 5_000);
    return () => clearTimeout(id);
  }, [aviso]);
  return [aviso, setAviso] as const;
}
