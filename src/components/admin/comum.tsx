'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Confirmacao } from '@/components/ui/confirmacao';
import type { Consulta } from '@/server/filtros-admin';

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

  useEffect(() => {
    void recarregar();
    if (!pollingMs) return;
    const id = setInterval(recarregar, pollingMs);
    const aoVoltar = () => document.visibilityState === 'visible' && void recarregar();
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [recarregar, pollingMs]);

  return { dados, erro, recarregar };
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

const CAMPO =
  't-body-s h-[44px] w-full rounded-md border border-border bg-surface px-md text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none';

export function CampoFiltro({
  rotulo,
  children,
}: {
  rotulo: string;
  children: (classe: string) => ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-xs">
      <span className="t-overline text-text-muted">{rotulo}</span>
      {children(CAMPO)}
    </label>
  );
}

export function BarraDeFiltros({ children }: { children: ReactNode }) {
  return <div className="mt-xl flex gap-md">{children}</div>;
}

export interface Coluna {
  titulo: string;
  classe?: string;
}

/** Tabela do painel: cabeçalho elevado e linhas zebradas, com estado vazio. */
export function Tabela({
  colunas,
  vazia,
  children,
  carregando,
}: {
  colunas: Coluna[];
  vazia: string;
  carregando: boolean;
  children: ReactNode[];
}) {
  return (
    <div className="mt-xl overflow-x-auto rounded-lg border border-border-strong/60">
      <table className="w-full border-collapse text-left">
        <thead className="bg-elevated">
          <tr>
            {colunas.map((c) => (
              <th
                key={c.titulo}
                className={`t-overline px-base py-md text-text-secondary ${c.classe ?? ''}`}
              >
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr:nth-child(even)]:bg-surface [&>tr:nth-child(odd)]:bg-bg">
          {children.length === 0 ? (
            <tr>
              <td
                colSpan={colunas.length}
                className="t-body-m px-base py-2xl text-center text-text-secondary"
              >
                {carregando ? 'Carregando…' : vazia}
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
  if (paginas <= 1) return null;
  return (
    <div className="t-body-s mt-base flex items-center justify-end gap-md text-text-secondary">
      <span>
        Página {pagina} de {paginas} · {total} registros
      </span>
      <button
        className="rounded-md border border-border px-md py-xs disabled:opacity-40"
        disabled={pagina <= 1}
        onClick={() => aoMudar(pagina - 1)}
      >
        Anterior
      </button>
      <button
        className="rounded-md border border-border px-md py-xs disabled:opacity-40"
        disabled={pagina >= paginas}
        onClick={() => aoMudar(pagina + 1)}
      >
        Próxima
      </button>
    </div>
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
      {erro ? (
        <p role="alert" className="t-body-s text-danger">
          {erro}
        </p>
      ) : null}
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
