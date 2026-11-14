import type { Metadata } from 'next';
import { VoltarAoInicio } from './voltar-ao-inicio';

export const metadata: Metadata = { title: 'Página não encontrada · CSM Fila Digital' };

export default function NaoEncontrada() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col items-center justify-center gap-base px-xl text-center">
      <p className="t-overline text-text-muted">Erro 404</p>
      <h1 className="t-title-l">Página não encontrada</h1>
      <p className="t-body-m text-text-secondary">
        O endereço pode estar errado ou a página não existe mais.
      </p>
      <VoltarAoInicio />
    </main>
  );
}
