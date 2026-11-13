import type { ReactNode } from 'react';

type Tom = 'success' | 'warning' | 'primary' | 'neutral' | 'danger';

const TOM: Record<Tom, string> = {
  success: 'text-success border-success/60 bg-success/15',
  warning: 'text-primary border-primary/60 bg-primary/15',
  primary: 'text-primary border-primary/60 bg-primary/15',
  neutral: 'text-text-secondary border-border-strong bg-text-muted/15',
  danger: 'text-danger border-danger/60 bg-danger/15',
};

/** `Chip` do Figma: pílula com ponto, texto Overline e fundo do tom a 15%. */
export function Chip({ tom, children }: { tom: Tom; children: ReactNode }) {
  return (
    <span
      className={`t-overline inline-flex items-center gap-sm rounded-full border px-md py-xs ${TOM[tom]}`}
    >
      <span aria-hidden className="h-[8px] w-[8px] shrink-0 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-border-strong/60 bg-surface p-xl ${className}`}>
      {children}
    </section>
  );
}

/** `Info Row` do Figma: rótulo à esquerda, valor em destaque à direita. */
export function InfoRow({ rotulo, valor }: { rotulo: string; valor: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-base py-sm">
      <dt className="t-body-m text-text-muted">{rotulo}</dt>
      <dd className="t-body-m-strong text-right">{valor}</dd>
    </div>
  );
}

/** `Stat Card` do Figma (Default / Primary). */
export function StatCard({
  rotulo,
  valor,
  destaque = false,
}: {
  rotulo: string;
  valor: ReactNode;
  destaque?: boolean;
}) {
  return (
    <div className="flex-1 rounded-lg border border-border-strong/60 bg-surface p-base">
      <p className="t-overline text-text-muted">{rotulo}</p>
      <p className={`t-title-l mt-xs ${destaque ? 'text-primary' : ''}`}>{valor}</p>
    </div>
  );
}

/** `Alert Banner` do Figma: ícone circular amarelo com "i"/"!" e texto. */
export function AlertBanner({
  titulo,
  children,
  icone = 'i',
}: {
  titulo?: string;
  children: ReactNode;
  icone?: 'i' | '!';
}) {
  return (
    <div className="flex items-center gap-md rounded-md bg-elevated px-base py-md">
      <span
        aria-hidden
        className="t-body-m-strong flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full bg-primary text-on-primary"
      >
        {icone}
      </span>
      <div>
        {titulo ? <p className="t-body-m-strong">{titulo}</p> : null}
        <div className="t-body-s text-text-secondary">{children}</div>
      </div>
    </div>
  );
}
