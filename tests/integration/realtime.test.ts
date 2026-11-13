import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { notificar, ouvinte, type EventoFila } from '@/server/realtime';
import { chamarSenha, gerarSenha } from '@/server/senhas';
import { PLACA, cenario, db, dentro, limpar, novoMotorista, novoRelogio } from './helpers';

let c: Awaited<ReturnType<typeof cenario>>;
let clock: ReturnType<typeof novoRelogio>;
const recebidos: EventoFila[] = [];
const guardar = (e: EventoFila) => recebidos.push(e);

/** Espera até `ms` por um evento que satisfaça a condição. */
async function esperar(condicao: (e: EventoFila) => boolean, ms = 3_000) {
  const ate = Date.now() + ms;
  while (Date.now() < ate) {
    if (recebidos.some(condicao)) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return false;
}

beforeAll(async () => {
  ouvinte.on('evento', guardar);
  ouvinte.iniciar(process.env.DATABASE_URL_TEST);
  await new Promise((r) => setTimeout(r, 500)); // tempo para o LISTEN subir
});
beforeEach(async () => {
  await limpar();
  c = await cenario();
  clock = novoRelogio();
  recebidos.length = 0;
});
afterAll(async () => {
  ouvinte.off('evento', guardar);
  await db.$disconnect();
});

describe('tempo real (NOTIFY → LISTEN)', () => {
  it('Tempo real: cada transição da senha publica um evento com o id da senha', async () => {
    const m = await novoMotorista(c.regiao.id);
    const g = await gerarSenha(
      { db, clock },
      { motoristaId: m.id, galpaoId: c.galpao.id, placa: PLACA, leitura: dentro },
    );
    expect(await esperar((e) => e.senhaId === g.senha!.id)).toBe(true);
    recebidos.length = 0;
    await chamarSenha({ db, clock }, { senhaId: g.senha!.id, adminId: c.admin.id });
    expect(await esperar((e) => e.senhaId === g.senha!.id && e.tipo === 'invalidar')).toBe(true);
  });

  it('Tempo real: o evento só sai quando a transação confirma (rollback não publica)', async () => {
    await db
      .$transaction(async (tx) => {
        await notificar(tx, { senhaId: 999_001 });
        throw new Error('desfaz');
      })
      .catch(() => {});
    await notificar(db, { senhaId: 999_002 });
    expect(await esperar((e) => e.senhaId === 999_002)).toBe(true);
    expect(recebidos.some((e) => e.senhaId === 999_001)).toBe(false);
  });

  it('Tempo real: uma tentativa que dá CONFLITO não publica nada', async () => {
    const m = await novoMotorista(c.regiao.id);
    const g = await gerarSenha(
      { db, clock },
      { motoristaId: m.id, galpaoId: c.galpao.id, placa: PLACA, leitura: dentro },
    );
    await chamarSenha({ db, clock }, { senhaId: g.senha!.id, adminId: c.admin.id });
    await esperar(() => false, 300);
    recebidos.length = 0;
    const r = await chamarSenha({ db, clock }, { senhaId: g.senha!.id, adminId: c.admin.id });
    expect(r.codigo).toBe('CONFLITO');
    await notificar(db, { senhaId: 999_003 }); // marcador: tudo antes dele já chegou
    await esperar((e) => e.senhaId === 999_003);
    expect(recebidos.filter((e) => e.senhaId === g.senha!.id)).toEqual([]);
  });
});
