import { describe, expect, it } from 'vitest';
import { FALHA_AO_ENVIAR, tentar } from './comum';

describe('ações do painel', () => {
  it('FE-04: tentar() devolve o resultado da server action', async () => {
    await expect(tentar(async () => ({ ok: true }))).resolves.toEqual({ ok: true });
  });

  it('FE-04: falha de rede ou do servidor vira null, sem rejeição', async () => {
    await expect(
      tentar(async () => {
        throw new TypeError('Failed to fetch');
      }),
    ).resolves.toBeNull();
    expect(FALHA_AO_ENVIAR).toMatch(/tente novamente\.$/);
  });
});
