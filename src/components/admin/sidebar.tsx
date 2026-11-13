'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/ui/logo';

interface Item {
  href: string;
  rotulo: string;
  /** fase futura ou fatia ainda não entregue: aparece desabilitado com "Em breve" */
  emBreve?: boolean;
  apenasSuper?: boolean;
}

const ITENS: Item[] = [
  { href: '/admin', rotulo: 'Fila ao Vivo' },
  { href: '/admin/atendimentos', rotulo: 'Histórico de Atendimentos' },
  { href: '/admin/senhas', rotulo: 'Histórico de Senhas' },
  { href: '/admin/motoristas', rotulo: 'Motoristas', emBreve: true },
  { href: '/admin/bancadas-regioes', rotulo: 'Bancadas e Regiões', emBreve: true },
  { href: '/admin/configuracoes', rotulo: 'Configurações', emBreve: true },
  { href: '/admin/administradores', rotulo: 'Administradores', emBreve: true, apenasSuper: true },
  { href: '#confirmacoes', rotulo: 'Confirmações', emBreve: true },
  { href: '#demonstrativos', rotulo: 'Demonstrativos', emBreve: true },
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
              className="t-body-m flex items-center justify-between rounded-md px-md py-sm text-text-muted/70"
            >
              {i.rotulo}
              <span className="t-caption">Em breve</span>
            </span>
          ) : (
            <Link
              key={i.href}
              href={i.href}
              aria-current={atual === i.href ? 'page' : undefined}
              className={`t-body-m rounded-md px-md py-sm ${
                atual === i.href
                  ? 'bg-elevated text-primary'
                  : 'text-text-secondary hover:bg-elevated/60'
              }`}
            >
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
