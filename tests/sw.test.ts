import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

type Ouvinte = (evento: Record<string, unknown>) => void;

/** Carrega public/sw.js num `self` falso e devolve os ouvintes registrados. */
function carregarSw(extras: Record<string, unknown> = {}) {
  const ouvintes: Record<string, Ouvinte> = {};
  const self = {
    addEventListener: (tipo: string, fn: Ouvinte) => (ouvintes[tipo] = fn),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(), matchAll: vi.fn(async () => []), openWindow: vi.fn() },
    location: { origin: 'https://fila.csm' },
    registration: {
      showNotification: vi.fn(async () => {}),
      pushManager: { subscribe: vi.fn() },
    },
    ...extras,
  };
  const fetch = vi.fn(async () => ({ ok: true }));
  runInNewContext(readFileSync('public/sw.js', 'utf-8'), { self, fetch, URL, JSON, Promise });
  return { ouvintes, self, fetch };
}

function evento(dados: Record<string, unknown>) {
  let espera: Promise<unknown> = Promise.resolve();
  return {
    ...dados,
    waitUntil: (p: Promise<unknown>) => (espera = p),
    get espera() {
      return espera;
    },
  };
}

describe('service worker', () => {
  it('RF05-CA5: pushsubscriptionchange reenvia a nova inscrição ao servidor', async () => {
    const { ouvintes, fetch } = carregarSw();
    const nova = {
      toJSON: () => ({ endpoint: 'https://push/novo', keys: { p256dh: 'p', auth: 'a' } }),
    };
    const e = evento({ newSubscription: nova });
    ouvintes.pushsubscriptionchange(e);
    await e.espera;
    expect(fetch).toHaveBeenCalledWith(
      '/api/push/inscricao',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(nova.toJSON()) }),
    );
  });

  it('RF05-CA5: sem a nova inscrição, se reinscreve com as opções da antiga', async () => {
    const reinscrita = { toJSON: () => ({ endpoint: 'https://push/re' }) };
    const { ouvintes, fetch, self } = carregarSw();
    self.registration.pushManager.subscribe.mockResolvedValue(reinscrita);
    const e = evento({ oldSubscription: { options: { userVisibleOnly: true } } });
    ouvintes.pushsubscriptionchange(e);
    await e.espera;
    expect(self.registration.pushManager.subscribe).toHaveBeenCalledWith({ userVisibleOnly: true });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('RF18-CA4: o push mostra a notificação com o texto da chamada e abre /fila', async () => {
    const { ouvintes, self } = carregarSw();
    const carga = {
      titulo: 'Você foi chamado',
      corpo: 'Dirija-se à bancada 07 · Senha A-001',
      url: '/fila',
      tag: 'senha1',
    };
    const e = evento({ data: { json: () => carga } });
    ouvintes.push(e);
    await e.espera;
    expect(self.registration.showNotification).toHaveBeenCalledWith(
      'Você foi chamado',
      expect.objectContaining({ body: carga.corpo, tag: 'senha1', data: { url: '/fila' } }),
    );
  });

  it('PWA: o service worker não faz cache (não quebra o app instalado após deploy)', () => {
    const fonte = readFileSync('public/sw.js', 'utf-8');
    expect(fonte).not.toMatch(/caches\.|addEventListener\(\s*['"]fetch['"]/);
  });
});
