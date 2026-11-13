/**
 * Job de 30 s (PRD §9.2): persiste expirações e aplica a virada do dia. A varredura é
 * idempotente, então é seguro rodar em duas instâncias durante a sobreposição de deploy.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.E2E_SEM_JOB === '1') return;
  const marca = globalThis as unknown as { __csmJob?: boolean };
  if (marca.__csmJob) return; // evita timers duplicados no HMR
  marca.__csmJob = true;

  const { iniciarJob } = await import('./server/job');
  iniciarJob();
}
