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
| POST | `/api/intakes/parse-image` | Multipart `image` → visão/LLM → draft `receipt_photo` com itens |
| POST | `/api/intakes/parse-nf-qr` | QR/chave → collector UF (SP/MG) → draft `nf_qr` com itens |
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
AI_MODEL=gemini-flash-latest

# Cotas diárias por usuário (0 = desligado). Parse = entrada+baixa+imagem; chat separado.
AI_PARSE_DAILY_LIMIT=50
AI_CHAT_DAILY_LIMIT=40

# Upload de cupom (parse-image)
UPLOAD_DIR=uploads
UPLOAD_MAX_MB=8
```

Acima da cota: **429** com mensagem clara. Contadores em memória (reiniciam com o processo).

**Cota `parse` (F2-4.3):** compartilhada entre `POST /api/intakes/parse-text`, `POST /api/intakes/parse-image` e `POST /api/stock-outs/parse-text` — texto e foto somam no mesmo limite diário (`AI_PARSE_DAILY_LIMIT`). Chat usa cota separada.

`parse-image` grava o arquivo em `UPLOAD_DIR/receipts/{userId}/`, envia a imagem ao Gemini (visão) com o **mesmo schema** do parse de texto, aplica matching e cria draft `source: receipt_photo` com `parser: vision` e itens no preview. Exige `AI_API_KEY` (sem chave → **503**). Cupom ilegível / sem itens → **422** (arquivo removido).

### NF-e / NFC-e (Sprint 5)

`POST /api/intakes/parse-nf-qr` recebe `qrContent` e/ou `accessKey` (+ `stateCode` opcional), valida a chave (44 dígitos + DV), resolve a UF na ordem **chave/URL → body → `users.default_state`**, consulta o portal da UF, faz matching e cria draft `source: nf_qr`.

```env
# Lista de UFs com adapter ativo (ordem não importa para o match).
NF_PRIORITY_STATES=SP,MG
# true = devolve itens mock (útil se o portal SEFAZ bloquear/captcha em dev).
NF_MOCK_COLLECTOR=false
```

#### Cobertura por UF (F2-5.5)

| UF | Adapter | Portal de consulta | Status |
|----|---------|--------------------|--------|
| **SP** | `SpNfCollector` | `nfce.fazenda.sp.gov.br` (QR `p=chave\|…`) | Suportado |
| **MG** | `MgNfCollector` | `portalsped.fazenda.mg.gov.br` (NFC-e) | Suportado |
| Demais | — | — | **Não suportado** → **422** `nf_uf_unsupported` + `fallback: "photo"` |

Não há cobertura nacional nesta fatia. Novas UFs exigem adapter dedicado (layout/URL do portal mudam por estado) — roadmap em `DOCUMENTACAO.md` (Fase 3).

#### Limitações e expectativa

| Tema | Comportamento real |
|------|--------------------|
| Só NFC-e / NF-e no consumidor | Aceitamos modelos **55** (NF-e) e **65** (NFC-e) na chave. Outros modelos → **400**. |
| Dependência SEFAZ | A API **baixa HTML do portal estadual** e faz parse. Sem API oficial estável; HTML pode mudar sem aviso. |
| Captcha / bloqueio / Cloudflare | **502** `nf_captcha` ou `nf_fetch_failed` com `fallback: "photo"`. O client deve oferecer foto/OCR (Sprint 4). |
| Timeout | Consulta HTTP ~20s; falha de rede/timeout → **502** + fallback foto. |
| Itens ilegíveis | HTML sem tabela de produtos → **422** `nf_empty_items` + fallback foto. |
| UF da preferência | `default_state` só preenche se a chave/URL **não** trouxer UF. A UF da **chave sempre prevalece** (scan sobrescreve preferência). |
| UF sem adapter | Mesmo com `default_state=SP`, uma nota cuja chave é de **RJ** retorna **422** (UF da chave). |
| Mock em dev | `NF_MOCK_COLLECTOR=true` ignora SEFAZ e devolve itens fictícios — **não use em produção**. |
| Fora do escopo | XML autorizado, download oficial SEFAZ, cobertura nacional, fila assíncrona, cache de chave. |

#### Códigos de erro úteis (client)

| HTTP | `details.code` | O que fazer no app |
|------|----------------|--------------------|
| 400 | `nf_invalid_payload` | Pedir novo scan / colar chave |
| 400 | `nf_state_required` | Pedir UF e salvar `default_state` |
| 422 | `nf_uf_unsupported` | CTA foto (UF ainda sem adapter) |
| 422 | `nf_empty_items` | CTA foto |
| 502 | `nf_captcha` / `nf_fetch_failed` / `nf_collector_failed` | CTA foto; opcional “tentar QR de novo” |

## OAuth (Google / Apple)

1. Configure `GOOGLE_CLIENT_ID` / `APPLE_CLIENT_ID` no `.env` da API (mesmo Client ID do front).
2. No front: `VITE_GOOGLE_CLIENT_ID`, `VITE_APPLE_CLIENT_ID`, `VITE_APPLE_REDIRECT_URI`.
3. O browser obtém o `id_token` via SDK e envia para a API — teste preferencialmente pelo **client**, não pelo Swagger.

## Fora desta entrega

Mais UFs no collector NF-e (além de SP/MG — ver tabela de cobertura acima), filas Redis/BullMQ, e-mail transacional, push, STT no servidor, generate de lista por IA (hoje generate = regras). Detalhes em `BACKEND.md` e `DOCUMENTACAO.md`.
