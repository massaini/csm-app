/**
 * Falha se algum critério de aceite do PRD (RFxx-CAy / RNFxx-CAy) não aparecer no nome de
 * um teste (it/test) nem em docs/checklist-manual.md. Testes skip/todo não contam.
 * Uso: npm run test:ca-coverage  (--resumo para não falhar, só listar)
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ID = /\bRN?F\d{2}-CA\d+\b/g;

function arquivos(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const nome of readdirSync(dir)) {
    if (nome === 'node_modules' || nome === 'generated') continue;
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) arquivos(p, acc);
    else if (/\.test\.ts$/.test(nome)) acc.push(p);
  }
  return acc;
}

const prd = readFileSync('docs/PRD.md', 'utf-8');
const exigidos = new Set([...prd.matchAll(/\*\*(RN?F\d{2}-CA\d+)\*\*/g)].map((m) => m[1]));

const cobertos = new Set<string>();
const titulo = /\b(it|test)(\.each\([^)]*\))?\(\s*(['"`])((?:\\.|(?!\3).)*)\3/g;
for (const f of [...arquivos('src'), ...arquivos('tests')]) {
  const src = readFileSync(f, 'utf-8');
  for (const m of src.matchAll(titulo)) {
    for (const id of m[4].match(ID) ?? []) cobertos.add(id);
  }
}
if (existsSync('docs/checklist-manual.md')) {
  for (const id of readFileSync('docs/checklist-manual.md', 'utf-8').match(ID) ?? [])
    cobertos.add(id);
}

const faltando = [...exigidos].filter((id) => !cobertos.has(id)).sort();
const desconhecidos = [...cobertos].filter((id) => !exigidos.has(id)).sort();

console.log(`CAs no PRD: ${exigidos.size} · cobertos: ${exigidos.size - faltando.length}`);
if (desconhecidos.length)
  console.log(`IDs de teste que não existem no PRD: ${desconhecidos.join(', ')}`);
if (faltando.length) console.log(`Sem teste (${faltando.length}): ${faltando.join(', ')}`);
if (desconhecidos.length || (faltando.length && !process.argv.includes('--resumo')))
  process.exit(1);
