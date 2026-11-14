'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Na 404, quem estava no painel volta ao painel; os demais, ao início do app. */
export function VoltarAoInicio() {
  const doPainel = usePathname()?.startsWith('/admin');
  return (
    <Link
      href={doPainel ? '/admin' : '/'}
      className="t-button-l mt-base inline-flex h-[54px] w-full items-center justify-center rounded-md bg-primary px-base text-on-primary"
    >
      {doPainel ? 'Voltar ao painel' : 'Voltar ao início'}
    </Link>
  );
}
