'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { POLLING_COM_SSE_MS, POLLING_SEM_SSE_MS, useEventos } from '@/components/use-eventos';
import type { EstadoMotorista } from '@/server/fila-motorista';
import type { RespostaDaAcao } from './actions';

const ESPERAS_REPETICAO_MS = [1_000, 2_000, 4_000]; // RF30-CA1: 1 envio + 3 repetições

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Estado de /fila no cliente: começa com o renderizado no servidor, refaz o fetch a cada 4 s
 * e ao voltar para o primeiro plano (RF11-CA4), e mede o desvio entre o relógio do aparelho e
 * o do servidor para as contagens (RF13-CA1).
 */
export function useEstadoFila(inicial: EstadoMotorista) {
  const [estado, setEstado] = useState(inicial);
  const [semConexao, setSemConexao] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const router = useRouter();
  const desvioRef = useRef<number | null>(null);
  useEffect(() => {
    desvioRef.current = Date.parse(inicial.agora) - Date.now();
  }, [inicial.agora]);

  const aplicar = useCallback((novo: EstadoMotorista) => {
    desvioRef.current = Date.parse(novo.agora) - Date.now();
    setEstado(novo);
  }, []);

  const recarregar = useCallback(async () => {
    try {
      const r = await fetch('/api/fila/estado', { cache: 'no-store' });
      if (r.status === 401) {
        router.replace('/login');
        return;
      }
      if (r.ok) {
        aplicar(await r.json());
        setSemConexao(false);
      }
    } catch {
      setSemConexao(true);
    }
  }, [aplicar, router]);

  const sseConectado = useEventos('/api/stream', () => void recarregar());

  useEffect(() => {
    const id = setInterval(recarregar, sseConectado ? POLLING_COM_SSE_MS : POLLING_SEM_SSE_MS);
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void recarregar();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [recarregar, sseConectado]);

  /** Executa uma ação com repetição automática em falha de rede (RF30). */
  const executar = useCallback(
    async (acao: () => Promise<RespostaDaAcao>): Promise<RespostaDaAcao | null> => {
      setEnviando(true);
      try {
        for (let tentativa = 0; ; tentativa++) {
          try {
            const r = await acao();
            aplicar(r.estado);
            setSemConexao(false);
            return r;
          } catch {
            if (tentativa >= ESPERAS_REPETICAO_MS.length) {
              setSemConexao(true);
              return null;
            }
            await espera(ESPERAS_REPETICAO_MS[tentativa]);
          }
        }
      } finally {
        setEnviando(false);
      }
    },
    [aplicar],
  );

  /** "Agora" no relógio do servidor. */
  const agoraDoEstado = Date.parse(estado.agora);
  const agoraServidor = useCallback(
    () => (desvioRef.current === null ? agoraDoEstado : Date.now() + desvioRef.current),
    [agoraDoEstado],
  );

  return { estado, semConexao, enviando, recarregar, executar, agoraServidor };
}

/** Re-renderiza a cada `ms` (contagens e cronômetros). */
export function useTique(ms = 1_000) {
  const [, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}
