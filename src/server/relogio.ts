import type { Clock } from '@/domain/clock';

const estado = globalThis as unknown as { __csmDesvioRelogioMs?: number };

/**
 * Relógio do app no servidor. Em produção é o relógio do sistema. Com `E2E=1`, os testes
 * ponta a ponta podem adiantá-lo (PRD §9.6), porque o `page.clock` do Playwright só controla
 * o navegador.
 */
export const relogioApp: Clock = {
  agora: () => new Date(Date.now() + (estado.__csmDesvioRelogioMs ?? 0)),
};

export const relogioControlavel = () => process.env.E2E === '1';

export function adiantarRelogio(ms: number) {
  if (!relogioControlavel()) throw new Error('Relógio só é controlável com E2E=1');
  estado.__csmDesvioRelogioMs = (estado.__csmDesvioRelogioMs ?? 0) + ms;
}

export function zerarRelogio() {
  if (!relogioControlavel()) throw new Error('Relógio só é controlável com E2E=1');
  estado.__csmDesvioRelogioMs = 0;
}
