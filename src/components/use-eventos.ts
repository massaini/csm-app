'use client';

import { useEffect, useRef, useState } from 'react';

/** Intervalo do polling: 4 s sem SSE (RNF01-CA1); com SSE, só uma rede de segurança. */
export const POLLING_SEM_SSE_MS = 4_000;
export const POLLING_COM_SSE_MS = 30_000;

/**
 * Assina o SSE de `/api/stream`. Cada evento só invalida: chama `aoEvento` (agrupando rajadas
 * em 250 ms), e o chamador refaz o fetch do estado. Também refaz ao reconectar, porque eventos
 * podem ter se perdido. Devolve se o SSE está conectado. `url` vazia desliga.
 */
export function useEventos(url: string, aoEvento: () => void): boolean {
  const [conectado, setConectado] = useState(false);
  const callback = useRef(aoEvento);
  useEffect(() => {
    callback.current = aoEvento;
  }, [aoEvento]);

  useEffect(() => {
    if (!url || typeof EventSource === 'undefined') return;
    const fonte = new EventSource(url);
    let agrupando: ReturnType<typeof setTimeout> | null = null;
    const disparar = () => {
      if (agrupando) return;
      agrupando = setTimeout(() => {
        agrupando = null;
        callback.current();
      }, 250);
    };
    fonte.onopen = () => {
      setConectado(true);
      disparar(); // pode ter perdido eventos enquanto estava desconectado
    };
    fonte.onmessage = disparar;
    fonte.onerror = () => setConectado(false); // o EventSource reconecta sozinho (retry: 3000)
    return () => {
      if (agrupando) clearTimeout(agrupando);
      fonte.close();
    };
  }, [url]);

  return conectado;
}
