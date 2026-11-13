import { TabBar } from '@/components/ui/tab-bar';
import { exigirMotorista } from '@/server/http-sessao';

export const metadata = { title: 'Em breve · CSM Fila Digital' };

/** RF16-CA2 — abas Disponibilidade e Demonstrativo (fases futuras). */
export default async function PaginaEmBreve({ searchParams }: PageProps<'/em-breve'>) {
  await exigirMotorista();
  const { aba } = await searchParams;
  const ativa = aba === 'demonstrativo' ? 'demonstrativo' : 'disponibilidade';
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col">
      <main className="flex flex-1 flex-col items-center justify-center gap-md px-xl text-center">
        <h1 className="t-title-l">Em breve</h1>
        <p className="t-body-m text-text-secondary">Esta função chega na próxima versão do app.</p>
      </main>
      <TabBar ativa={ativa} />
    </div>
  );
}
