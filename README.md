# Estoque Inteligente — Service API

API do Estoque Inteligente: autenticação, produtos/estoque, entrada e baixa (texto + foto + NF-e), lista de compras, dashboard, notificações in-app, **Web Push**, e-mail transacional, financeiro, chat com tools, compartilhamento de lista e conta familiar.

Documentação de produto e próximos passos: [`documentacoes/`](./documentacoes/). Este README descreve **como rodar a API** e o que ela entrega.

## Stack

- Node.js 20+ / Express 4
- PostgreSQL (`pg`)
- Joi (validação) + DTOs (`dto/v1`)
- JWT (`jsonwebtoken`) + `bcryptjs`
- OAuth Google (`google-auth-library`) + Apple (JWKS)
- OpenAI SDK → Gemini (endpoint compatível; opcional)
- Nodemailer (SMTP) + Web Push (`web-push` / VAPID)
- Winston (logs)
- Swagger / OpenAPI (`swagger-ui-express`)

> `bcryptjs` (sem compilação nativa) e Express 4. **Sem** Redis/BullMQ. Google/Apple e Gemini são opcionais — sem chave, OAuth social retorna 503 e o parse de texto usa o heurístico. Rate limit de IA é **em memória** (por processo). Sem `SMTP_HOST`, e-mails vão para preview em `EMAIL_PREVIEW_DIR`. Sem chaves VAPID, push fica desabilitado na API.

Camadas: `routes` → `middlewares` → `controllers` → `services` → `repositories` (+ `schemas` / `dto/v1` / `mail`). Visão geral em [`documentacoes/BACKEND.md`](./documentacoes/BACKEND.md).

## Como rodar

1. Crie o banco PostgreSQL e aplique **somente** o schema:
   ```bash
   psql "$DATABASE_URL" -f database.sql
   ```
   Esse é o único arquivo SQL do repositório (enums + tabelas + índices; sem seeds).
2. Configure o `.env` a partir de `.env.example`.
3. Instale e suba:

```bash
npm install
npm start
```

Na subida, a API garante os rótulos de catálogo (categorias, unidades, UFs). A API sobe em `http://localhost:3001`. Em desenvolvimento: `npm run dev` (watch).

### Zerar um banco existente

```bash
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
psql "$DATABASE_URL" -f database.sql
```

Depois suba a API uma vez (catálogos).

## Swagger

| Recurso | URL |
|---------|-----|
| UI interativa | [http://localhost:3001/api-docs](http://localhost:3001/api-docs) |
| Spec JSON (OpenAPI 3) | [http://localhost:3001/api-docs.json](http://localhost:3001/api-docs.json) |

Na UI, use **Authorize** com o JWT de `/api/auth/login` ou `/api/auth/register` (sem o prefixo `Bearer` — o Swagger adiciona).

A spec vive em `src/docs/` e deve acompanhar as rotas entregues.

## Testar

Com o servidor rodando em outro terminal:

```bash
npm run test:api
```

O script cria usuário, cadastra produtos, registra consumo/baixa e valida status (`ok` / `low` / `out`).

Digest de e-mail (opt-in; não precisa da API no ar):

```bash
npm run notifications:digest
```

## Endpoints entregues

### Sistema e catálogos

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Healthcheck |
| GET | `/api/product-categories` | Categorias |
| GET | `/api/stock-units` | Unidades |
| GET | `/api/brazilian-states` | UFs |

### Auth e conta

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/register` | Cadastro e-mail/senha (+ e-mail de boas-vindas) |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/forgot-password` | Solicitar reset (resposta neutra se e-mail não existir) |
| POST | `/api/auth/reset-password` | Redefinir senha com token |
| POST | `/api/auth/google` | Login/cadastro Google (`idToken`) |
| POST | `/api/auth/apple` | Login/cadastro Apple (`idToken`, `fullName?`) |
| POST | `/api/auth/link/google` | Vincular Google (JWT) |
| POST | `/api/auth/link/apple` | Vincular Apple (JWT) |
| GET | `/api/auth/me` | Sessão atual |
| PATCH | `/api/users/me` | Editar perfil |
| GET | `/api/users/me/preferences` | Preferências (alertas, push, quiet hours, digest) |
| PATCH | `/api/users/me/preferences` | Atualizar preferências |
| POST | `/api/users/me/password` | Definir/trocar senha |
| DELETE | `/api/users/me` | Encerrar conta (soft-delete) |

### Produtos

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/products` | Listar (`category`, `status`, `search`) |
| POST | `/api/products` | Criar (cadastro manual; `repurchaseDays` opcional) |
| GET | `/api/products/:id` | Detalhe + histórico |
| PATCH | `/api/products/:id` | Editar |
| POST | `/api/products/:id/consume` | Dar baixa (quantidade) |
| POST | `/api/products/:id/mark-out` | Zerar (“acabou”) |

### Entrada (intake)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/intakes/parse-text` | Texto → draft de compra (rate limit parse) |
| POST | `/api/intakes/parse-image` | Multipart `image` → visão/LLM → draft `receipt_photo` |
| POST | `/api/intakes/parse-nf-qr` | QR/chave → collector UF (SP/MG/BA/RJ/PR) → draft `nf_qr` |
| GET | `/api/nf/coverage` | UFs com adapter + allowlist (`NF_PRIORITY_STATES`) |
| GET | `/api/nf/collector-stats` | Contagens de sucesso/falha por UF (auth) |
| GET | `/api/intakes` | Listar (ex.: `status=draft`) |
| POST | `/api/intakes/clear-drafts` | Limpar rascunhos |
| GET | `/api/intakes/:id` | Preview do draft |
| PATCH | `/api/intakes/:id` | Editar itens do draft |
| POST | `/api/intakes/:id/confirm` | Confirmar → atualiza estoque |
| POST | `/api/intakes/:id/cancel` | Cancelar draft |

### Baixa (stock-out)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/stock-outs/parse-text` | Texto → draft de baixa (rate limit parse) |
| GET | `/api/stock-outs` | Listar (ex.: `status=draft`) |
| POST | `/api/stock-outs/clear-drafts` | Limpar rascunhos |
| GET | `/api/stock-outs/:id` | Preview |
| PATCH | `/api/stock-outs/:id` | Editar itens |
| POST | `/api/stock-outs/:id/confirm` | Confirmar → desconta estoque |
| POST | `/api/stock-outs/:id/cancel` | Cancelar draft |

### Lista de compras

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/shopping-lists/active` | Lista ativa |
| GET | `/api/shopping-lists/suggestions-preview` | Prévia de sugestões (UI de gerar) |
| POST | `/api/shopping-lists/generate` | Regenerar por regras (`mode: rules`) |
| PATCH | `/api/shopping-lists/view-mode` | Preferência lista/paper |
| POST | `/api/shopping-lists/items` | Adicionar item (texto livre usa o parse) |
| PATCH | `/api/shopping-lists/items/:id` | Check / editar |
| DELETE | `/api/shopping-lists/items` | Limpar todos os itens |
| DELETE | `/api/shopping-lists/items/:id` | Remover item |

### Chat (assistente)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/chat/session` | Sessão atual + histórico curto |
| POST | `/api/chat/messages` | Mensagem do usuário (rate limit chat) |

Tools / intenções: `answer`, `propose_stock_out`, `propose_shopping_list`, `finance_tip`. Propostas mutáveis **não** confirmam estoque/lista sozinhas — o client usa CTA de revisão.

### Dashboard, notificações, push e financeiro

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/dashboard/stats` | Contagens ok/low/out |
| GET | `/api/notifications` | Alertas in-app (+ dispara monitor) |
| GET | `/api/notifications/unread-count` | Não lidas |
| POST | `/api/notifications/read-all` | Marcar todas como lidas |
| POST | `/api/notifications/:id/read` | Marcar uma como lida |
| GET | `/api/notifications/push/config` | VAPID público + status do push |
| POST | `/api/notifications/push/subscribe` | Registrar subscription Web Push |
| POST | `/api/notifications/push/unsubscribe` | Remover subscription |
| GET | `/api/finance/summary` | Resumo do mês + compras recentes |
| GET | `/api/finance/by-category` | Gastos por categoria (`year`, `month`) |
| GET | `/api/finance/series` | Série mensal do ano |
| GET | `/api/finance/tips` | Dicas do mês selecionado |

## Parse por texto + Gemini + rate limit

Com `AI_API_KEY` (Gemini Flash no [AI Studio](https://aistudio.google.com/app/apikey)), entrada, baixa, item de lista em texto livre e chat usam LLM. Sem chave (ou se a IA falhar no parse), cai no **parser heurístico**.

```env
AI_API_KEY=sua-chave
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
AI_MODEL=gemini-flash-latest

# Cotas diárias por usuário (0 = desligado). Parse = entrada+baixa+imagem; chat separado.
AI_PARSE_DAILY_LIMIT=50
AI_CHAT_DAILY_LIMIT=40

# Upload de cupom (parse-image)
UPLOAD_DIR=uploads
UPLOAD_MAX_MB=8
```

Acima da cota: **429** com mensagem clara. Contadores em memória (reiniciam com o processo).

**Cota `parse` (F2-4.3):** compartilhada entre `POST /api/intakes/parse-text`, `POST /api/intakes/parse-image` e `POST /api/stock-outs/parse-text`. Chat usa cota separada.

`parse-image` grava o arquivo em `UPLOAD_DIR/receipts/{userId}/`, envia a imagem ao Gemini (visão) com o **mesmo schema** do parse de texto, aplica matching e cria draft `source: receipt_photo` com `parser: vision`. Exige `AI_API_KEY` (sem chave → **503**). Cupom ilegível / sem itens → **422**.

### NF-e / NFC-e (Fase 3 — Sprint 5)

`POST /api/intakes/parse-nf-qr` recebe `qrContent` e/ou `accessKey` (+ `stateCode` opcional), valida a chave (44 dígitos + DV), resolve a UF na ordem **chave/URL → body → `users.default_state`**, consulta o portal da UF, faz matching e cria draft `source: nf_qr`.

**Contrato por UF (normalizado):** cada adapter expõe `collect({ accessKey, stateCode, qrContent })` e reutiliza helpers de portal (`portalHelpers.js` + `nfHtmlParser.js`). Novas UFs = URL builder + objeto collector + registro no factory + entrada em `NF_PRIORITY_STATES`.

```env
NF_PRIORITY_STATES=SP,MG,BA,RJ,PR
NF_MOCK_COLLECTOR=false
```

`NF_PRIORITY_STATES` é a allowlist incremental: dá para habilitar UFs aos poucos sem redeploy de código (desde que o adapter exista).

#### Cobertura por UF (F3-5.1 / F3-5.2)

| UF | Adapter | Portal de consulta | Status |
|----|---------|--------------------|--------|
| **SP** | `SpNfCollector` | `nfce.fazenda.sp.gov.br` | Suportado |
| **MG** | `MgNfCollector` | `portalsped.fazenda.mg.gov.br` | Suportado |
| **BA** | `BaNfCollector` | `nfe.sefaz.ba.gov.br/.../qrcode.aspx` | Suportado — **exige QR completo** (chave + CSC/hash) |
| **RJ** | `RjNfCollector` | `consultadfe.fazenda.rj.gov.br` | Suportado (Fase 3) |
| **PR** | `PrNfCollector` | `fazenda.pr.gov.br/nfce/qrcode` | Suportado (Fase 3) |
| Demais | — | — | **Não suportado** → **422** `nf_uf_unsupported` + `fallback: "photo"` |

Catálogo em runtime: `GET /api/nf/coverage`.

#### Observabilidade (F3-5.3)

Tentativas de coleta gravam em `nf_collector_logs` (sucesso/falha, UF, código de erro). Resumo: `GET /api/nf/collector-stats?days=7` (autenticado).

#### Limitações e expectativa

| Tema | Comportamento real |
|------|--------------------|
| Só NFC-e / NF-e no consumidor | Modelos **55** e **65** na chave. |
| Dependência SEFAZ | HTML do portal estadual; pode mudar sem aviso. |
| Captcha / bloqueio | **502** com `fallback: "photo"`. |
| Mock em dev | `NF_MOCK_COLLECTOR=true` — **não use em produção**. |
| Códigos `details.code` | `nf_uf_unsupported`, `nf_ba_qr_required`, `nf_invalid_qr`, `nf_empty_items`, `nf_fetch_failed`, `nf_captcha`, `nf_collector_failed`, `nf_state_required`, `nf_invalid_payload` |

### E-mail e Web Push (Sprint 6)

```env
APP_URL=http://localhost:5173

# SMTP — sem host, e-mails viram arquivo em EMAIL_PREVIEW_DIR
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@estoque-inteligente.local
EMAIL_PREVIEW_DIR=tmp/email-previews

# Web Push (gere com: npx web-push generate-vapid-keys)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:noreply@estoque-inteligente.local
```

| Canal | Comportamento |
|-------|----------------|
| Boas-vindas | Cadastro local e 1º login social |
| Reset senha | `forgot-password` + `reset-password` (token com hash, TTL ~45 min) |
| Digest | Opt-in `notifyEmailDigest`; script `npm run notifications:digest` |
| Push | Disparo ao criar alerta elegível; respeita preferências por tipo e **quiet hours** |
| Quiet hours | Preferências `quietHoursEnabled` / `Start` / `End` / `Timezone` (default 22:00–08:00 America/Sao_Paulo) |

Templates HTML em `src/mail/emailLayout.js` (logo embutida + Nunito).

## Conta familiar e escopo de dados (Fase 3 — Sprint 4)

### Modelo (F3-4.1)

- Tabelas: `households`, `household_members`, `household_invites`
- Rotas autenticadas em `/api/households`:
  - `POST /` criar · `GET /me` · `POST /invites/accept`
  - `GET|POST /:id/invites` · `DELETE /:id/invites/:inviteId`
  - `GET /:id/members` · `DELETE /:id/members/:userId` · `POST /:id/leave`

### Escopo de estoque/lista (F3-4.2)

Migração gradual: contas existentes continuam **solo** (`household_id IS NULL`).

| Contexto | Filtro em `products` / `shopping_lists` |
|----------|----------------------------------------|
| Solo (sem membership) | `user_id = me AND household_id IS NULL` |
| Membro/dono de household | `household_id = casa ativa` |

Regras:

- `resolveScope(userId)` em `src/utils/resolveScope.js` define o contexto ativo.
- Ao **criar** a casa, produtos e listas solo do **owner** recebem `household_id` (backfill).
- Novos produtos/listas criados por qualquer membro da casa já nascem com `household_id`.
- Há no máximo **uma lista ativa** por usuário solo **ou** por household (índices parciais).
- **Notificações** (v1) continuam por `user_id` do destinatário — o monitor pode gerar alertas para cada membro a partir do estoque compartilhado.
- **Financeiro** (v1): leituras agregam compras de **todos os membros** da casa (`user_id` de cada um). Novas compras continuam registradas no `user_id` de quem confirmou a entrada.
- Intakes/baixas/chat permanecem pessoais (`user_id`); o estoque que eles alteram já respeita o escopo do produto.

Isolamento: membro da casa A **não** lê produtos com `household_id` da casa B.

### Regras owner vs member (F3-4.4)

| Ação | Owner | Member |
|------|-------|--------|
| Ver estoque/lista da casa | sim | sim |
| Convidar / cancelar convite | sim | 403 |
| Remover membro | sim | 403 |
| Remover o owner | — | 422 (bloqueado) |
| Sair da casa (`POST /:id/leave`) | só se for o único membro (dissolve a casa) | sim (dados da casa permanecem) |
| Excluir conta (`DELETE /api/users/me`) | 409 se ainda houver outros membros | permitido (sai da casa antes) |
| Compartilhar lista (link) | dono da lista **ou** owner da casa | 403 se só member |

Convites cancelados usam soft-delete (`revoked_at`).

## OAuth (Google / Apple)

1. Configure `GOOGLE_CLIENT_ID` / `APPLE_CLIENT_ID` no `.env` da API (mesmo Client ID do front).
2. No front: `VITE_GOOGLE_CLIENT_ID`, `VITE_APPLE_CLIENT_ID`, `VITE_APPLE_REDIRECT_URI`.
3. O browser obtém o `id_token` via SDK e envia para a API — teste preferencialmente pelo **client**.

## Fase 2 nesta API

| Sprint | Entrega |
|--------|---------|
| S1 | Monitor: recompra, estimativa de consumo, nudge agrupado |
| S3 | Chat com tools + rate limit |
| S4 | `parse-image` + cota compartilhada texto/foto |
| S5 | Collectors SP/MG/BA/RJ/PR + logs + coverage API |
| S6 | Web Push, quiet hours, reset/boas-vindas, digest opt-in |

## Fora desta entrega / próximos passos

Filas Redis/BullMQ, STT no servidor, push nativo (React Native), offline parcial, landing page de marketing, cobrança e parcerias locais — ver [`documentacoes/PROXIMOS-PASSOS.md`](./documentacoes/PROXIMOS-PASSOS.md) e [`documentacoes/DOCUMENTACAO.md`](./documentacoes/DOCUMENTACAO.md).
