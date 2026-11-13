'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { FLAG_AGORA_NAO, ativarNotificacoes, iphoneSemInstalar } from '@/components/push-cliente';

const nunca = () => () => {};

export function AtivarNotificacoes({ chavePublica }: { chavePublica: string }) {
  const router = useRouter();
  const [ativando, setAtivando] = useState(false);
  const [negada, setNegada] = useState(false);
  // decidido só no navegador (no servidor não há navigator)
  const precisaInstalar = useSyncExternalStore(nunca, iphoneSemInstalar, () => false);

  async function ativar() {
    setAtivando(true);
    const p = await ativarNotificacoes(chavePublica);
    setAtivando(false);
    if (p === 'granted') router.replace('/fila');
    else setNegada(true);
  }

  function agoraNao() {
    try {
      localStorage.setItem(FLAG_AGORA_NAO, '1');
    } catch {
      /* armazenamento indisponível: a pergunta volta no próximo login de qualquer forma */
    }
    router.replace('/fila');
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-xl pb-xl pt-3xl text-center">
      <header className="flex flex-col items-center">
        <Logo />
        <div
          aria-hidden
          className="mt-2xl flex h-[96px] w-[96px] items-center justify-center rounded-full bg-primary/15"
        >
          <svg
            width="44"
            height="44"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#f5c518"
            strokeWidth="1.8"
          >
            <path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9" />
            <path d="M10 20a2 2 0 0 0 4 0" />
          </svg>
        </div>
        <h1 className="t-title-l mt-xl">Ative as notificações</h1>
        <p className="t-body-m mt-md text-text-secondary">
          Assim você é avisado quando for chamado para a bancada, mesmo com o celular no bolso.
        </p>
      </header>

      <div className="mt-auto flex flex-col gap-md pt-2xl">
        {precisaInstalar ? (
          <div className="t-body-m rounded-lg border border-border-strong/60 bg-surface p-base text-left text-text-secondary">
            <p className="t-body-m-strong text-text-primary">No iPhone, instale o app primeiro</p>
            <p className="mt-sm">
              Abra no Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”. As
              notificações só funcionam com o app instalado.
            </p>
            <Link href="/instalar" className="mt-sm inline-block text-primary underline">
              Ver o passo a passo
            </Link>
          </div>
        ) : (
          <Button disabled={ativando || !chavePublica} onClick={() => void ativar()}>
            {ativando ? 'Ativando…' : 'Ativar notificações'}
          </Button>
        )}
        {negada ? (
          <p role="alert" className="t-body-s text-danger">
            As notificações foram bloqueadas. Mantenha o app aberto para ver a chamada ou libere nas
            configurações do navegador.
          </p>
        ) : null}
        <button className="t-body-m py-sm text-text-secondary underline" onClick={agoraNao}>
          Agora não
        </button>
      </div>
    </main>
  );
}
