'use client';

import { useState } from 'react';
import { sairMotorista } from '@/app/acesso-actions';
import { FLAG_AGORA_NAO, endpointAtual } from '@/components/push-cliente';

/** RF04-CA2/CA3 — "Sair" apaga a inscrição de push do aparelho e o "Agora não" (RF05-CA6). */
export function SairMotorista() {
  const [saindo, setSaindo] = useState(false);
  async function sair() {
    setSaindo(true);
    const dados = new FormData();
    try {
      localStorage.removeItem(FLAG_AGORA_NAO);
    } catch {
      /* sem armazenamento */
    }
    const endpoint = await endpointAtual().catch(() => null);
    if (endpoint) dados.set('endpointPush', endpoint);
    await sairMotorista(dados);
  }
  return (
    <button
      type="button"
      disabled={saindo}
      onClick={() => void sair()}
      className="t-body-m text-text-secondary underline disabled:opacity-50"
    >
      {saindo ? 'Saindo…' : 'Sair'}
    </button>
  );
}
