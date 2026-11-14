import type { ButtonHTMLAttributes } from 'react';

type Kind = 'primary' | 'secondary' | 'danger' | 'reversed';

const ESTILO: Record<Kind, string> = {
  // desabilitado em cinza, como o "Gerar senha" bloqueado de `12:2` (RF09-CA2)
  primary: 'bg-primary text-on-primary disabled:bg-text-muted/60',
  secondary: 'border border-border-strong text-text-primary bg-transparent',
  danger: 'border border-danger text-danger bg-transparent',
  reversed: 'bg-on-primary text-primary',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  kind?: Kind;
  /** botão de largura total (padrão das telas do motorista) */
  bloco?: boolean;
}

/** Componente `Button` do Figma: Kind (Primary/Secondary/Reversed/Danger) × estado desabilitado. */
export function Button({ kind = 'primary', bloco = true, className = '', ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={[
        't-button-l h-[54px] rounded-md px-base transition-opacity',
        bloco ? 'w-full' : '',
        ESTILO[kind],
        kind === 'primary'
          ? 'disabled:cursor-not-allowed'
          : 'disabled:cursor-not-allowed disabled:opacity-40',
        className,
      ].join(' ')}
    />
  );
}
