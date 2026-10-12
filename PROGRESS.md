# PROGRESS.md

Status do protótipo Figma do app do motorista (CSM Fila Digital). Ver [CLAUDE.md](CLAUDE.md) primeiro para a estrutura do repo e do arquivo Figma — este arquivo cobre o que aconteceu na sessão e o que falta decidir.

## Contexto original

A CSM (transporte rodoviário de carga) tem um problema operacional: motoristas chegam ao pátio e ficam esperando sem visibilidade de posição na fila ou tempo de espera. A ideia é resolver isso com um app de fila digital — **instalável**, mobile-first. Já existia um protótipo web (hospedado na Vercel) mostrando uma tela de referência para o motorista, em layout desktop/tablet de 2 colunas (print anexado na conversa original, não salvo como arquivo neste repo).

O plano completo da primeira rodada (contexto, restrições, paleta proposta, fluxo de 8 telas) está salvo em:
`C:\Users\victo\.claude\plans\claude-precisamos-desenvolver-um-kind-starfish.md`

Restrições confirmadas com o usuário nessa fase:
- Só celular (mobile-first, frames 390×844).
- Senha gerada pelo próprio motorista, mas só dentro de um raio geográfico da empresa (geofence).
- Notificação de chamada: push notification.
- Logo em `assets/logoCsm.png`, paleta navy + dourado.

## O que foi feito

1. **Criado o arquivo Figma do zero** (inicialmente na conta Starter do Victor — `TsxJquZYqYarMTrOligbTu`), com design tokens (cores, spacing, radius), 14 text styles em Inter, e logo enviado como asset.
2. **Construídas as 8 telas do fluxo do motorista**: Identificação → Fora do raio (geofence) → Gerar senha → Aguardando → Chamado → Em atendimento → Concluído → Histórico. Protótipo ligado entre as telas, com avanço automático em Aguardando→Chamado e Em atendimento→Concluído (só para demonstração).
3. **Página Cover** com resumo de 7 melhorias em relação ao print original (chamada única em vez de duplicada, estados visualmente distintos, métricas do motorista em vez do gestor, "Gerar senha" como ação primária, dados da carga visíveis, geofence explicado, cabeçalho enxuto).
4. **Rate limit do MCP do Figma no plano Starter** interrompeu o trabalho na metade (depois da tela 4). O usuário exportou o arquivo (`Save local copy` → `.fig`) e importou numa **conta de estudante** (tier `student`), que tem cota de MCP muito maior. O arquivo de trabalho atual é `TSxGXyq7qLD3K4aCGtfjZD` ("CSM-fila-motorista") — o arquivo antigo na conta Starter está congelado/desatualizado.
5. **Terminado o fluxo completo** no arquivo novo: telas 5–8, protótipo religado, Cover reconstruída, e página **Design System** com fundações documentadas (swatches de cor, rampa tipográfica, barras de espaçamento, amostras de raio).
6. **Criada a página `03 · Componentes`** com 7 componentes reutilizáveis (Button, Chip, Info Row, Input Field, Stat Card, History Item, Alert Banner), todos ligados às variáveis e text styles.
7. **Trocados os elementos soltos das 8 telas por instâncias desses componentes** — 39 instâncias no total. Protótipo confirmado intacto depois da troca (todas as reações e o starting point seguem funcionando).
8. **Criado `CLAUDE.md`** documentando a estrutura do repo/arquivo Figma para quem chegar depois.
9. **Aba Disponibilidade** (feita fora desta linha do tempo — editada direto pelo Victor no Figma): 6 telas novas (09, 10, 10A, 10B, 11A, 11B), Tab Bar com 2 opções, e componentes novos (`Option Card`, `Choice Button`, `Text Area`, `Tab Bar`, `Galpão Select`). Detalhes no CLAUDE.md.
10. **Fluxo Demonstrativo** (esta sessão, 2026-09-27): plano em `C:\Users\victo\.claude\plans\claude-vamos-inciar-o-transient-oasis.md`. Adicionadas 2 telas novas — `12 · Demonstrativo` (resumo quinzenal com Stat Cards, Alert Banner de acareação e lista de 15 dias) e `13 · Acareação` (detalhe do desconto). Tab Bar refeita com 3 tabs (Fila / Disponibilidade / Demonstrativo), com todas as 9 instâncias existentes trocadas via `swapComponent`. Componentes novos: `Day Row` (5 estados: Empty/Filled/Expanded/Today/Future) e variante `Stat Card / Tone=Danger`. Protótipo religado: Alert Banner → tela 13, back → tela 12, e as 3 tabs nas 11 instâncias de Tab Bar → telas 04/09/12 (com skip quando destino = tela atual).
11. **Refinos do Demonstrativo** (mesma sessão, após feedback do usuário):
    - Tela 12: lista de 15 `Day Row` substituída por uma **tabela horizontal-scrollable** replicando as 7 colunas da planilha original (`DATA | CARR. | ASS. | PERF. | EST. | FDS | VALOR`) mais uma linha TOTAL destacada. O `content` da tela recebeu altura fixa + `overflowDirection='VERTICAL'` e o `table-scroll` interno tem `overflowDirection='HORIZONTAL'`. `Day Row` continua no design system, mas ficou órfão.
    - Tela 12: adicionado bar fixa **Exportar como Planilha CSV** (Button Secondary) ancorada entre `content` e a Tab Bar. Alert Banner atualizado com o texto refletindo o teto de 20%.
    - Tela 12: adicionado botão explícito **"Ver detalhes da acareação →"** (Button Danger, borda vermelha) logo abaixo do Alert Banner, com reação `ON_CLICK` → tela 13 (torna óbvio que é clicável — o banner sozinho era um alvo pouco óbvio).
    - Tela 13: refatorada com seção `BREAKDOWN` mostrando o cálculo completo (valor original R$ 13,00 → PNR R$ 5,00 → limite 20% R$ 2,60 → desconto R$ 2,60 → diferido R$ 2,40 → total R$ 10,40) e um card `COMO FUNCIONA` com a regra do teto de 20% e dois exemplos concretos (chip vermelho quando PNR ultrapassa 20% e o restante é diferido, chip verde quando PNR está dentro do teto e vai integral).
12. **Rodada de polimento** (2026-10-05): plano adicionado em `C:\Users\victo\.claude\plans\claude-vamos-inciar-o-transient-oasis.md` (seção "Rodada 2").
    - Criada **`04A · Cancelar senha?`** como overlay (390×844, `overlayPositionType=CENTER`) com card centralizado — título "Cancelar senha?", corpo explicando a perda de posição, 2 botões: Danger "Sim, cancelar senha" → tela 03 e Secondary "Voltar" → `CLOSE`. Reaction do botão "Cancelar senha" (29:40) na tela 04 reconectada: hoje abre o overlay com `navigation='OVERLAY'`, não vai direto pra tela 03.
    - **Deletado componente `Day Row`** (104:66) da página `03 · Componentes` + heading "DAY ROW" removido. Antes de deletar, scan em todas as 16 telas confirmou que nenhuma instância referencia o componente (zero dependentes). Design system fica com 25 componentes.
    - Docs: CLAUDE.md atualizado (count de 16 → 17 telas, descrição do overlay 04A, remoção da menção a Day Row, nova "Known quirk" sobre `OVERLAY` navigation — `type:'CLOSE'` em vez de `CLOSE_OVERLAY`, `overlayPositionType`/`overlayBackgroundInteraction`/`overlayBackground` são read-only no Plugin API).
13. **Separação visual dos fluxos em Sections** (mesma sessão, 2026-10-05): as 17 telas foram agrupadas em 5 Sections nativas do Figma — `Fila — Fluxo Normal` (8 telas, azul claro), `Fila — Fluxo de Exceção` (04A, pêssego claro), `Disponibilidade` (6 telas, cinza neutro, sem split normal/exceção porque "disponível" e "não disponível" são dois resultados de negócio válidos, não erro), `Demonstrativo — Fluxo Normal` (tela 12, azul claro), `Demonstrativo — Fluxo de Exceção` (tela 13 Acareação, pêssego claro). As 3 "swimlanes" (Fila / Disponibilidade / Demonstrativo) empilham de cima pra baixo com ~300px de gap; pares normal/exceção ficam lado a lado com ~150px de gap.
    - **Bug descoberto e corrigido durante a execução**: a primeira tentativa de posicionar os filhos dentro das sections usou `section.x + padding + offset` (coordenadas "absolutas"), mas os filhos de uma Section usam coordenadas **relativas à origem da section** — isso causou double-counting e espalhou as telas de Disponibilidade e Demonstrativo para posições erradas no canvas (telas da Disponibilidade apareceram caídas perto do Demonstrativo). Diagnosticado com um teste isolado (criar section de teste + frame de teste em posição conhecida, inspecionar `absoluteBoundingBox` antes/depois do `appendChild`) e corrigido reescrevendo todos os `x`/`y` como relativos (`padding + offset`, sem somar `section.x`/`section.y`). Documentado como nova "Known quirk" no CLAUDE.md.
    - Verificação pós-fix: `flowStartingPoints` continua apontando pra tela 01, 19 nós com reactions preservados, nenhuma reação quebrada pela reorganização (reactions referenciam node ID, não posição).
14. **Tela do Administrador** (2026-10-11): criada a página `04 · Administrador` — persona nova, separada do app do motorista. Mostra quais motoristas confirmaram ou não a disponibilidade do próximo dia. Escopo definido com o usuário: só a lista de motoristas com status (sem cards de resumo, sem filtros, sem ação de lembrete), em duas versões lado a lado — `Administrador — Desktop` (1440px, tabela com zebra striping: Nome/CPF/Galpão/Status/Horário da resposta) e `Administrador — Mobile` (390×844, mesmos dados em cards empilhados). Dataset mock de 12 motoristas (6 confirmados, 3 não confirmados, 3 sem resposta). Nova variante `Chip / Tone=Danger` criada (clonada de `Tone=Warning`, recorada para vermelho) pro status "Não confirmado" — Chip agora tem 5 tons. Ambas as telas envolvidas em Sections (mesmo padrão cinza neutro da `Disponibilidade`), já que são duas visões do mesmo conteúdo, não normal/exceção.
15. **Expansão do Administrador** (2026-10-11, mesma sessão): plano "Rodada 4" em `C:\Users\victo\.claude\plans\claude-vamos-inciar-o-transient-oasis.md`.
    - Página `04 · Administrador` reconstruída com **6 dashboards** agrupadas numa Section única `Administrador — Dashboards` em grid 3×2: Fila ao Vivo, Histórico de Atendimentos, Histórico de Senhas, Confirmações de Disponibilidade (reconstruída no novo layout), Demonstrativos, Acareações. Cada dashboard é 1440×900 com shell comum: `Sidebar` à esquerda (260px) + content area (1180px) com breadcrumb/título + Export CSV + stats row (4 Stat Cards) + tabela zebra-striped.
    - Novo componente `Sidebar` (COMPONENT_SET, 6 variantes `Active=...`) com logo + navegação (ícones feitos à mão como no Tab Bar) + rodapé com avatar e nome do admin. Width final 260px (começou com 240 mas "Histórico de Atendimentos" truncava).
    - Tela antiga `Administrador — Desktop` + sua Section deletadas. Tela `Administrador — Mobile` tinha sido removida numa sessão anterior (não aparecia mais no inventário).
    - Botão **Export CSV** compacto (`↓ CSV`, Button Secondary) adicionado também na tela 08 Histórico do motorista — Header reestruturado agrupando `←` + "Histórico" num title-wrap à esquerda e botão com `layoutSizingHorizontal='HUG'` à direita.
    - Admin fica como mockup estático: nenhuma reaction entre dashboards, sidebar sem navegação, Export CSV sem ação. Todas as decisões documentadas no plano Rodada 4.
    - **Bugs encontrados e corrigidos** durante a execução:
      1. `layoutSizingVertical = 'AUTO'` é inválido — enum aceita só `FIXED/HUG/FILL` (equivalente a 'AUTO' é 'HUG').
      2. Botão instance inserido num container HORIZONTAL com SPACE_BETWEEN esticou pra ocupar todo o espaço disponível, truncando o label — forçar `layoutSizingHorizontal = 'HUG'` após o `appendChild` resolve.
    - **3 bugs encontrados e corrigidos durante a execução** (todos documentados como novas "Known quirks" no CLAUDE.md):
      1. `componentPropertyReferences` não pode ser setado num clone antes dele ser `appendChild`-ado ao component set — lançava erro "Could not find a component property". Corrigido invertendo a ordem (append primeiro, depois seta a referência).
      2. Opacidade de paint com variável vinculada não gruda se setada no mesmo objeto do binding (`Object.assign` antes de anexar ao nó) — precisa de duas atribuições sequenciais (anexa o paint puro, lê de volta do nó, só então reaplica a opacidade).
      3. Essa mesma pegadinha de opacidade se repete em toda **instância** nova do Chip (não só no master) — precisa reaplicar o fix em cada instância criada, não só uma vez no componente.
    - Nomes longos (ex: "Guilherme Rodrigues Siqueira") na versão mobile inicialmente vazavam pra fora do card ao lado do chip de status mais largo ("NÃO CONFIRMADO") — corrigido com `textTruncation='ENDING'` + `maxLines=1` + `layoutSizingHorizontal='FILL'` no nome, deixando o chip com largura fixa.

## Estado atual

- Arquivo de trabalho: **https://www.figma.com/design/TSxGXyq7qLD3K4aCGtfjZD/CSM-fila-motorista**
- 5 páginas: `00 · Cover`, `01 · Design System`, `02 · Motorista — Fluxo v1` (**17 telas**, todas usando componentes), `03 · Componentes` (**13 componentes**), `04 · Administrador` (2 telas: Desktop + Mobile).
- Nenhuma tela foi testada em modo Present (prototype) de fato — só validada por screenshot estático em cada etapa.
- O protótipo do Figma **não** foi verificado clicando de fato pelo fluxo — os `reactions` foram conferidos via leitura de metadata, não navegação manual.

## Pontos em aberto (pendências ativas)

1. **Paleta oficial da CSM** — a atual é aproximação do print original. Decisão da rodada 10-05: manter até receber o manual de marca. Quando chegar, basta trocar valores das Primitives (todas as 16 telas atualizam juntas).
2. **Demonstrativo — seletor de quinzena** — na tela 12 o seletor `‹ 01/09 – 15/09 ›` é apenas visual. Modelar quinzenas passadas exige frames duplicados; adiado pra uma rodada futura (ou substituir por dropdown/sheet).
3. **Demonstrativo — Alert Banner condicional** — sempre visível na v1 pra demonstrar o layout. Numa próxima rodada: criar uma variante "sem acareação" da tela 12 pra documentar os dois estados.
4. **Demonstrativo — coluna DATA sticky** — na tabela horizontal-scrollable, seria melhor UX se a coluna DATA ficasse fixa. Limitação do Figma estático — funciona só quando implementado em código.
5. **Demonstrativo — botão Exportar como Planilha CSV** — a ação não está ligada a nada no protótipo. Comportamento real (gerar arquivo, compartilhar, etc.) é responsabilidade da implementação.
6. **Overlay 04A — background interaction** — hoje usa defaults da Plugin API (sem scrim configurado via API — a cor escura do backdrop é o próprio fill do frame). Pra ter `CLOSE_ON_CLICK_OUTSIDE`, o usuário precisa configurar manualmente no painel de Prototype do Figma (atributos são read-only via API).
7. **Administrador — sem interatividade** — a página `04 · Administrador` é um mockup estático: as 6 dashboards não estão ligadas pela sidebar nem ao protótipo do motorista, Export CSV não tem ação, não há filtros/busca/paginação, datasets são fictícios. Faltam ainda: dashboard "Visão Geral" com KPIs do dia (abertura), interatividade real.
8. **Escopo fora desta rodada** (definido no plano original, ainda não iniciado): telas do operador de doca / gestor de pátio, painel público de chamada (outra persona), integração real com API/geofence.

## Pendências resolvidas (histórico)

- Botão "Cancelar senha" sem restrição → resolvido na rodada 10-05 com overlay de confirmação `04A`.
- Campos de "Dados da carga" → confirmado completo na rodada 10-05 (placa / transportadora / tipo / NF).
- Componente `Day Row` órfão → deletado na rodada 10-05.

## O que uma pessoa nova precisa para continuar

1. **Acesso de edição ao arquivo Figma da conta de estudante** (`TSxGXyq7qLD3K4aCGtfjZD`) — convite como editor, ou login direto na conta.
2. **MCP do Figma autenticado nessa mesma conta de estudante** (não a conta Starter antiga) — verificar com `whoami`; o `tier` deve aparecer como `student`, não `starter`.
3. Ler `CLAUDE.md` (estrutura do repo/arquivo) e este `PROGRESS.md` (histórico e pendências) antes de mexer em qualquer coisa.
4. Se for continuar as melhorias de UX, resolver os pontos em aberto acima com o usuário antes de assumir respostas.
