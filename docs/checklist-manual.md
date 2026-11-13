# Checklist manual (PRD §9.6)

Critérios que só se provam em aparelho real ou em ferramenta externa. Rodar antes de cada
ida para produção e registrar data, aparelho e resultado. Enquanto um item estiver `[ ]`, ele
**não foi verificado** — a presença do ID aqui só satisfaz o `test:ca-coverage`.

| ID | Como verificar | Situação |
|---|---|---|
| RF05-CA4 | iPhone (iOS 16.4+), Safari **sem** instalar: abrir `/notificacoes` logo após o login → aparecem as instruções de instalação, não o botão. | [ ] pendente |
| RF23-CA1 | Chrome DevTools → Application → Manifest sem erros de instalabilidade; instalar em 1 Android (Chrome) e 1 iPhone (Safari → Adicionar à Tela de Início). | [ ] pendente |
| RNF01-CA4 | Lighthouse mobile (4G simulado) em `/login` e `/fila`: LCP ≤ 2,5 s. | [ ] pendente |
| RNF02-CA5 | No domínio do Railway: `http://` redireciona para `https://` e o cookie de sessão sai com `Secure`. | [ ] pendente |
| RNF04-CA3 | Screenshots do Playwright (390×844 e 1440×900) lado a lado com o Figma, tela a tela (10:2, 233:440, 12:2, 13:2, 144:447, 18:2, 19:2, 19:35, 19:64, 170:26, 171:95, 172:170, 216:470). | [ ] pendente |

## Push em aparelho real (complementa RF18-CA4)

| Passo | Situação |
|---|---|
| Android: instalar, ativar notificações, bloquear a tela, admin chama → a notificação chega e abre `/fila` no toque. | [ ] pendente |
| iPhone instalado: o mesmo roteiro. | [ ] pendente |
| Negar a permissão → a tela Aguardando mostra o aviso "Notificações desativadas". | [ ] pendente |
