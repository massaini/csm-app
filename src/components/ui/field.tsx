import type { InputHTMLAttributes } from 'react';

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  erro?: string;
}

/** Componente `Input Field` do Figma: rótulo em Caption, campo em `surface` com borda. */
export function Field({ label, erro, id, className = '', ...props }: FieldProps) {
  const campo = id ?? props.name;
  return (
    <div className="flex flex-col gap-xs">
      <label htmlFor={campo} className="t-caption uppercase text-text-muted">
        {label}
      </label>
      <input
        id={campo}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${campo}-erro` : undefined}
        {...props}
        className={[
          't-body-l h-[56px] w-full rounded-md border bg-surface px-base text-text-primary',
          'placeholder:text-text-muted focus:border-primary focus:outline-none',
          erro ? 'border-danger' : 'border-border',
          className,
        ].join(' ')}
      />
      {erro ? (
        <p id={`${campo}-erro`} role="alert" className="t-body-s text-danger">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
