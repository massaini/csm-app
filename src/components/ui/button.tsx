import type { ButtonHTMLAttributes } from 'react';

type Kind = 'primary' | 'secondary' | 'danger' | 'reversed';

const ESTILO: Record<Kind, string> = {
  primary: 'bg-primary text-on-primary',
  secondary: 'border border-border-strong text-primary bg-transparent',
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
        'disabled:cursor-not-allowed disabled:bg-text-muted/60 disabled:text-on-primary disabled:border-transparent',
        className,
      ].join(' ')}
    />
  );
}
