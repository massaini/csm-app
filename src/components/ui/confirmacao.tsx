'use client';

import { useEffect, useRef } from 'react';
import { Button } from './button';

/**
 * Overlay de confirmação no padrão de `144:447` (cartão centralizado sobre fundo escurecido).
 * Usa <dialog> nativo: foco preso e Esc fecham sem alterar nada.
 */
export function Confirmacao({
  aberta,
  titulo,
  texto,
  confirmar,
  voltar = 'Voltar',
  perigo = false,
  pendente = false,
  aoConfirmar,
  aoFechar,
}: {
  aberta: boolean;
  titulo: string;
  texto: string;
  confirmar: string;
  voltar?: string;
  perigo?: boolean;
  pendente?: boolean;
  aoConfirmar: () => void;
  aoFechar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberta && !d.open) d.showModal();
    if (!aberta && d.open) d.close();
  }, [aberta]);

  return (
    <dialog
      ref={ref}
      onClose={aoFechar}
      className="m-auto w-[calc(100%-48px)] max-w-[342px] rounded-lg border border-border-strong bg-surface p-xl text-text-primary backdrop:bg-black/70"
    >
      <h2 className="t-title-m">{titulo}</h2>
      <p className="t-body-m mt-md text-text-secondary">{texto}</p>
      <div className="mt-xl flex flex-col gap-md">
        <Button kind={perigo ? 'danger' : 'primary'} disabled={pendente} onClick={aoConfirmar}>
          {confirmar}
        </Button>
        <Button kind="secondary" onClick={aoFechar} disabled={pendente}>
          {voltar}
        </Button>
      </div>
    </dialog>
  );
}
