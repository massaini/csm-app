# PRD — CSM Fila Digital · MVP da Fila

| Campo | Valor |
|---|---|
| Versão | 0.5 — bancada atende um motorista por vez (P25) e volume de 180 motoristas (P26) |
| Data | 2026-11-10 |
| Escopo | MVP: Fila (app do motorista + painel admin) |
| Fonte de UI | Figma `TSxGXyq7qLD3K4aCGtfjZD` (protótipo validado pelo cliente) |
| Status | Aguardando aprovação final |

Convenções:
- **RF** = requisito funcional, **RNF** = não funcional.
- **RFxx-CAy** = critério de aceite. Todo CA tem um teste com o mesmo ID no nome (ver 9.6) ou está no checklist manual.
- **P** = premissa ou decisão (seção 11); **✔** = confirmada pelo cliente.
- Telas são citadas **pelo node id** do Figma (ex.: `233:440`), nunca pelo número ("tela 03" é ambíguo).

---

## 1. Visão Geral do Produto

App de fila digital para motoristas no pátio da CSM. O motorista gera a senha pelo celular quando chega ao pátio, acompanha a posição e o tempo estimado, e é avisado por notificação quando for chamado para a bancada. A equipe da CSM acompanha a fila ao vivo e chama os motoristas por um painel web.

Entrega: **PWA** (instalável em Android e iPhone) + **painel admin web (desktop)**, num único projeto Next.js hospedado no Railway.

## 2. Problema / Oportunidade

Hoje o motorista espera ser chamado pelo nome, presencialmente. Ele não sabe a posição nem quanto falta, então fica parado perto da bancada. A equipe chama um por um e responde as mesmas dúvidas várias vezes ao dia.

Linha de base (dados do cliente):

| Métrica | Valor atual |
|---|---|
| Tempo médio de espera | 30 min, da chegada do motorista até o início do carregamento (P21) |
| Atendimentos/dia — F SDR | média 57,8 (mín. 26, máx. 71) |
| Atendimentos/dia — F SDR 03 | média 20,2 (mín. 12, máx. 24) |
| Atendimentos/dia — DS AET | média 41,8 (mín. 11, máx. 59) |

Disponibilidade e demonstrativo (hoje enviado por WhatsApp, um a um) ficam para fases seguintes (5.3).

## 3. Público-Alvo

- **Motorista** — celular Android (maioria) ou iPhone. Tem uma região fixa de atuação (ex.: `500 · Centro de Santo André`), que define a bancada onde carrega em cada galpão.
- **Administrador** — equipe da CSM, no desktop. Acompanha a fila de todos os galpões, chama motoristas, confirma chegadas, conclui atendimentos e cadastra motoristas, regiões e bancadas.
- **Super-administrador** — um único usuário: tudo que o administrador faz + gestão de administradores.

## 4. Objetivos do Produto

- **O1 — Visibilidade:** o motorista vê a posição e o tempo estimado sem perguntar a ninguém.
- **O2 — Chamada remota:** a equipe chama pelo painel e o motorista recebe no celular.
- **O3 — Rastreabilidade:** cada senha registra geração, chamada, chegada e conclusão, permitindo medir espera e atendimento por galpão.

## 5. Escopo Funcional

### 5.1 Funcionalidades Principais (MVP)

Motorista:
1. Login com CPF + senha; troca obrigatória da senha no primeiro acesso.
2. Gerar senha (placa + galpão), liberada dentro do raio do pátio ou por liberação manual do admin.
3. Acompanhar a senha: posição na fila da bancada e tempo estimado, em tempo real.
4. Receber a chamada (push + troca de tela) e confirmar "Estou a caminho" dentro da tolerância.
5. Acompanhar o atendimento e concluí-lo.
6. Cancelar a própria senha enquanto aguarda.
7. Ver o histórico dos próprios atendimentos.

Administrador:
8. Fila ao Vivo: chamar, confirmar chegada e concluir.
9. Histórico de Atendimentos e Histórico de Senhas.
10. Cadastro de motoristas (redefinir senha, liberar geofence, desativar).
11. Bancadas, regiões e mapeamento região → bancada por galpão (tela simples).
12. Configurações operacionais.
13. Super-admin: gestão de administradores.

### 5.2 Funcionalidades Secundárias (MVP, não bloqueiam o fluxo principal)

- Exportar CSV nas 3 telas do admin.
- Filtros do admin (RF17, RF20, RF21).
- Página de instruções de instalação do PWA.

### 5.3 Fora de Escopo (este ciclo)

- Disponibilidade (`62:140`…`63:256`) e o dashboard Confirmações de Disponibilidade.
- Demonstrativo, Acareação e IDs descontados (`105:372`, `106:510`, `276:532`), dashboards Demonstrativos, Acareações e Extrato do motorista, e a integração com Google Sheets.
- App nativo / APK. Notificação por SMS/WhatsApp.
- Recuperação de senha self-service (só o admin redefine).
- Exportar CSV no histórico do motorista (P16).
- Barra de etapas do carregamento em `19:2` (P16).
- Modo offline (o app exige conexão).
- Admin cancelar ou reordenar senhas (chamar fora de ordem é permitido, ver P06).
- Cadastro de galpões e locais pela interface (só via seed no MVP).
- Desistência do motorista depois de chamado (P22).

---

## 6. Requisitos Detalhados

### 6.0 Modelo de domínio e regras globais

**Entidades** (todos os instantes em `timestamptz`)

| Entidade | Campos principais |
|---|---|
| `Local` | nome, endereço, latitude, longitude, `raioMetros` (padrão 150) |
| `Galpao` | nome de exibição, endereço, `localId`, `prefixoSenha` (1 letra), ativo |
| `Bancada` | `galpaoId`, `identificacao` (texto: "07", "A"; única por galpão), ativa |
| `Regiao` | código ("500", único), nome ("Centro de Santo André"), ativa |
| `RegiaoBancada` | `galpaoId`, `regiaoId` → `bancadaId`; único por (galpão, região) |
| `Motorista` | nome, CPF (único, só dígitos), hash da senha, `senhaTemporariaExpiraEm`, telefone, `regiaoId`, `deveTrocarSenha`, ativo, `ultimaPlaca`, `ultimoGalpaoId` |
| `Admin` | nome, CPF (único), hash da senha, `senhaTemporariaExpiraEm`, papel (`ADMIN` \| `SUPER_ADMIN`), `deveTrocarSenha`, ativo |
| `Senha` | ver tabela abaixo |
| `ContadorSenha` | (`galpaoId`, `dia`) → último número |
| `LiberacaoGeofence` | motorista, admin, `criadaEm`, `expiraEm` (fim do dia operacional), `usadaEm` |
| `Configuracao` | `toleranciaMin` (5), `carenciaSeg` (30), `tempoPadraoMin` (15), `ocupacaoMaxMin` (120) |
| `PushSubscription` | `endpoint` (único), chaves, motorista, `atualizadaEm` |
| `EnvioPush` | senha, subscription, `enviadoEm`, status HTTP do serviço de push |
| `Sessao` | usuário, tipo, hash do token, `criadaEm`, `expiraEm` |
| `TentativaLogin` | CPF, IP, instante, sucesso |
| `Auditoria` | ator, ação, alvo, dados (antes/depois), instante |

**`Senha`**

| Campo | Descrição |
|---|---|
| `codigo`, `dia` | código exibido e dia operacional da geração; único (`galpaoId`, `dia`, `codigo`) |
| `motoristaId`, `galpaoId`, `bancadaId`, `placa` | placa em maiúsculas, sem hífen |
| snapshot | `motoristaNome`, `galpaoNome`, `galpaoEndereco`, `bancadaIdentificacao`, `regiaoCodigo`, `regiaoNome` — gravados na geração; editar cadastros não muda o histórico |
| `status` | `AGUARDANDO` \| `CHAMADA` \| `EM_ATENDIMENTO` \| `CONCLUIDA` \| `CANCELADA` |
| `geradaEm` | |
| `chamadaEm`, `chamadaPorAdminId`, `prazoEm`, `foraDeOrdem` | `prazoEm = chamadaEm + toleranciaMin` vigente na hora da chamada |
| `aCaminhoEm`, `aCaminhoPor` (`MOTORISTA` \| `ADMIN`) + adminId | |
| `concluidaEm`, `concluidaPor` (`MOTORISTA` \| `ADMIN` \| `SISTEMA`) + adminId | |
| `canceladaEm`, `motivoCancelamento` | `MOTORISTA` \| `EXPIRADA` \| `FIM_DO_DIA` \| `MOTORISTA_DESATIVADO` |
| `resultadoVistoEm` | quando o motorista viu a tela de resultado (RF07, RF12) |
| geolocalização | `lat`, `lng`, `precisaoM`, `distanciaM`, `liberacaoId`; os quatro primeiros ficam nulos quando a senha sai por liberação sem leitura de GPS |

**Dados iniciais (seed)**

| Local | Coordenadas | Galpões (prefixo da senha) |
|---|---|---|
| Av. André Ramalho, 89 | -23.650304755462123, -46.51091622883612 | F SDR (A), SP-R-D228 (E) |
| Av. André Ramalho, 95 | -23.6501175, -46.5108664 | DS AET (C) |
| Av. dos Estados, 6761 | -23.6516062, -46.51458 | F SDR 03 (B), DS SDE (D) |

O galpão da Anjun é exibido como **"SP-R-D228"** no app e no painel (P03). O super-admin vem das variáveis de ambiente (9.4). Bancadas, regiões e motoristas são cadastrados pelo admin.

**Dia operacional:** de `HORA_VIRADA` até a próxima `HORA_VIRADA`, em `America/Sao_Paulo`. `HORA_VIRADA` é variável de ambiente (padrão `00:00`), não é editável pelo painel; mudá-la exige deploy fora do horário de operação. Uma única função do domínio (`limitesDoDia(instante)`, `limitesDaQuinzena(instante)`) calcula os limites. Esses limites são passados como parâmetro às queries; `CURRENT_DATE`/`now()` em SQL são proibidos.

**Ciclo de vida da senha**

```
AGUARDANDO ──(admin Chamar)──▶ CHAMADA ──("Estou a caminho" do motorista
     │                            │          ou "Confirmar chegada" do admin)──▶ EM_ATENDIMENTO
     │(motorista cancela)         │(prazoEm + carência estourou)                     │
     ▼                            ▼                                                   │(motorista ou admin Concluir)
 CANCELADA (MOTORISTA)       CANCELADA (EXPIRADA)                                     ▼
                                                                                  CONCLUIDA

Virada do dia (regras exatas no RF28): AGUARDANDO de dia anterior → CANCELADA (FIM_DO_DIA);
EM_ATENDIMENTO iniciado antes da virada → CONCLUIDA (SISTEMA). CHAMADA segue até o próprio prazo.
Motorista desativado: senha ativa → CANCELADA (MOTORISTA_DESATIVADO).
```

**Transições:** cada uma é um `UPDATE ... WHERE id = ? AND status = <esperado>`. As que partem de `CHAMADA` para `EM_ATENDIMENTO` levam também `AND prazoEm + carência >= agora`. Zero linhas afetadas = `CONFLITO`. Transições fora do diagrama também são `CONFLITO`.

**Contrato das mutações:** toda mutação devolve `{ ok, codigo, estado }`, onde `estado` é o estado atual da senha.
- `codigo = CONFLITO` quando a transição não é válida para o estado atual. Em route handler, isso é HTTP 409 com o `estado` no corpo; em Server Action, o mesmo objeto.
- Neste documento, "409" significa `CONFLITO`.
- No app do motorista, `CONFLITO` nunca aparece como erro: a tela renderiza o `estado` devolvido. No painel, aparece um aviso curto (ex.: "Senha já chamada") e a linha é atualizada.

**Status efetivo:**
- Toda **leitura** calcula o status efetivo sem gravar: uma senha `CHAMADA` com `agoraServidor > prazoEm + carenciaSeg` é tratada como `CANCELADA (EXPIRADA)`.
- Toda **escrita** que encontre uma senha efetivamente expirada persiste antes a expiração, na mesma transação. Isso vale para gerar senha, "Estou a caminho", "Confirmar chegada" e o botão da tela de resultado.
- A varredura (9.2) persiste as demais.

**Rótulos na UI**

| Status | Motorista | Fila ao Vivo | Histórico de Senhas | Histórico de Atendimentos |
|---|---|---|---|---|
| AGUARDANDO | "Aguardando na fila" | Aguardando | Aguardando | — |
| CHAMADA | "Você foi chamado" | Chamado | Atendendo | — |
| EM_ATENDIMENTO | "Em atendimento" | Em atendimento | Atendendo | — |
| CONCLUIDA | "Concluído" | — | Atendida | Concluído |
| CANCELADA | "Cancelada" | — | Cancelada | Cancelado |

**Fórmulas**

| Nome | Definição |
|---|---|
| Fila da bancada | senhas `AGUARDANDO` da bancada, ordenadas por `geradaEm` (FIFO) |
| Posição | índice 1-based na fila da bancada |
| À frente | `posição − 1` |
| Tempo de espera | `chamadaEm − geradaEm` |
| Tempo de carregamento (= duração do atendimento) | `concluidaEm − chamadaEm` (a bancada fica reservada desde a chamada) |
| Tempo total | `concluidaEm − geradaEm` = espera + carregamento |
| Tempo até iniciar | `aCaminhoEm − geradaEm` — só para a métrica da seção 8; é o equivalente aos 30 min de hoje (P21) |
| Média do dia | média do carregamento das senhas `CONCLUIDA` do **galpão** com `dia` = dia operacional atual, excluindo `concluidaPor = SISTEMA` e durações > `ocupacaoMaxMin`; sem amostra → `tempoPadraoMin` |
| Tempo estimado | `à frente × média do dia`; se for 0, o texto é "Você é o próximo" |
| Fila estimada (`233:440`) | N = senhas `AGUARDANDO` na bancada que o motorista receberia; espera = `N × média do dia`; com N = 0, "Sem fila · você será o próximo" |
| Código da senha | `prefixoSenha` + "-" + número do `ContadorSenha` (galpão, dia) com 3 dígitos (`A-001`); o número vem de `INSERT … ON CONFLICT DO UPDATE … RETURNING` na mesma transação da geração |

Senhas com `concluidaPor = SISTEMA`: carregamento e total aparecem como "—" em todas as telas e no CSV, e ficam fora de todas as médias.

Arredondamento:
- Durações exibidas = `floor(segundos / 60)` em minutos.
- Estimativas = `ceil` em minutos.
- O total é calculado a partir dos valores brutos (não da soma dos arredondados).

**KPIs**

"Hoje" = senhas com `dia` = dia operacional atual. Filtros que afetam os KPIs:
- Fila ao Vivo: galpão e bancada.
- Históricos, KPIs "de hoje" e "agora": só galpão.
- Histórico de Atendimentos, "Tempo médio": período e galpão.
- Os filtros de motorista e nº da senha nunca afetam KPIs.

| Tela | KPI | Definição |
|---|---|---|
| Fila ao Vivo | Aguardando | qtde `AGUARDANDO` agora |
| Fila ao Vivo | Em atendimento | qtde `CHAMADA` + `EM_ATENDIMENTO` agora |
| Fila ao Vivo | Tempo médio na fila | média do tempo de espera das senhas de hoje que já têm `chamadaEm` (inclui as que expiraram depois) |
| Hist. Atendimentos | Concluídos hoje | qtde `CONCLUIDA` de hoje |
| Hist. Atendimentos | Cancelados hoje | qtde `CANCELADA` de hoje (todos os motivos) |
| Hist. Atendimentos | Tempo médio | média do tempo total das `CONCLUIDA` no período filtrado, com as mesmas exclusões da Média do dia (`SISTEMA` e carregamento > `ocupacaoMaxMin`) |
| Hist. Senhas | Geradas hoje / Atendidas / Aguardando / Canceladas | qtde de hoje / `CONCLUIDA` de hoje / `AGUARDANDO` agora / `CANCELADA` de hoje |

### 6.1 Requisitos Funcionais

#### Autenticação e sessão

**RF01 — Login do motorista** [`10:2`]
CPF (com máscara) + senha. Sessão de 30 dias deslizantes: cada requisição autenticada empurra `Sessao.expiraEm` para 30 dias à frente (no máximo uma gravação por hora); o cookie tem validade fixa de 400 dias e quem manda é o `expiraEm` do servidor.
- **RF01-CA1**: com credenciais corretas de um motorista ativo, o destino depende do estado:
  - `/trocar-senha`, se `deveTrocarSenha`;
  - senão `/fila`, que no cliente pode desviar para `/notificacoes` conforme o RF05-CA1.
- **RF01-CA2**: CPF inexistente, senha errada, usuário inativo e CPF bloqueado devolvem **a mesma** mensagem: "CPF ou senha inválidos. Após várias tentativas o acesso é bloqueado por 15 minutos."
- **RF01-CA3**: 5 falhas seguidas no mesmo CPF bloqueiam esse CPF por 15 min. Um login com sucesso zera o contador.
- **RF01-CA4**: 100 falhas do mesmo IP em 15 min bloqueiam esse IP por 15 min (o limite é alto porque motoristas no Wi-Fi do pátio ou na mesma operadora compartilham IP). O IP vem do cabeçalho de IP do cliente definido pelo proxy do Railway (nome a confirmar na documentação durante o setup), nunca de um `X-Forwarded-For` enviado pelo cliente.
- **RF01-CA5**: CPF com dígito verificador inválido mostra erro no próprio campo, sem chamar o servidor.
- **RF01-CA6**: o link "termos de uso da CSM" abre `/termos`.

**RF02 — Troca obrigatória de senha** (tela nova, DS)
- **RF02-CA1**: com `deveTrocarSenha`, qualquer rota autenticada redireciona para `/trocar-senha` (motorista) ou `/admin/trocar-senha` (admin).
- **RF02-CA2**: a nova senha tem no mínimo 8 caracteres, é diferente da atual e a confirmação precisa coincidir.
- **RF02-CA3**: depois da troca, segue o RF01-CA1 (motorista) ou vai para `/admin` (admin).
- **RF02-CA4**: senha temporária não trocada em 72 h deixa de autenticar (mensagem do RF01-CA2); o admin precisa redefinir. Exceção: a senha inicial do super-admin (seed) exige troca, mas não expira.

**RF03 — Login do admin** (`/admin/login`, tela nova no DS)
CPF + senha. Sessão de 12 h a partir do login, sem renovação. Valem as regras do RF01-CA2 a CA5 e do RF02.
- **RF03-CA1**: admin ativo autentica e cai em `/admin`.
- **RF03-CA2**: sessão de motorista em `/admin/*` redireciona para `/admin/login`; sessão de admin nas rotas do motorista redireciona para `/login`. `/admin/trocar-senha` é rota do admin.

**RF04 — Logout**
- **RF04-CA1**: apaga a `Sessao`; o cookie antigo recebe 401.
- **RF04-CA2**: apaga a `PushSubscription` do aparelho atual.
- **RF04-CA3**: o motorista sai pelo link "Sair" no rodapé de `/historico`; o admin, pelo item "Sair" no rodapé da Sidebar. Os dois não existem no Figma (10.6).

**RF05 — Permissão e inscrição de notificação** (`/notificacoes`, tela nova)
- **RF05-CA1**: a checagem é feita no cliente, ao abrir `/fila`:
  - com a permissão `granted`, o app faz upsert silencioso da inscrição a cada abertura. Esse upsert é o mecanismo principal de renovação da inscrição;
  - com a permissão `default`, ou no iPhone fora do modo instalado, o app leva para `/notificacoes` (botão "Ativar notificações" e link "Agora não"). Isso só acontece logo após um login, sem senha ativa e sem o flag do RF05-CA6.
- **RF05-CA2**: o upsert usa o `endpoint` como chave única. Se o endpoint estava com outro motorista, é reatribuído ao motorista logado (celular compartilhado).
- **RF05-CA3**: com a permissão `denied` ou sem suporte, a tela de Aguardando (`13:2`) mostra o aviso "Notificações desativadas — mantenha o app aberto para ver a chamada".
- **RF05-CA4**: no iPhone fora do modo instalado, `/notificacoes` mostra as instruções de instalação (RF23) em vez do botão.
- **RF05-CA5**: o handler de `pushsubscriptionchange` do service worker envia a nova inscrição ao servidor (verificado com evento simulado; o Safari não dispara esse evento, e lá vale o upsert do RF05-CA1).
- **RF05-CA6**: "Agora não" grava um flag local e leva a `/fila`. O flag é apagado no logout, então a pergunta só volta no próximo login.

**RF06 — Sessão de usuário desativado ou com senha redefinida**
- **RF06-CA1**: desativar um usuário ou redefinir a senha dele apaga todas as suas `Sessao` e `PushSubscription`; a próxima requisição recebe 401.
- **RF06-CA2**: toda requisição autenticada confere `ativo = true` no servidor.
- **RF06-CA3**: desativar um motorista com senha ativa cancela a senha (`MOTORISTA_DESATIVADO`), grava `resultadoVistoEm` e a remove da Fila ao Vivo.

#### Fluxo do motorista

**RF07 — Roteamento de `/fila`**
- **RF07-CA1**: com senha ativa, mostra a tela do status efetivo: `13:2` (AGUARDANDO), `18:2` (CHAMADA), `19:2` (EM_ATENDIMENTO).
- **RF07-CA2**: sem senha ativa, mas com a última senha encerrada e `resultadoVistoEm` nulo, mostra a tela de resultado:
  - `19:35` se CONCLUIDA pelo motorista ou pelo admin;
  - "Atendimento encerrado" se CONCLUIDA pelo SISTEMA;
  - "Você perdeu a vez" se EXPIRADA (status efetivo);
  - "Sua senha expirou" se FIM_DO_DIA.

  Os textos completos estão na 10.5. Cancelamento pelo próprio motorista e desativação já gravam `resultadoVistoEm`, então não têm tela de resultado.
- **RF07-CA3**: nos demais casos, mostra Gerar senha (`233:440` / `12:2`).
- **RF07-CA4**: o botão da tela de resultado ("Voltar ao início" ou "Gerar nova senha") grava `resultadoVistoEm` e leva a Gerar senha. Se a senha ainda estiver `CHAMADA` no banco, a ação persiste a expiração antes; `resultadoVistoEm` só é gravado em senha com status persistido `CONCLUIDA` ou `CANCELADA`.

**RF08 — Tela Gerar senha** [`233:440` disponível, `12:2` bloqueado]
- **RF08-CA1**: a placa vem preenchida com `ultimaPlaca`. Aceita o formato antigo (`ABC1234`) e o Mercosul (`ABC1D23`), com ou sem hífen, maiúsculas ou minúsculas; exibe com hífen depois da 3ª letra.
- **RF08-CA2**: o galpão pré-selecionado é o `ultimoGalpaoId` (ou o primeiro habilitado).
- **RF08-CA3**: aparece desabilitado, com a legenda "Sua região não é atendida aqui", o galpão que:
  - não tem mapeamento para a região do motorista; ou
  - tem mapeamento para uma bancada inativa.
- **RF08-CA4**: se todos os galpões estiverem desabilitados, mostra "Sua região não está configurada — fale com o administrador" e o botão fica desabilitado.
- **RF08-CA5**: o card "Fila estimada agora" segue a fórmula da 6.0 para o galpão selecionado e se atualiza ao trocar de galpão.
- **RF08-CA6**: o cabeçalho mostra "Olá, motorista" + o nome, e o botão "Histórico" leva a `/historico`.

**RF09 — Geofence**
Leitura com `enableHighAccuracy: true`, `maximumAge: 0`, `timeout: 15 s`, ao abrir a tela e ao tocar "Gerar senha". O servidor calcula a distância (haversine) até o `Local` do galpão selecionado, usando as coordenadas recebidas.
- **RF09-CA1**: distância ≤ `raioMetros` e precisão ≤ `raioMetros` → chip "Dentro do pátio - gerar senha disponível" (Success) e botão habilitado.
- **RF09-CA2**: distância > raio → chip "Fora do pátio - gerar senha bloqueado" (Danger) e botão desabilitado, como em `12:2`.
- **RF09-CA3**: precisão > raio → chip "Localização imprecisa", botão desabilitado e link "Tentar novamente".
- **RF09-CA4**: permissão negada, timeout ou erro → chip "Localização indisponível", com o texto "Ative a localização ou peça liberação ao administrador" e o botão desabilitado.
- **RF09-CA5**: com `LiberacaoGeofence` válida, o chip é "Liberado pelo administrador" e o botão fica habilitado, independentemente da localização.
- **RF09-CA6**: ao trocar de galpão, o chip é recalculado com a última leitura, sem uma nova leitura de GPS.
- **RF09-CA7**: o servidor recalcula tudo na geração. Uma requisição com coordenadas fora do raio, sem liberação, recebe 403.
- **RF09-CA8**: latitude, longitude, precisão e distância ficam gravadas na senha (nulas se a senha saiu por liberação sem leitura de GPS). Depois da geração a localização não é mais lida.

**RF10 — Gerar senha**
- **RF10-CA1**: cria a senha `AGUARDANDO` na bancada mapeada para (galpão, região), com código, `dia` e snapshot conforme a 6.0.
- **RF10-CA2**: requisições simultâneas do mesmo motorista criam no máximo uma senha ativa. Um índice único parcial garante isso; o conflito redireciona para a senha existente.
- **RF10-CA3**: 20 gerações simultâneas no mesmo galpão produzem 20 códigos distintos e sequenciais.
- **RF10-CA4**: a liberação usada é marcada com `usadaEm` e não serve para uma segunda senha.
- **RF10-CA5**: atualiza `ultimaPlaca` e `ultimoGalpaoId`.
- **RF10-CA6**: com uma senha `CHAMADA` já expirada e ainda não varrida, gerar nova senha funciona: a antiga é persistida como `CANCELADA (EXPIRADA)` na mesma transação.
- **RF10-CA7**: o servidor rejeita (403) a geração para galpão sem mapeamento para a região do motorista ou com bancada inativa.

**RF11 — Aguardando** [`13:2`]
- **RF11-CA1**: posição e tempo estimado seguem a 6.0. O texto "Sua vez está próxima" aparece só com posição ≤ 2; nas demais posições, o texto é "Acompanhe sua posição".
- **RF11-CA2**: com o app em primeiro plano, mudanças na fila da bancada atualizam a tela em até 5 s.
- **RF11-CA3**: com o app em primeiro plano, a chamada troca a tela para `18:2` em até 5 s, mesmo sem push.
- **RF11-CA4**: ao voltar para o primeiro plano (`visibilitychange`), o app busca o estado no servidor em até 2 s.

**RF12 — Cancelar senha** [`144:447`]
- **RF12-CA1**: "Cancelar senha" abre o overlay com o texto "Você perderá sua posição atual (Nº)"; "Voltar" fecha sem alterar nada.
- **RF12-CA2**: "Sim, cancelar senha" grava `CANCELADA (MOTORISTA)` e `resultadoVistoEm`, e leva a Gerar senha.
- **RF12-CA3**: o cancelamento só é aceito em AGUARDANDO; nos outros status recebe 409.

**RF13 — Chamado, tolerância e expiração** [`18:2`]
- **RF13-CA1**: a tela mostra a bancada, a senha e a contagem regressiva até `prazoEm`. A contagem usa o relógio do servidor: o servidor envia `agoraServidor` e `prazoEm`, e o cliente aplica o offset.
- **RF13-CA2**: "Estou a caminho" é aceito se `recebidoEm ≤ prazoEm + carenciaSeg` (relógio do servidor, inclusivo). Grava `aCaminhoEm`, `aCaminhoPor = MOTORISTA` e muda para EM_ATENDIMENTO.
- **RF13-CA3**: recebido depois desse limite → `CONFLITO`, e a tela mostra "Você perdeu a vez".
- **RF13-CA4**: quando a contagem chega a zero com o app aberto, o botão "Estou a caminho" continua habilitado, com o texto "Confirme agora", até `prazoEm + carenciaSeg`. Depois disso o app consulta o servidor e só mostra "Você perdeu a vez" quando o status efetivo for `CANCELADA (EXPIRADA)`.
- **RF13-CA5**: a varredura persiste a expiração em até 30 s depois de `prazoEm + carenciaSeg`.
- **RF13-CA6**: mudar `toleranciaMin` não altera o `prazoEm` de chamadas já feitas.
- **RF13-CA7**: o texto "Apresente-se na bancada em até N minutos" usa o `toleranciaMin` gravado na chamada.

**RF14 — Em atendimento e Concluído** [`19:2`, `19:35`]
- **RF14-CA1**: `19:2` mostra a bancada, a senha, o cronômetro "Carregamento" desde `chamadaEm` (relógio do servidor) e o card com:
  - Senha;
  - Início (`chamadaEm`);
  - Placa, Galpão, Endereço e Rota, todos do snapshot;
  - Conferente (P10).
- **RF14-CA2**: o botão novo "Concluir atendimento" (Button Primary) abre a confirmação "Concluir atendimento? Confirme só depois de terminar o carregamento." Ao confirmar, grava `CONCLUIDA (MOTORISTA)`.
- **RF14-CA3**: se o admin concluir, a tela troca para `19:35` em até 5 s (com o app em primeiro plano).
- **RF14-CA4**: `19:35` mostra senha, bancada, rota, tempo de espera, de carregamento e total, conforme a 6.0. Não aparece para senhas concluídas pelo SISTEMA (RF07-CA2).
- **RF14-CA5**: a barra de etapas de `19:2` não é exibida (P16).
- **RF14-CA6**: a seta "←" de `19:2` não é exibida (a tela não tem para onde voltar). A de `19:64` leva a `/fila`.

**RF15 — Histórico do motorista** [`19:64`]
- **RF15-CA1**: lista as senhas `CONCLUIDA` e `CANCELADA` do motorista com `dia` nos últimos 90 dias, da mais recente para a mais antiga. Cada item tem:
  - data/hora (`geradaEm`), senha, bancada e rota;
  - tempo total (ou "—") e status.
- **RF15-CA2**: os cards "Atendimentos" (qtde CONCLUIDA) e "Espera média" (média do tempo de espera das que têm `chamadaEm`) usam o mesmo período.
- **RF15-CA3**: sem itens, mostra "Você ainda não tem atendimentos"; os cards mostram 0 e "—".
- **RF15-CA4**: o botão "Exportar" não é exibido (P16).

**RF16 — Navegação**

| Rota | Tab Bar |
|---|---|
| `/login`, `/trocar-senha`, `/notificacoes`, `/termos`, `/instalar` (públicas: `/login`, `/termos`, `/instalar`) | não |
| `/fila` em Gerar senha, Aguardando e telas de resultado | sim |
| `/fila` em Chamado (`18:2`), Em atendimento (`19:2`) e Concluído (`19:35`) | não |
| `/historico`, `/em-breve` | sim |

- **RF16-CA1**: a Tab Bar segue a tabela acima.
- **RF16-CA2**: as abas Disponibilidade e Demonstrativo abrem `/em-breve` ("Em breve — esta função chega na próxima versão do app").

#### Painel admin

Layout comum (`04 · Administrador`): Sidebar de 260 px + área de conteúdo.
- **Itens do MVP:** Fila ao Vivo, Histórico de Atendimentos, Histórico de Senhas, Motoristas, Bancadas e Regiões, Configurações e, só para o super-admin, Administradores.
- **Fases futuras:** Confirmações e Demonstrativos aparecem desabilitados, com "Em breve".

**RF17 — Fila ao Vivo** [`170:26`]
- **RF17-CA1**: KPIs conforme a tabela da 6.0.
- **RF17-CA2**: a tabela tem as colunas Senha, Motorista, Galpão, Status, Posição/Bancada, Tempo e Status de chamado. Mostra **sempre todas** as senhas ativas; não há filtro de período (P19). Senha com `dia` diferente de hoje mostra a data ao lado do código.
- **RF17-CA3**: Posição/Bancada mostra "Nº na fila · Bancada X" (AGUARDANDO) ou "Bancada X" (demais) (P16).
- **RF17-CA4**: Tempo = minutos desde `geradaEm` (AGUARDANDO) ou desde `chamadaEm` (CHAMADA e EM_ATENDIMENTO).
- **RF17-CA5**: Status de chamado por status:
  - AGUARDANDO: botão "Chamar"; fica desabilitado, com o texto "Bancada ocupada", enquanto a bancada tiver outra senha `CHAMADA` ou `EM_ATENDIMENTO`;
  - CHAMADA: a contagem regressiva até `prazoEm` + o botão "Confirmar chegada";
  - EM_ATENDIMENTO: o botão "Concluir".
- **RF17-CA6**: ordenação por galpão → bancada → status (EM_ATENDIMENTO, CHAMADA, AGUARDANDO) → posição.
- **RF17-CA7**: filtros: motorista (nome ou CPF), nº da senha, galpão e bancada (dependente do galpão).
- **RF17-CA8**: mudanças de qualquer usuário aparecem sem recarregar, em até 5 s.
- **RF17-CA9**: sem senhas ativas, a tela mostra "Nenhum motorista na fila agora".
- **RF17-CA10**: o subtítulo é "Estado em tempo real · <dia da semana>, <data por extenso> — <hh:mm>", com o relógio do servidor.

**RF18 — Chamar**
- **RF18-CA1**: muda para CHAMADA e grava `chamadaEm`, `chamadaPorAdminId` e `prazoEm`; registra auditoria.
- **RF18-CA2**: chamar uma senha que não é a 1ª da bancada abre a confirmação "Há N motoristas antes nesta bancada. Chamar mesmo assim?" e grava `foraDeOrdem = true` (P06). N e `foraDeOrdem` são calculados pelo servidor, na transação da chamada.
- **RF18-CA3**: dois admins chamando a mesma senha: só um vale; o outro vê "Senha já chamada" (409).
- **RF18-CA4**: o push vai para todas as inscrições do motorista, com:
  - título "Você foi chamado" e corpo "Dirija-se à bancada X · Senha Y";
  - `urgency: high`, `TTL = toleranciaMin × 60` e `topic` = id da senha sem hífens, truncado em 32 caracteres (limite do cabeçalho `Topic`).

  Tocar na notificação abre `/fila`.
- **RF18-CA5**: cada envio grava um `EnvioPush` com o status HTTP. Inscrições que respondem 404/410 são apagadas. Falha no push não desfaz a chamada.
- **RF18-CA6**: cada bancada atende um motorista por vez. Chamar uma senha cuja bancada já tem outra senha `CHAMADA` ou `EM_ATENDIMENTO` devolve `CONFLITO` ("Bancada X ocupada pela senha <código>"). A bancada só fica livre quando a senha ocupante é concluída, expira ou é cancelada. A verificação é feita na mesma transação da chamada (dois admins chamando para a mesma bancada ao mesmo tempo: só um vale), com um índice único parcial sobre `bancadaId` nos status `CHAMADA` e `EM_ATENDIMENTO`.

**RF19 — Confirmar chegada e Concluir (admin)**
- **RF19-CA1**: "Confirmar chegada" numa senha CHAMADA dentro de `prazoEm + carenciaSeg` muda para EM_ATENDIMENTO e grava `aCaminhoEm = agora`, `aCaminhoPor = ADMIN` e o adminId (P15).
- **RF19-CA2**: "Concluir" numa senha EM_ATENDIMENTO pede confirmação e grava `CONCLUIDA (ADMIN)`.
- **RF19-CA3**: as duas ações gravam auditoria e respondem 409 se o status já mudou.

**RF20 — Histórico de Atendimentos** [`171:95`]
- **RF20-CA1**: lista senhas `CONCLUIDA` e `CANCELADA` com as colunas:
  - Data/Hora (`geradaEm`), Motorista, Senha e Bancada;
  - Tempo total (ou "—") e Status.
- **RF20-CA2**: KPIs conforme a 6.0.
- **RF20-CA3**: período padrão = últimos 7 dias operacionais (inclusive hoje), com filtro de `dia` inclusivo nos dois extremos. Também filtra por motorista, nº da senha e galpão.
- **RF20-CA4**: paginação de 50 linhas, da mais recente para a mais antiga.
- **RF20-CA5**: sem resultado, mostra "Nenhum atendimento no período".
- **RF20-CA6**: o subtítulo é "<período> · N atendimentos concluídos · M cancelados", com as contagens do filtro atual.

**RF21 — Histórico de Senhas** [`172:170`]
- **RF21-CA1**: colunas Senha, Data/Hora, Motorista, Galpão, Rota e Status, com os rótulos da 6.0.
- **RF21-CA2**: KPIs conforme a 6.0.
- **RF21-CA3**: período padrão = quinzena atual (dias 1–15 ou 16–último dia), com a mesma barra de filtros do RF20 (P18).
- **RF21-CA4**: paginação de 50 linhas e estado vazio "Nenhuma senha no período".
- **RF21-CA5**: o subtítulo é "<período> · N senhas geradas", com a contagem do filtro atual.

**RF22 — Exportar CSV** [`216:470`]
- **RF22-CA1**: "Exportar" abre o modal do Figma ("Exportar?" / "Isso vai baixar os dados desta tabela para o seu computador." / "Sim, exportar" / "Cancelar").
- **RF22-CA2**: o CSV tem as mesmas colunas de dados da tabela (sem a coluna de botões "Status de chamado") e todas as linhas do filtro atual (todas as páginas), até 10.000 linhas. Acima disso, mostra "Refine o período para exportar".
- **RF22-CA3**: o arquivo sai em UTF-8 com BOM, separador `;`, datas `dd/mm/aaaa hh:mm` e nome `<tela>_AAAA-MM-DD_HHmm.csv`, com `<tela>` = `fila-ao-vivo`, `atendimentos` ou `senhas`. Com 0 linhas, sai só o cabeçalho.
- **RF22-CA4**: células que começam com `=`, `+`, `-` ou `@` recebem o prefixo `'`.
- **RF22-CA5**: o CPF não sai no CSV, e a requisição de exportação é POST (os filtros vão no corpo).

**RF23 — Instalação do PWA**
- **RF23-CA1**: manifest com nome, ícones gerados de `assets/logoCsm.png`, cores do DS e `display: standalone`. Prova: Chrome DevTools → Application → Manifest sem erros de instalabilidade, e instalação concluída em 1 Android e 1 iPhone.
- **RF23-CA2**: `/instalar` mostra o passo a passo para Android (Chrome) e iPhone (Safari → Compartilhar → Adicionar à Tela de Início).
- **RF23-CA3**: `/instalar` é pública e tem link em `/login` ("Como instalar o app"). No iPhone, o login é feito depois de instalar, porque o app instalado não herda a sessão do Safari.

#### Cadastros (telas novas no DS: Sidebar, tabela, Input Field, Button, modal)

**RF24 — Motoristas**
- **RF24-CA1**: o cadastro pede nome, CPF, telefone e região. O sistema gera uma senha temporária aleatória de 8 caracteres, mostrada **uma vez** ao admin, e marca `deveTrocarSenha`.
- **RF24-CA2**: CPF duplicado ou inválido mostra erro no campo.
- **RF24-CA3**: dá para editar nome, telefone e região. Trocar a região não altera a senha ativa.
- **RF24-CA4**: desativar e reativar seguem o RF06. Não existe exclusão.
- **RF24-CA5**: "Redefinir senha" gera uma nova senha temporária, conforme o RF24-CA1 e o RF06-CA1, e zera o bloqueio de login daquele CPF.
- **RF24-CA6**: "Liberar geração de senha" cria uma `LiberacaoGeofence` válida até o fim do dia operacional ou até ser usada; a lista mostra "Liberado".
- **RF24-CA7**: busca por nome ou CPF via POST; o CPF nunca vai na URL.

**RF25 — Bancadas e Regiões** (uma tela, três blocos)
- **RF25-CA1**: bancadas por galpão: adicionar (identificação), renomear, desativar e reativar.
- **RF25-CA2**: regiões: adicionar (código + nome), renomear, desativar e reativar.
- **RF25-CA3**: mapeamento: para cada (galpão, região), um select com as bancadas ativas daquele galpão, ou "—" para nenhuma.
- **RF25-CA4**: desativar uma bancada com senhas ativas é bloqueado. Desativar uma região com motoristas ativos também é bloqueado. Nos dois casos a mensagem informa a quantidade.
- **RF25-CA5**: mudar o mapeamento não altera senhas já geradas.
- **RF25-CA6**: identificação de bancada repetida no mesmo galpão e código de região repetido mostram erro no campo.

**RF26 — Configurações**
- **RF26-CA1**: campos editáveis e limites:
  - `toleranciaMin` (1–30);
  - `carenciaSeg` (0–120);
  - `tempoPadraoMin` (1–120);
  - `ocupacaoMaxMin` (30–480);
  - `raioMetros` de cada local (50–2000).
- **RF26-CA2**: cada alteração grava auditoria com o valor anterior e o novo.

**RF27 — Administradores (só super-admin)**
- **RF27-CA1**: criar (nome + CPF, com senha temporária conforme o RF24-CA1), desativar, reativar e redefinir senha. Desativar e redefinir seguem o RF06-CA1.
- **RF27-CA2**: um `ADMIN` não vê o menu e recebe 403 nas rotas e ações de administradores.
- **RF27-CA3**: existe exatamente um `SUPER_ADMIN`, que não pode ser desativado. A transferência é feita pelo comando `npm run admin:transferir-super -- --cpf=<cpf>` (P23). Se o super-admin esquecer a senha ou ficar bloqueado, o comando `npm run admin:redefinir-senha -- --cpf=<cpf>` gera uma senha temporária e zera os bloqueios.

**RF28 — Virada do dia**
- **RF28-CA1**: a cada execução do job (9.2), com `inícioDoDia` = início do dia operacional atual:
  - `AGUARDANDO` com `dia` anterior ao atual → `CANCELADA (FIM_DO_DIA)`, com `canceladaEm = inícioDoDia`;
  - `EM_ATENDIMENTO` com `aCaminhoEm < inícioDoDia` → `CONCLUIDA (SISTEMA)`, com `concluidaEm = inícioDoDia`;
  - `CHAMADA` não muda e segue o próprio prazo. Se virar `EM_ATENDIMENTO` depois da virada (ex.: chamada às 23:58, "Estou a caminho" às 00:01), só é encerrada pelo sistema na virada seguinte.
- **RF28-CA2**: o motorista afetado vê a tela de resultado do RF07-CA2.
- **RF28-CA3**: a virada é idempotente; rodar duas vezes (ou em duas instâncias) produz o mesmo resultado.

**RF29 — Auditoria**
- **RF29-CA1**: registram ator, ação, alvo e instante:
  - login (sucesso e falha), logout;
  - chamar (com `foraDeOrdem`), confirmar chegada, concluir (motorista, admin e sistema), cancelar, expirar;
  - liberar geofence, alterar configuração e qualquer ação de cadastro.

**RF30 — Erros de rede**
- **RF30-CA1**: toda ação do motorista mostra "Enviando…" e faz 1 envio + até 3 repetições automáticas, depois de 1, 2 e 4 s.
- **RF30-CA2**: se as 4 tentativas falharem, aparece o banner "Sem conexão. Verifique sua internet e tente novamente.", com o botão "Tentar novamente".
- **RF30-CA3**: as ações são idempotentes: repetir "Estou a caminho", cancelar ou concluir sobre um estado que já mudou devolve `CONFLITO` com o estado atual, que a tela renderiza sem mostrar erro (contrato da 6.0).

### 6.2 Requisitos Não Funcionais

**RNF01 — Performance e atualização**
- **RNF01-CA1**: eventos da fila chegam às telas abertas em primeiro plano em até 5 s. Sem SSE, o fallback é polling a cada 4 s.
- **RNF01-CA2**: a expiração aparece em até 35 s depois de `prazoEm + carenciaSeg`.
- **RNF01-CA3**: no staging do Railway, com 180 motoristas e 200 senhas no dia: 50 conexões SSE abertas + 10 req/s por 60 s (80% `GET /api/fila/estado`, 20% gerar/chamar) dão p95 ≤ 500 ms e 0 erros. Os volumes são estimados (P26).
- **RNF01-CA4**: as telas do motorista têm LCP ≤ 2,5 s no Lighthouse mobile (perfil de 4G simulado).

**RNF02 — Segurança**
- **RNF02-CA1**: senhas e senhas temporárias em argon2id, nunca registradas em log.
- **RNF02-CA2**: cookie de sessão `httpOnly`, `Secure` e `SameSite=Lax`; o token é guardado como hash.
- **RNF02-CA3**: autorização (perfil + dono do recurso + `ativo`) checada no servidor em toda ação.
- **RNF02-CA4**: CPF nunca aparece em URL ou query string; nos logs sai mascarado (`***.***.***-00`).
- **RNF02-CA5**: HTTPS obrigatório.

**RNF03 — Privacidade (LGPD)**
- A localização é lida só na tela Gerar senha e gravada apenas na senha gerada.
- `/termos` exibe o texto fornecido pela CSM; até a entrega, mostra um placeholder. A entrega do texto é dependência do go-live (P14).
- Spoofing de GPS (app de localização falsa) é risco aceito (P20).

**RNF04 — Usabilidade e fidelidade ao Figma**
- **RNF04-CA1**: telas do motorista sem scroll horizontal de 360 a 430 px; alvos de toque ≥ 44 px.
- **RNF04-CA2**: telas do admin sem scroll horizontal a partir de 1280 px.
- **RNF04-CA3**: fidelidade conferida por screenshots do Playwright (390×844 e 1440×900) comparadas lado a lado com o Figma, em checklist manual.
- **RNF04-CA4**: textos em pt-BR; datas e horas em `America/Sao_Paulo`, formato brasileiro.
- **Contraste:** onde o Figma usa um par abaixo do AA (ex.: `text-muted` sobre `elevated`, ~4,2:1), prevalece o Figma. A exceção está registrada aqui.

**RNF05 — Compatibilidade**
Android: Chrome das 2 últimas versões principais. iPhone: Safari no iOS 16.4+ (push só com o PWA instalado). Admin: Chrome e Edge atuais.

**RNF06 — Confiabilidade e operação**
- Railway com 1 réplica do app + Postgres gerenciado, com backup diário. Ambientes `staging` e `production`.
- **RNF06-CA1**: a varredura e a virada rodando em 2 processos ao mesmo tempo produzem uma única transição e um único registro de auditoria por senha (no deploy, o Railway sobrepõe a versão nova e a antiga por alguns segundos).
- Logs estruturados em JSON, com nível e request id.

**RNF07 — Qualidade de código**
`lint`, `typecheck`, `test` e `test:ca-coverage` passam antes de cada merge. As regras da 6.0 são funções puras em `src/domain/`, com testes unitários.

---

## 7. Fluxo do Usuário / Jornada

**Motorista — caminho feliz**
1. Instala o app, faz login com CPF + senha temporária, troca a senha e ativa as notificações.
2. Em Gerar senha, o app confirma que ele está dentro do pátio; ele confere a placa, escolhe o galpão e toca "Gerar senha".
3. Recebe a senha (ex.: `A-042`), vê a posição na fila da bancada da sua região e o tempo estimado. Pode sair de perto.
4. O admin clica "Chamar"; o celular recebe "Dirija-se à bancada 07".
5. O motorista toca "Estou a caminho" dentro do prazo e vai para a bancada.
6. Ao terminar, toca "Concluir atendimento" (ou o admin conclui) e vê o resumo.

**Exceções**
- Fora do raio, sem GPS ou com localização imprecisa → pede liberação → o admin libera no cadastro → o motorista gera a senha.
- Sem sinal depois de chamado → o admin usa "Confirmar chegada".
- Não confirmou a tempo → perde a vez → gera nova senha e volta ao fim da fila.
- Desistiu enquanto aguardava → cancela a senha.

**Admin**
1. Faz login e abre a Fila ao Vivo (agrupada por galpão e bancada).
2. Quando uma bancada fica livre, chama o 1º daquela bancada.
3. Confirma chegada ou conclui quando o motorista não consegue.
4. Consulta os históricos e exporta CSV.

---

## 8. Critérios de Sucesso / Métricas

Todas as métricas saem do banco, exceto a adoção.

| KPI | Como medir | Meta proposta (P13) |
|---|---|---|
| Adoção | senhas concluídas/dia ÷ atendimentos/dia informados pela CSM, por galpão. Só F SDR, F SDR 03 e DS AET têm linha de base; para DS SDE e SP-R-D228 a CSM informa a média antes do go-live (P27) | ≥ 80% após 30 dias |
| Tempo de resposta à chamada | mediana de `aCaminhoEm − chamadaEm`, só com `aCaminhoPor = MOTORISTA` | ≤ 3 min |
| Perda de vez | % de chamadas que terminam em `EXPIRADA` | ≤ 10% |
| Tempo até iniciar o carregamento | média de `aCaminhoEm − geradaEm` (motorista ou admin) | abaixo dos 30 min atuais (P21) |
| Push aceito | % de `EnvioPush` com status 201 | ≥ 95% |
| Liberação manual | % de senhas geradas com `liberacaoId` | ≤ 10% (indica raio mal calibrado, P04) |

---

## 9. Especificação Técnica

### 9.1 Stack e versões

| Item | Versão | Observação |
|---|---|---|
| Node.js | 22 LTS (local 22.19.0) | fixar em `engines` e no Railway |
| Next.js | 16.4.x (App Router) | |
| React | 19.x | |
| TypeScript | **5.9.3** | o `typescript-eslint` exigido pelo `eslint-config-next` 16 aceita só `< 6.1`; a 7.x está fora |
| Prisma | 7.10.x (`prisma`, `@prisma/client`, `@prisma/adapter-pg`) | a 8.0 ainda é RC |
| PostgreSQL | 16+ (Railway) | colunas de instante em `@db.Timestamptz` |
| Tailwind CSS | 4.x | tokens do DS via `@theme` |
| Zod | 4.x | |
| `@node-rs/argon2` | 2.x | |
| `web-push` | 4.x | |
| `pg` | 8.x | conexão dedicada para `LISTEN` |
| Vitest | 5.x | |
| Playwright | 1.65.x | `setGeolocation`, `page.clock` |
| ESLint | config flat do `eslint-config-next` 16 + Prettier | |
| autocannon | atual | teste de carga |
| Gerenciador | npm | |

### 9.2 Arquitetura

- **Monolito Next.js**: Server Components para leitura; Server Actions e route handlers para mutações.
- **Camadas**:
  - `src/domain/` — regras puras da 6.0 e um `Clock` injetável (o relógio vem sempre do servidor);
  - `src/server/` — db, auth, push, realtime e jobs;
  - `src/app/(motorista)/` e `src/app/admin/` — telas;
  - `src/app/api/` — SSE e endpoints do service worker;
  - `src/components/ui/` — componentes do DS.
- **Concorrência**:
  - transições com `UPDATE ... WHERE status = <esperado>`;
  - índice único parcial `senha(motoristaId) WHERE status IN ('AGUARDANDO','CHAMADA','EM_ATENDIMENTO')`, criado numa migração SQL manual (o Prisma não expressa `WHERE` em `@@unique`). O erro P2002 é tratado como "já existe senha ativa";
  - contador de código via `ContadorSenha` com `ON CONFLICT … RETURNING`.
- **Tempo real**:
  - cada mutação faz `NOTIFY fila_eventos` com `{galpaoId, senhaId}`. O evento **só invalida**: o cliente refaz o fetch de um JSON leve (`/api/fila/estado`), e não usa `router.refresh()`;
  - `/api/stream` (SSE) envia heartbeat a cada 20 s, com os cabeçalhos `Cache-Control: no-cache, no-transform` e `X-Accel-Buffering: no`;
  - a conexão `LISTEN` reconecta com backoff e emite `invalidate-all` ao reconectar;
  - o cliente reconecta o SSE e refaz o fetch a cada reconexão e a cada `visibilitychange`. Sem SSE, faz polling a cada 4 s.
- **Jobs**: a varredura de expiração e a virada rodam a cada 30 s, iniciadas em `instrumentation.ts`:
  - guarda `process.env.NEXT_RUNTIME === 'nodejs'` + flag global contra HMR;
  - idempotentes;
  - leituras nunca gravam (status efetivo, 6.0).
- **Push**: o service worker trata `push`, `notificationclick` e `pushsubscriptionchange`.
- **PWA**: `app/manifest.ts` + `public/sw.js` **só para push**. O service worker não faz cache de `/_next/` nem de HTML, para não quebrar depois de um deploy.

### 9.3 Rotas

| Rota | Tela | Figma |
|---|---|---|
| `/login` | Identificação | `10:2` |
| `/trocar-senha`, `/admin/trocar-senha` | Troca de senha (motorista / admin) | — |
| `/notificacoes` | Ativar notificações | — |
| `/instalar` | Como instalar | — |
| `/termos` | Termos de uso | — |
| `/fila` | Gerar senha, Aguardando, Chamado, Em atendimento, telas de resultado | `233:440`, `12:2`, `13:2`, `144:447`, `18:2`, `19:2`, `19:35` |
| `/historico` | Histórico | `19:64` |
| `/em-breve` | Abas futuras | — |
| `/admin/login` | Login admin | — |
| `/admin` | Fila ao Vivo | `170:26` |
| `/admin/atendimentos` | Histórico de Atendimentos | `171:95` |
| `/admin/senhas` | Histórico de Senhas | `172:170` |
| `/admin/motoristas` | Motoristas | — |
| `/admin/bancadas-regioes` | Bancadas e Regiões | — |
| `/admin/configuracoes` | Configurações | — |
| `/admin/administradores` | Administradores | — |
| `/api/stream`, `/api/fila/estado` | SSE e estado | — |

### 9.4 Variáveis de ambiente

`DATABASE_URL`, `DATABASE_URL_TEST`, `APP_URL`, `TZ=America/Sao_Paulo`, `HORA_VIRADA` (padrão `00:00`), `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:`), `SUPERADMIN_NOME`, `SUPERADMIN_CPF`, `SUPERADMIN_SENHA_INICIAL`.

Um `.env.example` versionado lista todas; os `.env*` reais ficam no `.gitignore`.

### 9.5 Comandos

| Comando | Faz |
|---|---|
| `npm run dev` | desenvolvimento |
| `npm run build` / `npm start` | produção |
| `npm run lint` / `npm run typecheck` | ESLint / `tsc --noEmit` |
| `npm test` | Vitest (unit + integração com `DATABASE_URL_TEST`) |
| `npm run test:e2e` | Playwright |
| `npm run test:ca-coverage` | falha se algum `RFxx-CAy`/`RNFxx-CAy` do PRD não aparecer no nome de um teste nem em `docs/checklist-manual.md`; testes `skip`/`todo` não contam |
| `npm run test:load` | autocannon com 50 SSE abertos (RNF01-CA3) |
| `npm run db:migrate` / `npm run db:deploy` | migrações (dev / pre-deploy) |
| `npm run db:seed` | seed idempotente (9.7) |
| `npm run admin:transferir-super` | transfere o papel de super-admin (RF27-CA3) |
| `npm run admin:redefinir-senha` | gera senha temporária e zera bloqueios de um admin (RF27-CA3) |

### 9.6 Estratégia de testes (prova dos CAs)

Regra: **todo CA tem um teste com o ID no nome** (ex.: `it('RF13-CA2: aceita Estou a caminho até prazo + carência')`) ou uma linha em `docs/checklist-manual.md`. O `test:ca-coverage` verifica isso. A tabela abaixo diz em qual camada cada CA é provado; cada ID aparece uma vez.

| Camada | CAs |
|---|---|
| **Unit** (Vitest, `Clock` falso) | Toda a 6.0 (fórmulas, KPIs, arredondamento, dia operacional e quinzena, incluindo 23:30 de São Paulo, código, transições, status efetivo). RF01-CA5 · RF05-CA5 · RF08-CA1 · RF09-CA1, CA2, CA3, CA6 · RF11-CA1 · RF13-CA1, CA7 · RF22-CA3, CA4 · RNF04-CA4 |
| **Integração** (Vitest + Postgres, `Clock` falso) | RF01-CA2, CA3, CA4 · RF02-CA1, CA2, CA4 · RF03-CA1, CA2 · RF04-CA1, CA2 · RF05-CA2 · RF06-CA1, CA2, CA3 · RF07-CA1, CA2, CA3, CA4 · RF08-CA2, CA3, CA4, CA5 · RF09-CA5, CA7, CA8 · RF10-CA1 a CA7 · RF12-CA2, CA3 · RF13-CA2, CA3, CA5, CA6 · RF15-CA1, CA2 · RF17-CA1, CA2, CA3, CA4, CA6, CA7 · RF18-CA1 a CA6 · RF19-CA1, CA2, CA3 · RF20-CA1, CA2, CA3, CA4, CA6 · RF21-CA1, CA2, CA3, CA5 · RF22-CA2, CA5 · RF24-CA1 a CA7 · RF25-CA1 a CA6 · RF26-CA1, CA2 · RF27-CA1, CA2, CA3 · RF28-CA1, CA2, CA3 · RF29-CA1 · RF30-CA3 · RNF01-CA2 · RNF02-CA1, CA2, CA3, CA4 · RNF06-CA1 |
| **E2E** (Playwright, 2 contextos, `setGeolocation`) | RF01-CA1, CA6 · RF02-CA3 · RF04-CA3 · RF05-CA1, CA3, CA6 · RF08-CA6 · RF09-CA4 · RF11-CA2, CA3, CA4 · RF12-CA1 · RF13-CA4 · RF14-CA1 a CA6 · RF15-CA3, CA4 · RF16-CA1, CA2 · RF17-CA5, CA8, CA9, CA10 · RF20-CA5 · RF21-CA4 · RF22-CA1 · RF23-CA2, CA3 · RF30-CA1, CA2 · RNF01-CA1 · RNF04-CA1, CA2 |
| **Carga** (`test:load`) | RNF01-CA3 |
| **Manual** (`docs/checklist-manual.md`) | RF05-CA4 · RF23-CA1 · RNF01-CA4 · RNF02-CA5 · RNF04-CA3, com push e instalação reais em 1 Android e 1 iPhone |

Notas:
- **Relógio no E2E:** o `page.clock` só controla o navegador. Com `E2E=1`, o servidor expõe um endpoint de teste que adianta o `Clock` do servidor; o teste adianta os dois juntos. O endpoint não existe fora de `E2E=1`.
- **RF13-CA5 e RNF01-CA2:** o teste de integração executa uma rodada do job com o `Clock` adiantado e confere a expiração persistida; o intervalo do job (30 s) é uma constante conferida no mesmo teste.
- **RNF03, RNF05 e RNF07** não têm CA próprio. RNF03 é coberto pelo RF09-CA8, RNF05 pelo checklist manual e RNF07 pelo pipeline.

### 9.7 Deploy (Railway)

- Serviços: `app` (Node 22) + PostgreSQL.
- Pre-deploy: `npm run db:deploy && npm run db:seed`.
- O seed só **cria** o que não existe (Locais, Galpões, Configuração, super-admin). Nunca altera registros existentes: configuração, raio, nomes, `ativo` e a senha do super-admin ficam como estão. Um teste de integração roda o seed depois de alterar a configuração e confere que nada mudou. Dados fictícios só com `NODE_ENV=development`.
- Start: `npm start`. Domínio inicial `*.up.railway.app` (HTTPS). Ambientes `staging` e `production`.

---

## 10. Design System

Fonte: `01 · Design System` e `03 · Componentes`. Os tokens viram variáveis CSS (`--color-*`, `--spacing-*`, `--radius-*`) expostas ao Tailwind via `@theme`. Tema único escuro.

### 10.1 Cores (Semantic)

| Token | Valor | Token | Valor |
|---|---|---|---|
| `color/bg` | `#050B1F` | `color/text-primary` | `#FFFFFF` |
| `color/surface` | `#0A1F3D` | `color/text-secondary` | `#C9D1DC` |
| `color/elevated` | `#12315A` | `color/text-muted` | `#8892A5` |
| `color/primary` | `#F5C518` | `color/border` | `#12315A` |
| `color/primary-soft` | `#FFE082` | `color/border-strong` | `#2A4A7F` |
| `color/on-primary` | `#050B1F` | `color/success` | `#22C55E` |
| `color/warning` | `#F59E0B` | `color/danger` | `#EF4444` |

Primitivas: navy 50–900 (`#E6EAF2` → `#050B1F`), gold 300/500/700 (`#FFE082`, `#F5C518`, `#C99B0E`), neutral 0–900, success/warning/danger 500.

### 10.2 Tipografia (Inter)

| Estilo | Peso | Tamanho / altura | Tracking |
|---|---|---|---|
| Display/XL | 700 | 72 / 76 | -2 |
| Display/L | 700 | 56 / 60 | -1.5 |
| Display/M | 600 | 40 / 48 | -0.5 |
| Title/L | 600 | 28 / 34 | -0.2 |
| Title/M | 600 | 22 / 28 | 0 |
| Title/S | 600 | 18 / 24 | 0 |
| Body/L | 400 | 17 / 24 | 0 |
| Body/M | 400 | 15 / 22 | 0 |
| Body/M Strong | 600 | 15 / 22 | 0 |
| Body/S | 400 | 13 / 18 | 0 |
| Caption | 500 | 11 / 14 | 0.2 |
| Overline | 600 | 11 / 14 | 1.5 (maiúsculas) |
| Button/L | 600 | 17 / 22 | 0 |
| Button/M | 600 | 15 / 20 | 0 |

### 10.3 Espaçamento e raios

Espaçamento: `xs` 4 · `sm` 8 · `md` 12 · `base` 16 · `lg` 20 · `xl` 24 · `2xl` 32 · `3xl` 40 · `4xl` 48.
Raios: `sm` 8 · `md` 12 · `lg` 16 · `xl` 24 · `full` 999.

### 10.4 Componentes

Do Figma (mesmas variantes):
- `Button` (Primary, Secondary, Reversed, Danger × Default, Disabled)
- `Chip` (Success, Warning, Primary, Neutral, Danger — fundo do tom com opacidade 0,15)
- `Info Row`, `Input Field` (Default, Filled, Focused)
- `Stat Card` (Default, Primary, Danger)
- `History Item` (Concluído, Cancelada)
- `Alert Banner`, `Option Card` (Default, Selected), `Tab Bar`, `Sidebar`

Novos, feitos com os tokens e componentes acima:
- tabela do admin (zebrada, com paginação);
- modal de confirmação;
- contagem regressiva e cronômetro;
- busca, período e select;
- telas de resultado, cadastro, troca de senha, notificações, instalar, termos e em breve;
- banner "Sem conexão".

### 10.5 Textos e estados (sem Figma)

| Onde | Texto |
|---|---|
| Resultado — expirada | Título "Você perdeu a vez"; corpo "Você não confirmou a chamada a tempo. Gere uma nova senha para voltar à fila."; botão "Gerar nova senha" |
| Resultado — virada | Título "Sua senha expirou"; corpo "A fila foi encerrada na virada do dia. Gere uma nova senha."; botão "Gerar nova senha" |
| Resultado — encerrado pelo sistema | Título "Atendimento encerrado"; corpo "Seu atendimento foi encerrado automaticamente na virada do dia."; botão "Voltar ao início" |
| Chamado, prazo zerado | Botão "Confirme agora" no lugar de "Estou a caminho" (RF13-CA4) |
| Bancada ocupada | Botão "Chamar" desabilitado com "Bancada ocupada"; em caso de conflito, aviso "Bancada X ocupada pela senha <código>" |
| Confirmar concluir (motorista) | "Concluir atendimento?" / "Confirme só depois de terminar o carregamento." / "Concluir" / "Voltar" |
| Confirmar concluir (admin) | "Concluir atendimento de <nome> (<senha>)?" / "Concluir" / "Cancelar" |
| Chamar fora de ordem | "Há N motoristas antes nesta bancada. Chamar mesmo assim?" / "Chamar" / "Cancelar" |
| Chips de geofence | "Dentro do pátio - gerar senha disponível" · "Fora do pátio - gerar senha bloqueado" · "Localização imprecisa" · "Localização indisponível" · "Liberado pelo administrador" |
| Estados vazios | "Nenhum motorista na fila agora" · "Nenhum atendimento no período" · "Nenhuma senha no período" · "Você ainda não tem atendimentos" |
| Sem conexão | "Sem conexão. Verifique sua internet e tente novamente." + "Tentar novamente" |

### 10.6 Ajustes no Figma (não bloqueiam o código)

- `19:2`:
  - adicionar "Concluir atendimento";
  - remover a barra de etapas;
  - o cronômetro passa a contar desde a chamada.
- `170:26`:
  - estado CHAMADA com contagem regressiva + "Confirmar chegada";
  - botão "Concluir" em EM_ATENDIMENTO;
  - filtro de bancada; sem filtro de período;
  - "· Bancada X" na coluna de posição.
- `172:170`: barra de filtros (P18).
- `19:64`: remover "Exportar"; adicionar o link "Sair" no rodapé.
- `19:2`: remover a seta "←".
- `18:2`: adicionar a contagem regressiva e o estado "Confirme agora".
- `13:2`: texto "Acompanhe sua posição" acima da 2ª posição; aviso de notificações desativadas.
- `233:440`: legenda "Sua região não é atendida aqui" e os chips novos de geofence (10.5).
- `10:2`: link "Como instalar o app".
- Sidebar: item "Sair" e os itens novos do MVP.
- Dados de exemplo de `170:26`: prefixo por galpão (P02) e posição por bancada, em vez de "A-" e 1º/2º/3º globais.

---

## 11. Premissas e decisões

Cada linha traz o que o texto acima adota. As marcadas com **✔** foram confirmadas pelo cliente em 2026-11-10. As demais são recomendações que o cliente não contestou; a aprovação do PRD as aceita.

| # | Achado | Pergunta | Recomendação adotada |
|---|---|---|---|
| P01 | — | Login do admin? | CPF + senha, igual ao motorista |
| P02 | A14 | Padrão do código da senha? | prefixo por galpão (A–E) + sequência diária por galpão. Por alguns minutos depois da virada pode haver uma senha do dia anterior ainda ativa com o mesmo código; a Fila ao Vivo mostra a data ao lado (RF17-CA2) |
| P03 | A13 | Nome do galpão no app e no painel? | **✔** "SP-R-D228", como no Figma |
| P04 | A22, A35 | Raio? | 150 m por **Local** (galpões no mesmo endereço compartilham), validado com leituras reais em cada local antes do go-live |
| P05 | A02 | Fórmula do tempo estimado? | a do cliente: `motoristas à frente × média do dia` ("Você é o próximo" quando 0) |
| P06 | A23 | Admin pode chamar fora da ordem FIFO? | **✔** sim, com confirmação e registro `foraDeOrdem` |
| P07 | A04 | Horário de operação e da virada? | **✔** não há carregamento de madrugada (só de manhã e, às vezes, à tarde); virada às 00:00, fixada pela variável `HORA_VIRADA` (mudar exige deploy) |
| P08 | — | Galpão sem bancada para a região? | aparece desabilitado |
| P09 | — | Validade da liberação manual? | até o fim do dia operacional ou até gerar uma senha |
| P10 | A34 | O que mostrar em "Conferente"? | o nome do admin que chamou |
| P11 | A29 | Senhas e sessões? | senha mínima de 8 caracteres; temporária gerada pelo sistema, expira em 72 h; sessão de 30 dias (motorista) e 12 h (admin) |
| P12 | — | Períodos e paginação? | histórico do motorista: 90 dias; admin: 50 linhas por página |
| P13 | A33 | Metas da seção 8? | valores propostos; sem "galpão piloto" (os 5 entram juntos) |
| P14 | A31 | Termos de uso e retenção (LGPD)? | a CSM fornece o texto; placeholder até lá; dependência do go-live |
| P15 | A01 | Admin pode confirmar a chegada no lugar do motorista (sem sinal)? | **✔** sim, enquanto a senha estiver CHAMADA e dentro do prazo + carência |
| P16 | A16 | Desvios do Figma? | **✔** remover a barra de etapas (`19:2`) e o "Exportar" (`19:64`); acrescentar "· Bancada X" (`170:26`) |
| P17 | A03 | Atendimento esquecido aberto? | **✔** na virada vira CONCLUIDA (SISTEMA); a média ignora esses e durações > 120 min |
| P18 | A15 | Histórico de Senhas sem filtros no Figma? | **✔** adicionar a mesma barra de filtros do Histórico de Atendimentos |
| P19 | A19 | Fila ao Vivo com filtro de período? | **✔** remover: a tela sempre mostra todas as senhas ativas |
| P20 | A21 | GPS falso? | risco aceito no MVP |
| P21 | A20 | O que os "30 min de espera" de hoje medem? | **✔** da chegada até iniciar o carregamento; comparado com `aCaminhoEm − geradaEm` (seção 8) |
| P22 | A42 | Motorista pode desistir depois de chamado? | não; a senha expira sozinha no prazo |
| P23 | A45 | Transferir o super-admin? | por comando executado pelo desenvolvedor (RF27-CA3) |
| P24 | A11 | Carência para "Estou a caminho" com sinal ruim? | 30 s, configurável |
| P25 | B11 | Uma bancada atende mais de um motorista ao mesmo tempo? | **✔** não: um de cada vez; só se chama para uma bancada livre (RF18-CA6). Se o motorista chamado não aparecer, a bancada fica presa até ele confirmar, expirar (tolerância + carência) ou o admin confirmar a chegada |
| P26 | B18 | Quantos motoristas cadastrados e qual o pico simultâneo? | **✔** em média 180 motoristas; o pico simultâneo não foi informado, então o teste de carga usa 50 conexões (folga sobre o maior galpão, ~71 atendimentos/dia) |
| P27 | B28 | Média diária de atendimentos em DS SDE e SP-R-D228? | a CSM informa antes do go-live; não bloqueia o desenvolvimento |

---

## 12. Histórico de revisões

| Versão | Data | Mudança |
|---|---|---|
| 0.1 | 2026-11-08 | Rascunho inicial |
| 0.2 | 2026-11-08 | Revisão adversarial (46 achados). Novos: RF06 (sessão de desativado), RF07 (roteamento e telas de resultado), RF19 (Confirmar chegada), RF30 (erros de rede); `prazoEm`, `dia`, `ContadorSenha`, snapshot, `EnvioPush`, `resultadoVistoEm`; fórmulas e KPIs fechados; dia operacional com `horaVirada`; tempo real endurecido; matriz de testes com `test:ca-coverage`; TypeScript fixado em 5.9.3; RF24/RF25 simplificados. |
| 0.3 | 2026-11-10 | Decisões do cliente: P03, P06, P07, P15 e P17 confirmadas; P21 muda a métrica de comparação para "tempo até iniciar o carregamento". Tabela de seed (locais, coordenadas, galpões) restaurada na 6.0. |
| 0.4 | 2026-11-10 | Segunda revisão adversarial (29 achados). P16, P18 e P19 confirmadas. Perda de vez só depois da carência; escritas persistem a expiração; contrato `CONFLITO` das mutações; `/admin/trocar-senha`; seed só cria; virada com predicados exatos; `HORA_VIRADA` vira variável de ambiente; KPIs e filtros fechados; 9.6 lista todos os CAs por camada; novos CAs (RF04-CA3, RF08-CA6, RF10-CA6/CA7, RF17-CA10, RF18-CA6, RF20-CA6, RF21-CA5, RF23-CA3, RF25-CA6, RNF06-CA1); P25–P27. |
| 0.5 | 2026-11-11 | P25 confirmada: bancada atende um por vez, então chamar para bancada ocupada é bloqueado (RF18-CA6, RF17-CA5) em vez de apenas avisar. P26: 180 motoristas. |
