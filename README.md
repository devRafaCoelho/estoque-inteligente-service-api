# Estoque Inteligente — Service API

API do Estoque Inteligente: autenticação, produtos/estoque, entrada e baixa (texto + foto + NF-e), lista de compras, dashboard, notificações in-app, **Web Push**, e-mail transacional, financeiro e chat com tools (propostas + rate limit).

A arquitetura-alvo completa (Redis, filas, etc.) está em [`BACKEND.md`](./BACKEND.md) e no [`DOCUMENTACAO.md`](../DOCUMENTACAO.md) do monorepo — este README descreve **o que a API entrega hoje** (Fases 1 e 2).

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

> Nesta fatia: `bcryptjs` (sem compilação nativa) e Express 4. **Sem** Redis/BullMQ. Google/Apple e Gemini são opcionais — sem chave, OAuth social retorna 503 e o parse de texto usa o heurístico. Rate limit de IA é **em memória** (por processo). Sem `SMTP_HOST`, e-mails vão para preview em `EMAIL_PREVIEW_DIR`. Sem chaves VAPID, push fica desabilitado na API.

Camadas: `routes` → `middlewares` → `controllers` → `services` → `repositories` (+ `schemas` / `dto/v1` / `mail`). Detalhes em `BACKEND.md`.

## Como rodar

1. Crie o banco e aplique o schema (`database.sql` no banco `estoque_inteligente`).
2. Em banco **já existente**, rode as migrações incrementais na ordem:
   - `database_sprint6.sql` (quiet hours + `push_subscriptions`)
   - `database_sprint3_f3_share.sql` (links de lista)
   - `database_sprint4_f3_households.sql` (conta familiar)
   - `database_sprint4_f3_household_scope.sql` (escopo `household_id` em produtos/listas)
3. (Opcional) Seeds: `database_seed.sql` e/ou `database_seed_finance_history.sql`.
4. Configure o `.env` a partir de `.env.example`.
5. Instale e suba:

```bash
npm install
npm start
```

A API sobe em `http://localhost:3001`. Em desenvolvimento: `npm run dev` (watch).

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
| POST | `/api/intakes/parse-nf-qr` | QR/chave → collector UF (SP/MG/BA) → draft `nf_qr` |
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

### NF-e / NFC-e (Sprint 5)

`POST /api/intakes/parse-nf-qr` recebe `qrContent` e/ou `accessKey` (+ `stateCode` opcional), valida a chave (44 dígitos + DV), resolve a UF na ordem **chave/URL → body → `users.default_state`**, consulta o portal da UF, faz matching e cria draft `source: nf_qr`.

```env
NF_PRIORITY_STATES=SP,MG,BA
NF_MOCK_COLLECTOR=false
```

#### Cobertura por UF (F2-5.5)

| UF | Adapter | Portal de consulta | Status |
|----|---------|--------------------|--------|
| **SP** | `SpNfCollector` | `nfce.fazenda.sp.gov.br` | Suportado |
| **MG** | `MgNfCollector` | `portalsped.fazenda.mg.gov.br` | Suportado |
| **BA** | `BaNfCollector` | `nfe.sefaz.ba.gov.br/.../qrcode.aspx` | Suportado — **exige QR completo** (chave + CSC/hash) |
| Demais | — | — | **Não suportado** → **422** `nf_uf_unsupported` + `fallback: "photo"` |

Não há cobertura nacional nesta fatia. Novas UFs → Fase 3.

#### Limitações e expectativa

| Tema | Comportamento real |
|------|--------------------|
| Só NFC-e / NF-e no consumidor | Modelos **55** e **65** na chave. |
| Dependência SEFAZ | HTML do portal estadual; pode mudar sem aviso. |
| Captcha / bloqueio | **502** com `fallback: "photo"`. |
| Mock em dev | `NF_MOCK_COLLECTOR=true` — **não use em produção**. |

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
- **Notificações** (v1) continuam por `user_id` do destinatário — não são filtradas por household ainda.
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
| S5 | Collectors SP/MG/BA + fallback foto |
| S6 | Web Push, quiet hours, reset/boas-vindas, digest opt-in |

## Fora desta entrega

Mais UFs no collector NF-e, filas Redis/BullMQ, STT no servidor (Whisper/Gemini), generate de lista por IA (hoje generate = regras), push nativo RN. Roadmap em `DOCUMENTACAO.md` (Fases 3–4).
