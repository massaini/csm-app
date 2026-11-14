'use client';

import { Button } from './button';

/** Falha inesperada ao montar a tela (erro do servidor ou do banco). */
export function TelaDeErro({ aoTentarDeNovo }: { aoTentarDeNovo: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60dvh] w-full max-w-[430px] flex-col items-center justify-center gap-base px-xl text-center">
      <h1 className="t-title-l">Algo deu errado</h1>
      <p className="t-body-m text-text-secondary">
        Não foi possível carregar esta tela. Verifique sua internet e tente novamente.
      </p>
      <Button className="mt-base" onClick={aoTentarDeNovo}>
        Tentar novamente
      </Button>
    </main>
  );
}

export function Carregando() {
  return (
    <main aria-busy className="flex min-h-[60dvh] w-full items-center justify-center px-xl">
      <p role="status" className="t-body-m text-text-secondary">
        Carregando…
      </p>
    </main>
  );
}
