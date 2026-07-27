# Estoque Inteligente — Service API

API do Estoque Inteligente: autenticação, produtos/estoque, entrada e baixa por texto (Gemini com fallback heurístico), lista de compras, dashboard, notificações, financeiro e chat com tools (propostas + rate limit).

A arquitetura-alvo completa (Redis, OCR, NF-e, e-mail, etc.) está em [`BACKEND.md`](./BACKEND.md) e no [`DOCUMENTACAO.md`](../DOCUMENTACAO.md) do monorepo — este README descreve **o que a API entrega hoje**.

## Stack

- Node.js 20+ / Express 4
- PostgreSQL (`pg`)
- Joi (validação) + DTOs (`dto/v1`)
- JWT (`jsonwebtoken`) + `bcryptjs`
- OAuth Google (`google-auth-library`) + Apple (JWKS)
- OpenAI SDK → Gemini (endpoint compatível; opcional)
- Winston (logs)
- Swagger / OpenAPI (`swagger-ui-express`)

> Nesta fatia: `bcryptjs` (sem compilação nativa) e Express 4. **Sem** Redis/BullMQ. Google/Apple e Gemini são opcionais — sem chave, OAuth social retorna 503 e o parse de texto usa o heurístico. Rate limit de IA é **em memória** (por processo).

Camadas: `routes` → `middlewares` → `controllers` → `services` → `repositories` (+ `schemas` / `dto/v1`). Detalhes em `BACKEND.md`.

## Como rodar

1. Crie o banco e aplique o schema (`database.sql` no banco `estoque_inteligente`).
2. (Opcional) Seeds: `database_seed.sql` e/ou `database_seed_finance_history.sql`.
3. Configure o `.env` a partir de `.env.example`.
4. Instale e suba:

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
| POST | `/api/auth/register` | Cadastro e-mail/senha |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/google` | Login/cadastro Google (`idToken`) |
| POST | `/api/auth/apple` | Login/cadastro Apple (`idToken`, `fullName?`) |
| POST | `/api/auth/link/google` | Vincular Google (JWT) |
| POST | `/api/auth/link/apple` | Vincular Apple (JWT) |
| GET | `/api/auth/me` | Sessão atual |
| PATCH | `/api/users/me` | Editar perfil |
| GET | `/api/users/me/preferences` | Preferências |
| PATCH | `/api/users/me/preferences` | Atualizar preferências |
| POST | `/api/users/me/password` | Definir/trocar senha |
| DELETE | `/api/users/me` | Encerrar conta (soft-delete) |

### Produtos

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/products` | Listar (`category`, `status`, `search`) |
| POST | `/api/products` | Criar (cadastro manual) |
| GET | `/api/products/:id` | Detalhe + histórico |
| PATCH | `/api/products/:id` | Editar |
| POST | `/api/products/:id/consume` | Dar baixa (quantidade) |
| POST | `/api/products/:id/mark-out` | Zerar (“acabou”) |

### Entrada (intake)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/intakes/parse-text` | Texto → draft de compra (rate limit parse) |
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

### Dashboard, notificações e financeiro

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/dashboard/stats` | Contagens ok/low/out |
| GET | `/api/notifications` | Alertas in-app |
| GET | `/api/notifications/unread-count` | Não lidas |
| POST | `/api/notifications/read-all` | Marcar todas como lidas |
| POST | `/api/notifications/:id/read` | Marcar uma como lida |
| GET | `/api/finance/summary` | Resumo do mês + compras recentes |
| GET | `/api/finance/by-category` | Gastos por categoria (`year`, `month`) |
| GET | `/api/finance/series` | Série mensal do ano |
| GET | `/api/finance/tips` | Dicas do mês selecionado |

## Parse por texto + Gemini + rate limit

Com `AI_API_KEY` (Gemini Flash no [AI Studio](https://aistudio.google.com/app/apikey)), entrada, baixa, item de lista em texto livre e chat usam LLM. Sem chave (ou se a IA falhar no parse), cai no **parser heurístico**.

```env
AI_API_KEY=sua-chave
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
AI_MODEL=gemini-2.5-flash

# Cotas diárias por usuário (0 = desligado). Parse = entrada+baixa; chat separado.
AI_PARSE_DAILY_LIMIT=50
AI_CHAT_DAILY_LIMIT=40
```

Acima da cota: **429** com mensagem clara. Contadores em memória (reiniciam com o processo).

## OAuth (Google / Apple)

1. Configure `GOOGLE_CLIENT_ID` / `APPLE_CLIENT_ID` no `.env` da API (mesmo Client ID do front).
2. No front: `VITE_GOOGLE_CLIENT_ID`, `VITE_APPLE_CLIENT_ID`, `VITE_APPLE_REDIRECT_URI`.
3. O browser obtém o `id_token` via SDK e envia para a API — teste preferencialmente pelo **client**, não pelo Swagger.

## Fora desta entrega

OCR/foto (`parse-image`), QR NF-e, filas Redis/BullMQ, e-mail transacional, push, STT no servidor, generate de lista por IA (hoje generate = regras). Detalhes em `BACKEND.md` e `DOCUMENTACAO.md`.
