import Link from 'next/link';
import { StatCard } from '@/components/ui/basicos';
import { TabBar } from '@/components/ui/tab-bar';
import { SairMotorista } from './sair';
import { relogioApp } from '@/server/relogio';
import { db } from '@/server/db';
import { historicoDoMotorista } from '@/server/fila-motorista';
import { exigirMotorista } from '@/server/http-sessao';

export const metadata = { title: 'Histórico · CSM Fila Digital' };

const dataHora = (iso: string) => {
  const d = new Date(iso);
  const fuso = { timeZone: 'America/Sao_Paulo' } as const;
  const data = d
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', ...fuso })
    .replace(/\./g, '')
    .replace(/ de /g, ' ');
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', ...fuso });
  return `${data} · ${hora}`;
};

/** Tela `19:64` — Histórico (RF15), sem o "Exportar" (P16) e com "Sair" no rodapé (RF04-CA3). */
export default async function PaginaHistorico() {
  const motorista = await exigirMotorista();
  const h = await historicoDoMotorista({ db, clock: relogioApp }, motorista.id);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col">
      <main className="flex flex-1 flex-col gap-base px-xl pb-xl pt-xl">
        <header className="flex items-center gap-md">
          <Link
            href="/fila"
            aria-label="Voltar para a fila"
            className="-ml-md flex h-[44px] w-[44px] items-center justify-center text-text-primary"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <path d="M19 12H5M11 6l-6 6 6 6" />
            </svg>
          </Link>
          <h1 className="t-title-l">Histórico</h1>
        </header>

        <div className="flex gap-md">
          <StatCard rotulo="Atendimentos" valor={h.atendimentos} />
          <StatCard
            rotulo="Espera média"
            valor={h.esperaMediaMin === null ? '—' : `${h.esperaMediaMin} min`}
            destaque
          />
        </div>

        <p className="t-overline mt-sm text-text-muted">Últimos atendimentos</p>
        {h.itens.length === 0 ? (
          <p className="t-body-m text-text-secondary">Você ainda não tem atendimentos</p>
        ) : (
          <ul className="flex flex-col gap-md">
            {h.itens.map((i) => (
              <li
                key={i.id}
                className="flex items-center justify-between gap-base rounded-lg border border-border-strong/60 bg-surface p-base"
              >
                <div>
                  <p className="t-body-m-strong">{dataHora(i.geradaEm)}</p>
                  <p className="t-body-s mt-xs text-text-muted">
                    Senha {i.codigo} · Bancada {i.bancada} · Rota {i.regiaoCodigo}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`t-body-m-strong ${i.totalMin === null ? 'text-text-muted' : 'text-primary'}`}
                  >
                    {i.totalMin === null ? '—' : `${i.totalMin} min`}
                  </p>
                  <p
                    className={`t-caption ${i.status === 'CONCLUIDA' ? 'text-success' : 'text-danger'}`}
                  >
                    {i.status === 'CONCLUIDA' ? 'Concluído' : 'Cancelada'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto pt-xl text-center">
          <SairMotorista />
        </div>
      </main>
      <TabBar ativa="fila" />
    </div>
  );
}
