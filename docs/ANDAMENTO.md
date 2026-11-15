# Andamento do projeto — CSM Fila Digital

Atualizado em **2026-11-15**. Quem chega agora (pessoa ou Claude) deve ler, nesta ordem:
`CLAUDE.md` (regras e arquitetura) → este arquivo (onde estamos e o que falta) → `docs/PRD.md`
(requisitos; fonte da verdade) → `progress.txt` (diário da revisão do front end).

## 1. Onde estamos

O **MVP da Fila está construído e testado localmente**: app do motorista (PWA) e painel admin,
com tempo real (SSE), push (VAPID), cadastros, históricos e exportação CSV. A revisão geral do
front end (PRD §13, itens FE-01 a FE-12) está concluída. **O staging está publicado no Railway
(seção 6)**; falta validá-lo em aparelhos reais (push, instalação do PWA e GPS só se provam em HTTPS
num celular de verdade) e então criar o ambiente de produção.

Escopo do ciclo: **só a Fila** (motorista + painel). Disponibilidade, Demonstrativo/Acareação e
Google Sheets estão fora e aparecem como "Em breve".

## 2. Como rodar localmente

Pré-requisitos: Node 22, Docker Desktop aberto, `.env` copiado de `.env.example` (o `.env` real
não vai para o git). O super-admin local vem de `SUPERADMIN_NOME/CPF/SENHA_INICIAL`.

```bash
docker compose up -d      # Postgres dev (5432) e de testes (5433)
npm install               # roda prisma generate
npm run db:deploy         # aplica as migrações
npm run db:seed           # cria locais, galpões, configuração e o super-admin (só cria, nunca altera)
npx next dev              # http://localhost:3000 (motorista) e /admin/login (painel)
```

Verificação completa (precisa passar antes de qualquer commit de código):

```bash
npm test                  # Vitest: domínio + integração em Postgres real (cria/migra o banco de testes sozinho)
npm run test:ca-coverage  # todo RFxx-CAy / RNFxx-CAy do PRD tem de aparecer num teste (ou no checklist manual)
npm run lint && npx tsc --noEmit && npm run build
npx playwright test       # E2E (sobe o próprio next dev na porta 3100, banco csm_fila_e2e)
```

Redefinir a senha de um admin (comando do desenvolvedor, RF27-CA3):
`npm run admin:redefinir-senha -- --cpf=<cpf>`.

### Armadilhas conhecidas

- **`npm run <script>` no Git Bash sai com código 1 sem mostrar nada.** Use PowerShell, ou chame a
  ferramenta direto (`npx next dev`, `npx vitest run`) e confira sempre o exit code.
- O Prisma 7 não lê o `.env` sozinho: o seed, o `prisma.config.ts` e `scripts/admin.ts` usam
  `loadEnvConfig` do `@next/env`.
- O E2E usa a pasta `.next-e2e` (variável `E2E=1`), então roda com o seu `next dev` aberto.
- Máquina lenta: o `next dev` compila cada tela na primeira visita. Os helpers de login do E2E
  esperam a hidratação e aceitam até 30 s; os prazos do produto (ex.: 5 s do RNF01) continuam
  explícitos nos testes. Uma rodada completa leva de 5 a 8 min (mais de 25 min com o disco lento).
- O `.env` aponta para o banco `csm_fila`; existe também `csm_fila_ensaio`, usado para ensaiar o
  build de produção local.
- Versões travadas de propósito (não "atualizar"): Next 16.4, TypeScript 5.9.3, Prisma 7.10.

## 3. O que está pronto

| Área | Entrega | Commits principais |
|---|---|---|
| Domínio | regras puras (senha, fila, dia operacional, geofence, formatos) com testes por critério | `d00244a` |
| Banco | schema, migrações com índices parciais (uma senha ativa por motorista, uma chamada por bancada), seed idempotente | `0b78d94` |
| Servidor | serviço da senha (máquina de estados com UPDATE condicional → `CONFLITO`), auth CPF+senha com bloqueio, sessões | `3850560`, `0def5b1` |
| Motorista | login, troca de senha, Gerar senha (GPS), Aguardando, Chamado, Em atendimento, Concluído, Histórico | `29bebe4` e seguintes |
| Painel | Fila ao Vivo (chamar, confirmar chegada, concluir), Histórico, exportar CSV | `cb56449` |
| Cadastros | Motoristas, Bancadas e Regiões (mapeamento região → bancada), Configurações, Administradores | `2cf43eb` |
| Tempo real | `NOTIFY`/`LISTEN` + SSE; polling de 4 s como reserva | `6e2de9e` |
| Push/PWA | Web Push, service worker só de push (sem cache), manifest, instalação | `4e795b1` |
| E2E | Playwright em 2 contextos, relógio do servidor controlável (`E2E=1`) | `52872df` |
| Revisão do front end | FE-01 a FE-12 (acessibilidade com axe, estados de erro/carregamento, 404, Figma, performance, testes) | `b171148` … `4b2f666` |
| Pós-revisão | ver seção 4 | commits seguintes |

O detalhe do que foi inspecionado e alterado em cada item da revisão está em `progress.txt`.

## 4. Pedidos pós-revisão (decisões do responsável pelo produto)

- **Histórico unificado (P28, RF20):** `/admin/historico` junta Histórico de Senhas e de
  Atendimentos (colunas Espera e Tempo total, filtro de Status, KPIs, paginação de 50). As rotas
  `/admin/atendimentos` e `/admin/senhas` redirecionam. O RF21 foi incorporado ao RF20.
- **Busca, filtros e ordenação (RF31):** barra de busca por Nome (padrão) + "Filtrar por". Campos de
  texto trocam o alvo da barra; campos de opções fechadas abrem subfiltro e viram etiquetas
  removíveis; colunas ordenáveis (no servidor no Histórico, no cliente nas listas pequenas). Só
  existem filtros para campos que são coluna da tabela (CPF só em Motoristas e Administradores).
- **Menu "⋮" em Motoristas (RF24-CA8):** Editar, Ver histórico, Redefinir senha, Liberar geração
  de senha, Desativar/Reativar. "Ver histórico" abre `/admin/historico?motorista=<id>` (id interno,
  nunca CPF).
- **Bancadas e Regiões (RF25-CA7):** cada galpão mostra até 5 bancadas; "Ver mais (N)" abre modal
  com todas, com renomear e Desativar/Reativar.
- **Editar nome do administrador (RF27-CA4):** é o nome exibido ao motorista como **Conferente**
  (P10). No ambiente local o super-admin vem do `.env` com o nome "Super Admin": corrija em
  Administradores → Editar nome.
- **Cursor de mãozinha** em todo elemento clicável (`globals.css`).
- PRD está na **v0.6**; os desvios em relação ao Figma validado pelo cliente estão no §10.6.

## 5. Qualidade (última verificação completa)

Vitest 181 testes, `test:ca-coverage` 155/155, lint, `tsc` e `build` sem erros ou avisos,
Playwright ~50 testes (inclui auditoria WCAG A/AA com axe em todas as telas e um vigia que falha
o teste se o console do navegador registrar erro ou aviso não declarado).

## 6. Staging no Railway (publicado em 2026-11-15)

- **Projeto:** `csm-fila-digital` (workspace "Victor Massaini's Projects"), ambiente `staging`
  (project id `9248f70b-c749-4f26-b4f6-e61309381cb9`). Não confundir com o projeto `galileo`, que é de outro assunto.
- **Serviços:** `app` (GitHub `massaini/csm-app`, branch `main`; **cada push na `main` faz deploy**) e
  `Postgres` (template do Railway). URL: https://app-staging-645778d2.up.railway.app
- **Configuração do `app`:** pre-deploy `npm run db:deploy && npm run db:seed`; start `npm start`;
  healthcheck `/login` (120 s); 1 réplica. Build padrão do Railway (Railpack) com `npm run build`.
- **Variáveis** (valores só no painel do Railway, nunca no git): `DATABASE_URL` (referência
  `${{Postgres.DATABASE_URL}}`), `APP_URL`, `TZ`, `HORA_VIRADA`, `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `SUPERADMIN_NOME`, `SUPERADMIN_CPF`, `SUPERADMIN_SENHA_INICIAL`.
  No staging o super-admin usa o CPF de teste do ambiente local e a senha inicial gerada aleatoriamente
  (troca obrigatória no primeiro login). Depois que o super-admin existir, `SUPERADMIN_SENHA_INICIAL`
  pode ser removida (o seed só a lê quando não há super-admin). **As chaves VAPID do staging não devem
  ser reaproveitadas na produção**: gere outras com `npx web-push generate-vapid-keys`.
- **`prisma` e `tsx` ficam em `dependencies`** porque o pre-deploy e os comandos `admin:*` rodam no
  container de produção.
- **Verificado por HTTP no deploy:** `/login` 200 sem `X-Powered-By`; `/api/e2e` 404; `http` → `https`
  (301); manifest, `sw.js` e ícones 200; `/api/stream` e `/api/fila/estado` sem sessão 401.
- **Ainda não verificado:** login e uso do painel no staging, push e instalação em aparelho real,
  carga, Lighthouse (ver `docs/checklist-manual.md`).
- Comandos de operação no Railway (shell do serviço `app`): `npm run admin:redefinir-senha -- --cpf=<cpf>`.

## 7. Próximos passos (em ordem)

1. ~~Publicar em staging no Railway~~ — **feito** (seção 6). Para produção: criar o ambiente `production`
   no mesmo projeto, com serviço `app` + `Postgres` próprios, variáveis reais (`SUPERADMIN_*` reais,
   novas chaves VAPID, `APP_URL` do domínio de produção) e backup diário do Postgres.
2. **Cabeçalho de IP do proxy do Railway:** a documentação do Railway diz que o proxy envia
   `X-Real-IP` com o IP do cliente, e `ipDoCliente()` (`src/server/http-sessao.ts`) já o prefere.
   Falta só confirmar em campo, no staging, que o valor é o IP real (afeta o bloqueio de IP, RF01-CA4).
3. **Rodar o checklist manual** (`docs/checklist-manual.md`) no staging, em aparelhos reais: push no
   Android e no iPhone instalado, instalação do PWA, `http→https` com cookie `Secure`, Lighthouse
   (LCP ≤ 2,5 s) e comparação de telas com o Figma (RNF04-CA3). Registrar data, aparelho e resultado.
4. **Teste de carga** contra o staging: `npm run test:load` (RNF01-CA3: p95 ≤ 500 ms, 0 erros, com
   50 conexões SSE).
5. **Dependências do go-live com a CSM:** texto dos Termos de uso (P14, hoje há um placeholder em
   `/termos`) e a média diária de atendimentos de DS SDE e SP-R-D228 (P27, não bloqueia o desenvolvimento).
6. **Produção:** repetir o roteiro, definir o `SUPERADMIN_*` real, conferir o backup diário do
   Postgres e cadastrar bancadas, regiões e motoristas reais pelo painel.
7. **Depois do MVP** (fora do escopo atual): Disponibilidade, Demonstrativo/Acareação, integração
   com Google Sheets.

## 8. Regras de trabalho

- **PRD é a fonte da verdade.** Mudou o comportamento, atualize o PRD (e a versão) no mesmo commit.
  Todo teste leva o id do critério no nome (`it('RF13-CA2: …')`).
- **Git:** antes de qualquer commit, confira `git config user.email` = o e-mail pessoal do
  responsável e `gh auth status` com a conta pessoal ativa (não a acadêmica); se não for, pare e avise.
  Commit e push só quando o responsável pedir.
- `docs/CONTEXTO.md` (contexto de negócio) é **ignorado pelo git de propósito**: não commitar nem
  copiar o conteúdo para arquivos versionados.
- Textos do app em pt-BR; vocabulário: **bancada** (não "doca"), **galpão**, **rota/região**, **senha**.
- Itens novos que surgirem numa revisão entram no PRD como itens não marcados antes de serem corrigidos.

## 9. Mapa rápido

- `src/domain/` regras puras · `src/server/` banco, auth, senhas, painel, push, tempo real, job
- `src/app/` telas do motorista; `src/app/admin/` painel; `src/app/api/` consulta, exportar, stream, push, estado
- `src/components/ui/` design system (Button, Chip, Menu, Dialogo…) · `src/components/admin/` tabela, busca, sidebar
- `prisma/` schema, migrações e seed · `scripts/` admin, cobertura de CAs, carga
- `tests/` integração · `e2e/` Playwright · `docs/` PRD, checklist manual e este andamento
