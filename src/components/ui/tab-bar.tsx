import Link from 'next/link';

type Aba = 'fila' | 'disponibilidade' | 'demonstrativo';

function Icone({ aba }: { aba: Aba }) {
  const comum = {
    width: 22,
    height: 22,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    viewBox: '0 0 24 24',
  };
  if (aba === 'fila') {
    return (
      <svg {...comum} aria-hidden>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M12 6v12" />
      </svg>
    );
  }
  if (aba === 'disponibilidade') {
    return (
      <svg {...comum} aria-hidden>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
    );
  }
  return (
    <svg {...comum} aria-hidden>
      <path d="M6 20v-6M12 20V8M18 20V4" />
    </svg>
  );
}

const ABAS: { aba: Aba; rotulo: string; href: string }[] = [
  { aba: 'fila', rotulo: 'Fila', href: '/fila' },
  { aba: 'disponibilidade', rotulo: 'Disponibilidade', href: '/em-breve?aba=disponibilidade' },
  { aba: 'demonstrativo', rotulo: 'Demonstrativo', href: '/em-breve?aba=demonstrativo' },
];

/** `Tab Bar` do Figma (Fila / Disponibilidade / Demonstrativo). RF16. */
export function TabBar({ ativa }: { ativa: Aba }) {
  return (
    <nav
      aria-label="Navegação principal"
      className="sticky bottom-0 mt-auto flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      {ABAS.map(({ aba, rotulo, href }) => (
        <Link
          key={aba}
          href={href}
          aria-current={aba === ativa ? 'page' : undefined}
          className={`t-caption flex flex-1 flex-col items-center gap-xs py-md ${
            aba === ativa ? 'text-primary' : 'text-text-muted'
          }`}
        >
          <Icone aba={aba} />
          {rotulo}
        </Link>
      ))}
    </nav>
  );
}
