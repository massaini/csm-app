'use client';

import { useState } from 'react';
import { sairMotorista } from '@/app/acesso-actions';
import { FLAG_AGORA_NAO, endpointAtual } from '@/components/push-cliente';

/** RF04-CA2/CA3 — "Sair" apaga a inscrição de push do aparelho e o "Agora não" (RF05-CA6). */
export function SairMotorista() {
  const [saindo, setSaindo] = useState(false);
  const [falhou, setFalhou] = useState(false);
  async function sair() {
    setSaindo(true);
    setFalhou(false);
    const dados = new FormData();
    try {
      localStorage.removeItem(FLAG_AGORA_NAO);
    } catch {
      /* sem armazenamento */
    }
    const endpoint = await endpointAtual().catch(() => null);
    if (endpoint) dados.set('endpointPush', endpoint);
    try {
      await sairMotorista(dados);
    } catch {
      setSaindo(false);
      setFalhou(true);
    }
  }
  return (
    <>
      {falhou ? (
        <p role="alert" className="t-body-s text-danger">
          Não foi possível sair. Verifique sua internet e tente de novo.
        </p>
      ) : null}
      <button
        type="button"
        disabled={saindo}
        onClick={() => void sair()}
        className="t-body-m inline-flex min-h-[44px] items-center text-text-secondary underline disabled:opacity-50"
      >
        {saindo ? 'Saindo…' : 'Sair'}
      </button>
    </>
  );
}
