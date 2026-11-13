'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Diálogo modal genérico (mesmo visual do overlay `144:447`), para formulários. */
export function Dialogo({
  aberto,
  titulo,
  aoFechar,
  children,
  largura = 420,
}: {
  aberto: boolean;
  titulo: string;
  aoFechar: () => void;
  children: ReactNode;
  largura?: number;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);
  return (
    <dialog
      ref={ref}
      onClose={aoFechar}
      style={{ maxWidth: largura }}
      className="m-auto w-[calc(100%-48px)] rounded-lg border border-border-strong bg-surface p-xl text-text-primary backdrop:bg-black/70"
    >
      <h2 className="t-title-m mb-base">{titulo}</h2>
      {aberto ? children : null}
    </dialog>
  );
}

/** Mostra uma senha temporária uma única vez (RF24-CA1). */
export function SenhaTemporaria({ senha, para }: { senha: string; para: string }) {
  return (
    <div className="flex flex-col gap-md">
      <p className="t-body-m text-text-secondary">
        Senha temporária de <strong className="text-text-primary">{para}</strong>. Ela aparece só
        agora, vale por 72 horas e precisa ser trocada no primeiro acesso.
      </p>
      <p className="t-display-m rounded-md bg-elevated py-base text-center font-mono tracking-[4px] text-primary">
        {senha}
      </p>
    </div>
  );
}
