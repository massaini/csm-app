import { describe, expect, it } from 'vitest';
import { FALHA_AO_ENVIAR, paginar, tentar } from './comum';

describe('paginação do painel', () => {
  const fila = Array.from({ length: 120 }, (_, i) => i + 1);

  it('RF17-CA11: a Fila ao Vivo pagina de 50 em 50, na ordem já aplicada', () => {
    expect(paginar(fila, 1, 50)).toMatchObject({ pagina: 1, paginas: 3 });
    expect(paginar(fila, 1, 50).linhas).toEqual(fila.slice(0, 50));
    expect(paginar(fila, 3, 50).linhas).toEqual(fila.slice(100));
    // ordenar pelas colunas vale para a fila toda: a ordem chega pronta e só é recortada
    const decrescente = [...fila].reverse();
    expect(paginar(decrescente, 1, 50).linhas[0]).toBe(120);
  });

  it('RF17-CA11: se a fila encolher, a página atual vira a última que existe', () => {
    expect(paginar(fila.slice(0, 30), 3, 50)).toMatchObject({ pagina: 1, paginas: 1 });
    expect(paginar([], 2, 50)).toEqual({ linhas: [], pagina: 1, paginas: 1 });
  });
});

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
