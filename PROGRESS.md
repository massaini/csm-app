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

## Estado atual

- Arquivo de trabalho: **https://www.figma.com/design/TSxGXyq7qLD3K4aCGtfjZD/CSM-fila-motorista**
- 4 páginas: `00 · Cover`, `01 · Design System`, `02 · Motorista — Fluxo v1` (8 telas, todas usando componentes), `03 · Componentes`.
- Nenhuma tela foi testada em modo Present (prototype) de fato — só validada por screenshot estático em cada etapa.
- O protótipo do Figma **não** foi verificado clicando de fato pelo fluxo — os `reactions` foram conferidos via leitura de metadata, não navegação manual.

## Pontos em aberto (o usuário ainda não respondeu)

1. **Paleta navy + dourado** — foi uma aproximação do print original. Não confirmado se bate com o manual de marca real da CSM.
2. **Botão "Cancelar senha"** — hoje pode ser usado a qualquer momento, sem limite. Não decidido se deveria ter restrição de tempo/etapa.
3. **Campos de "Dados da carga"** — hoje só tem placa, transportadora, tipo de carga e nota fiscal. Não confirmado se faltam campos (destino, peso, etc.).
4. **Escopo fora desta rodada** (definido no plano original, ainda não iniciado): telas do operador de doca / gestor de pátio, painel público de chamada (outra persona), integração real com API/geofence.

## O que uma pessoa nova precisa para continuar

1. **Acesso de edição ao arquivo Figma da conta de estudante** (`TSxGXyq7qLD3K4aCGtfjZD`) — convite como editor, ou login direto na conta.
2. **MCP do Figma autenticado nessa mesma conta de estudante** (não a conta Starter antiga) — verificar com `whoami`; o `tier` deve aparecer como `student`, não `starter`.
3. Ler `CLAUDE.md` (estrutura do repo/arquivo) e este `PROGRESS.md` (histórico e pendências) antes de mexer em qualquer coisa.
4. Se for continuar as melhorias de UX, resolver os pontos em aberto acima com o usuário antes de assumir respostas.
