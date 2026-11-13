/**
 * RNF01-CA3 — teste de carga (rodar contra o STAGING, nunca contra produção):
 *   50 conexões SSE abertas + 10 req/s por 60 s (80% GET /api/fila/estado, 20% consulta do painel).
 *   Aprovado com p95 ≤ 500 ms e 0 erros.
 *
 * Uso:
 *   URL_BASE=https://staging... COOKIE_MOTORISTA=<token> COOKIE_ADMIN=<token> npm run test:load
 * Os tokens são valores dos cookies `csm_sessao` e `csm_admin` de sessões de teste.
 */
import autocannon from 'autocannon';

const URL_BASE = process.env.URL_BASE;
const MOTORISTA = process.env.COOKIE_MOTORISTA;
const ADMIN = process.env.COOKIE_ADMIN;
const CONEXOES_SSE = Number(process.env.CONEXOES_SSE ?? 50);
const DURACAO_S = Number(process.env.DURACAO_S ?? 60);
const P95_MAX_MS = 500;

async function abrirSse(controle: AbortController) {
  const r = await fetch(`${URL_BASE}/api/stream`, {
    headers: { Cookie: `csm_sessao=${MOTORISTA}` },
    signal: controle.signal,
  });
  if (!r.ok || !r.body) throw new Error(`SSE recusado: ${r.status}`);
  const leitor = r.body.getReader();
  void (async () => {
    try {
      while (!(await leitor.read()).done) {
        /* só mantém a conexão aberta */
      }
    } catch {
      /* encerrada pelo abort */
    }
  })();
}

async function main() {
  if (!URL_BASE || !MOTORISTA || !ADMIN) {
    throw new Error('Defina URL_BASE, COOKIE_MOTORISTA e COOKIE_ADMIN');
  }
  const controle = new AbortController();
  await Promise.all(Array.from({ length: CONEXOES_SSE }, () => abrirSse(controle)));
  console.log(`${CONEXOES_SSE} conexões SSE abertas`);

  const hoje = new Date().toISOString().slice(0, 10);
  const resultado = await autocannon({
    url: URL_BASE,
    connections: 10,
    overallRate: 10, // 10 req/s no total
    duration: DURACAO_S,
    requests: [
      {
        method: 'GET',
        path: '/api/fila/estado',
        headers: { Cookie: `csm_sessao=${MOTORISTA}` },
      },
      {
        method: 'GET',
        path: '/api/fila/estado',
        headers: { Cookie: `csm_sessao=${MOTORISTA}` },
      },
      {
        method: 'GET',
        path: '/api/fila/estado',
        headers: { Cookie: `csm_sessao=${MOTORISTA}` },
      },
      {
        method: 'GET',
        path: '/api/fila/estado',
        headers: { Cookie: `csm_sessao=${MOTORISTA}` },
      },
      {
        method: 'POST',
        path: '/api/admin/consulta',
        headers: { Cookie: `csm_admin=${ADMIN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tela: 'senhas',
          filtros: { diaInicio: hoje, diaFim: hoje },
        }),
      },
    ],
  });
  controle.abort();

  const p95 = resultado.latency.p97_5 ?? resultado.latency.p99;
  const erros = resultado.errors + resultado.non2xx + resultado.timeouts;
  console.log(
    JSON.stringify({
      requisicoes: resultado.requests.total,
      p50: resultado.latency.p50,
      p95_aprox: p95,
      erros,
    }),
  );
  if (erros > 0 || p95 > P95_MAX_MS) {
    console.error('Reprovado: p95 acima de 500 ms ou houve erros.');
    process.exit(1);
  }
  console.log('Aprovado.');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
