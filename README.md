# CSM Fila Digital

Fila digital de carregamento da CSM (transporte rodoviário de carga): o motorista gera a senha no
pátio, acompanha a posição e é chamado para uma bancada; o administrador conduz a fila por um painel web.

- **Entrega:** PWA (Android e iPhone) + painel admin (desktop), num único projeto Next.js, publicado no Railway.
- **Escopo atual:** MVP da Fila.
- **Stack:** Next.js 16.4, React 19, TypeScript 5.9, Prisma 7.10 + PostgreSQL, Tailwind 4, Vitest, Playwright.

## Documentação

| Arquivo | Para quê |
|---|---|
| [docs/ANDAMENTO.md](docs/ANDAMENTO.md) | **Comece aqui:** onde estamos, como rodar, armadilhas e próximos passos |
| [docs/PRD.md](docs/PRD.md) | Requisitos, critérios de aceite, modelo de dados, design system (fonte da verdade) |
| [CLAUDE.md](CLAUDE.md) | Regras e arquitetura para quem trabalha com o Claude Code |
| [progress.txt](progress.txt) | Diário da revisão do front end |
| [docs/checklist-manual.md](docs/checklist-manual.md) | Verificações em aparelho real, antes de cada ida para produção |

## Rodar localmente

```bash
docker compose up -d
npm install
npm run db:deploy && npm run db:seed
npx next dev
```

Depois de cada `git pull`, rode de novo `npm install` (regera o cliente do Prisma) e
`npm run db:deploy` (aplica migrações novas) antes do `npx next dev`.

Detalhes, variáveis de ambiente e comandos de teste em [docs/ANDAMENTO.md](docs/ANDAMENTO.md).
