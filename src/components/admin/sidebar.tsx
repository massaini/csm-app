'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/ui/logo';

type Icone =
  | 'fila'
  | 'atendimentos'
  | 'senhas'
  | 'motoristas'
  | 'bancadas'
  | 'configuracoes'
  | 'administradores'
  | 'confirmacoes'
  | 'demonstrativos';

/** Ícones de 16 px da `Sidebar` do Figma; os itens que o Figma não tem seguem o mesmo traço. */
function IconeDoItem({ icone }: { icone: Icone }) {
  const comum = {
    width: 16,
    height: 16,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    'aria-hidden': true,
    className: 'shrink-0',
  };
  switch (icone) {
    case 'fila':
      return (
        <svg {...comum}>
          <circle cx="8" cy="8" r="6" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'atendimentos':
      return (
        <svg {...comum}>
          <path d="M2 4h12M2 8h12M2 12h12" />
        </svg>
      );
    case 'senhas':
      return (
        <svg {...comum}>
          <rect x="1.5" y="4" width="13" height="8" rx="1.5" />
          <path d="M8 4v8" />
        </svg>
      );
    case 'motoristas':
      return (
        <svg {...comum}>
          <circle cx="8" cy="5.5" r="2.5" />
          <path d="M3 14c.6-2.6 2.6-4 5-4s4.4 1.4 5 4" />
        </svg>
      );
    case 'bancadas':
      return (
        <svg {...comum}>
          <rect x="2" y="2" width="5" height="5" rx="1" />
          <rect x="9" y="2" width="5" height="5" rx="1" />
          <rect x="2" y="9" width="5" height="5" rx="1" />
          <rect x="9" y="9" width="5" height="5" rx="1" />
        </svg>
      );
    case 'configuracoes':
      return (
        <svg {...comum}>
          <path d="M2 4h7M12 4h2M2 12h2M7 12h7" />
          <circle cx="10.5" cy="4" r="1.5" />
          <circle cx="5.5" cy="12" r="1.5" />
        </svg>
      );
    case 'administradores':
      return (
        <svg {...comum}>
          <path d="M8 1.5 13.5 3.5v4c0 3.2-2.3 5.6-5.5 7-3.2-1.4-5.5-3.8-5.5-7v-4z" />
        </svg>
      );
    case 'confirmacoes':
      return (
        <svg {...comum}>
          <path d="m2.5 8.5 3.5 3.5 7.5-8" />
        </svg>
      );
    case 'demonstrativos':
      return (
        <svg {...comum}>
          <path d="M4 14V9M8 14V5M12 14V2" />
        </svg>
      );
  }
}

interface Item {
  href: string;
  rotulo: string;
  icone: Icone;
  /** fase futura ou fatia ainda não entregue: aparece desabilitado com "Em breve" */
  emBreve?: boolean;
  apenasSuper?: boolean;
}

const ITENS: Item[] = [
  { href: '/admin', rotulo: 'Fila ao Vivo', icone: 'fila' },
  { href: '/admin/atendimentos', rotulo: 'Histórico de Atendimentos', icone: 'atendimentos' },
  { href: '/admin/senhas', rotulo: 'Histórico de Senhas', icone: 'senhas' },
  { href: '/admin/motoristas', rotulo: 'Motoristas', icone: 'motoristas' },
  { href: '/admin/bancadas-regioes', rotulo: 'Bancadas e Regiões', icone: 'bancadas' },
  { href: '/admin/configuracoes', rotulo: 'Configurações', icone: 'configuracoes' },
  {
    href: '/admin/administradores',
    rotulo: 'Administradores',
    icone: 'administradores',
    apenasSuper: true,
  },
  { href: '#confirmacoes', rotulo: 'Confirmações', icone: 'confirmacoes', emBreve: true },
  { href: '#demonstrativos', rotulo: 'Demonstrativos', icone: 'demonstrativos', emBreve: true },
];

/** `Sidebar` do Figma (260 px): logo, navegação e rodapé com o admin logado. */
export function Sidebar({
  nome,
  papel,
  sair,
}: {
  nome: string;
  papel: 'ADMIN' | 'SUPER_ADMIN';
  sair: () => Promise<void>;
}) {
  const atual = usePathname();
  return (
    <aside className="sticky top-0 flex h-dvh w-[260px] shrink-0 flex-col border-r border-border bg-surface">
      <div className="px-xl pb-xl pt-2xl">
        <Logo largura={96} />
      </div>
      <hr className="border-border" />
      <nav aria-label="Painel" className="flex flex-col gap-xs p-md">
        {ITENS.filter((i) => !i.apenasSuper || papel === 'SUPER_ADMIN').map((i) =>
          i.emBreve ? (
            <span
              key={i.href}
              aria-disabled
              className="t-body-m flex items-center gap-md rounded-md px-md py-sm text-text-muted/70"
            >
              <IconeDoItem icone={i.icone} />
              {i.rotulo}
              <span className="t-caption ml-auto">Em breve</span>
            </span>
          ) : (
            <Link
              key={i.href}
              href={i.href}
              aria-current={atual === i.href ? 'page' : undefined}
              className={`t-body-m flex items-center gap-md rounded-md px-md py-sm ${
                atual === i.href
                  ? 'bg-elevated text-primary'
                  : 'text-text-secondary hover:bg-elevated/60'
              }`}
            >
              <IconeDoItem icone={i.icone} />
              {i.rotulo}
            </Link>
          ),
        )}
      </nav>
      <div className="mt-auto border-t border-border p-xl">
        <div className="flex items-center gap-md">
          <span
            aria-hidden
            className="t-body-m-strong flex h-[36px] w-[36px] items-center justify-center rounded-full bg-primary text-on-primary"
          >
            {nome.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="t-body-m-strong truncate">{nome}</p>
            <p className="t-caption text-text-muted">
              {papel === 'SUPER_ADMIN' ? 'Super-administrador' : 'Administrador'}
            </p>
          </div>
        </div>
        <form action={sair} className="mt-md">
          <button type="submit" className="t-body-s text-text-secondary underline">
            Sair
          </button>
        </form>
      </div>
    </aside>
  );
}
