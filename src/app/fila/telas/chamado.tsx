'use client';

import { useEffect, useRef } from 'react';
import { acaoEstouACaminho } from '../actions';
import type { EstadoDa, Fila } from '../tela-fila';
import { useTique } from '../use-estado-fila';

function mmss(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Tela `18:2` — Chamado. RF13: contagem pelo relógio do servidor e "Confirme agora" na carência. */
export function TelaChamado({ estado, fila }: { estado: EstadoDa<'CHAMADA'>; fila: Fila }) {
  useTique(500);
  const agora = fila.agoraServidor();
  const restante = Date.parse(estado.prazoEm) - agora;
  const dentroDaCarencia = restante <= 0 && agora <= Date.parse(estado.limiteEm);
  const passouDoLimite = agora > Date.parse(estado.limiteEm);

  // RF13-CA4: passado o limite, pergunta ao servidor (que decide se perdeu a vez)
  const jaPerguntou = useRef(false);
  const { recarregar } = fila;
  useEffect(() => {
    if (passouDoLimite && !jaPerguntou.current) {
      jaPerguntou.current = true;
      void recarregar();
    }
  }, [passouDoLimite, recarregar]);

  return (
    <main className="flex flex-1 flex-col items-center bg-primary px-xl pb-xl pt-3xl text-on-primary">
      <div
        aria-hidden
        className="flex h-[120px] w-[120px] items-center justify-center rounded-full border-[3px] border-on-primary"
      >
        <div className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-on-primary text-primary">
          <span className="text-[48px] font-bold leading-none">!</span>
        </div>
      </div>
      <p className="t-overline mt-xl">Você foi chamado</p>
      <h1 className="t-title-m mt-md">Dirija-se à bancada</h1>
      <p className="mt-base text-[160px] font-bold leading-none tracking-[-4px]">
        {estado.senha.bancada}
      </p>
      <p className="t-body-m mt-xl rounded-full border-2 border-on-primary px-xl py-sm">
        <span className="t-overline mr-sm">Senha</span>
        <span className="t-title-s">{estado.senha.codigo}</span>
      </p>

      <div className="mt-auto w-full pt-2xl">
        <button
          className="t-button-l h-[54px] w-full rounded-md bg-on-primary text-primary disabled:opacity-60"
          disabled={fila.enviando || passouDoLimite}
          onClick={() => void fila.executar(() => acaoEstouACaminho(estado.senha.id))}
        >
          {fila.enviando ? 'Enviando…' : dentroDaCarencia ? 'Confirme agora' : 'Estou a caminho'}
        </button>
        <p className="t-body-s mt-md text-center">
          Apresente-se na bancada em até {estado.toleranciaMin} minutos.
        </p>
        {restante > 0 ? (
          <p className="t-body-m-strong mt-xs text-center" aria-live="polite">
            Restam {mmss(restante)}
          </p>
        ) : null}
      </div>
    </main>
  );
}
