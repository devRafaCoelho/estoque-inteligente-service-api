# Estoque Inteligente — Service API

API HTTP do **Estoque Inteligente**: autenticação, estoque doméstico, entrada e baixa (texto, foto, NF-e), lista de compras, financeiro, chat com assistente, notificações, Web Push, e-mail transacional e conta familiar.

## Stack

| Item | Tecnologia |
|------|------------|
| Runtime | Node.js 20+ |
| HTTP | Express 4 |
| Banco | PostgreSQL (`pg`) |
| Validação / contrato | Joi (`schemas/`) + DTOs (`dto/v1/`) |
| Auth | JWT + bcryptjs; Google (`google-auth-library`); Apple (JWKS) |
| IA | OpenAI SDK → endpoint Gemini (opcional) |
| E-mail | Nodemailer (SMTP) |
| Push | `web-push` (VAPID) |
| Logs | Winston |
| Docs HTTP | Swagger / OpenAPI (`swagger-ui-express`) |
| NF-e | axios/fetch + cheerio (portais SEFAZ) |

Sem Redis/BullMQ. Rate limit de IA é **em memória** (por processo). Sem `SMTP_HOST`, e-mails viram arquivo em `EMAIL_PREVIEW_DIR`. Sem VAPID, push fica desligado. Sem `AI_API_KEY`, parse de texto usa heurístico; `parse-image` exige chave.

## Arquitetura

```
routes → middlewares → controllers → services → repositories
         schemas (entrada)          dto/v1 (saída)
         mail / bootstrap / docs
```

Entrada: `src/index.js` (sobe o server, aquece o Postgres e garante catálogos de referência).

## Banco de dados

Único script SQL do repositório: **`database.sql`** (extensões, ENUMs, tabelas, índices — sem INSERTs).

```bash
psql "$DATABASE_URL" -f database.sql
```

Na subida, `src/bootstrap/ensureReferenceData.js` popula rótulos de categorias, unidades e UFs.

Zerar um banco existente:

```bash
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
psql "$DATABASE_URL" -f database.sql
```

## Como rodar

1. PostgreSQL com schema aplicado (`database.sql`).
2. Copie `.env.example` → `.env` e preencha pelo menos `DATABASE_URL` e `JWT_SECRET`.
3. Instale e suba:

```bash
npm install
npm start          # produção / simples
npm run dev        # watch em ./src
```

API em `http://localhost:3001`. Health: `GET /health`.

## Swagger

| Recurso | URL |
|---------|-----|
| UI | http://localhost:3001/api-docs |
| Spec JSON | http://localhost:3001/api-docs.json |

Em **Authorize**, use o JWT de login/cadastro (sem prefixo `Bearer`). Spec em `src/docs/`.

## Variáveis de ambiente

Principais (ver `.env.example`):

| Variável | Uso |
|----------|-----|
| `DATABASE_URL` | Postgres |
| `JWT_SECRET` / `JWT_EXPIRATION` | Sessão |
| `CORS_ORIGIN` | Origens do front (vírgula: local + produção) |
| `APP_URL` | Base dos links em e-mails (convite, reset) |
| `GOOGLE_CLIENT_ID` / `APPLE_*` | OAuth (opcional) |
| `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` | Parse e chat |
| `AI_PARSE_DAILY_LIMIT` / `AI_CHAT_DAILY_LIMIT` | Cotas diárias (0 = off) |
| `UPLOAD_DIR` / `UPLOAD_MAX_MB` | Foto de cupom |
| `NF_PRIORITY_STATES` / `NF_MOCK_COLLECTOR` | Collectors NF-e |
| `SMTP_*` / `EMAIL_FROM` | E-mail real (sem `SMTP_HOST` = só preview em arquivo) |
| `VAPID_*` | Web Push |

### E-mail no Render (convite Hotmail etc.)

O envio local e o do Render usam as **mesmas** variáveis — se o Hotmail chega no PC e não no Render, em geral falta config no painel ou o Gmail bloqueia o IP do datacenter.

No serviço da API no Render, defina pelo menos:

- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=587`
- `SMTP_SECURE=false`
- `SMTP_USER=` e-mail Gmail completo
- `SMTP_PASS=` **senha de app** (não a senha normal da conta)
- `EMAIL_FROM=` o **mesmo** endereço do `SMTP_USER`
- `APP_URL=` URL pública do front (links do convite)

No log de boot, procure:

- `SMTP verificado com sucesso` → SMTP ok
- `SMTP não configurado em produção` → vars ausentes no Render
- `SMTP configurado, mas a verificação falhou` → senha de app / bloqueio Gmail

Após o deploy, um convite sem e-mail ainda gera link (compartilhar no app). Em falha, o log mostra `Convite criado, mas e-mail não entregue pelo SMTP`.

Gmail SMTP a partir de cloud (Render) é frágil para Hotmail/Outlook; se precisar de entrega estável, preferir Resend/SendGrid/Mailgun com domínio próprio.

## Domínios da API

### Auth e conta

- Cadastro/login e-mail+senha; Google/Apple via `idToken`
- Reset de senha; vincular provedor; perfil e preferências
- Soft-delete de conta

### Catálogos

- `GET /api/product-categories`, `/api/stock-units`, `/api/brazilian-states`

### Produtos e estoque

- CRUD, consumo pontual, marcar acabou, histórico de movimentos
- Escopo **solo** (`user_id`) ou **familiar** (`household_id`) via `resolveScope`

### Entrada (intake) e baixa (stock-out)

Fluxo padrão: **parse → draft → preview/edição → confirm/cancel**.

- Texto (IA ou heurístico), imagem (visão), QR/chave NF-e
- Confirm atualiza quantidade e, na compra com preço, gera financeiro

### NF-e

Adapters: **SP, MG, BA, RJ, PR** (allowlist `NF_PRIORITY_STATES`).  
UF sem suporte → erro com fallback sugerido para foto.  
Observabilidade: `nf_collector_logs`, `GET /api/nf/coverage`, `GET /api/nf/collector-stats`.

### Lista de compras

- Lista ativa, geração por regras, itens, modo de visualização
- Share por token (hash no banco); estimativa de gasto no client a partir dos preços médios

### Conta familiar

- Casa, membros (`owner` / `member`), convites por e-mail
- Estoque e lista compartilhada no escopo da casa; financeiro agrega compras dos membros na leitura

### Chat

- Sessão + mensagens; tools propõem baixa/lista/compra/dica — mutações passam pelo preview no client

### Dashboard, notificações, push, financeiro

- Stats ok/low/out; alertas in-app (monitor dispara na listagem)
- Web Push + quiet hours; digest por script `npm run notifications:digest`
- Summary, categorias, série mensal, tips

## Como testar

Com a API no ar (quando o teste exigir HTTP):

```bash
npm run test:api
```

Testes unitários / de domínio (não precisam de servidor, salvo se o próprio script subir/usar DB):

```bash
npm run test:rate-limit
npm run test:consumption
npm run test:nudge
npm run test:nudge-policy
npm run test:stock-rules
npm run test:propose-intake
npm run test:finance-tips
npm run test:shopping-spend
npm run test:shopping-share
npm run test:shopping-share-privacy
npm run test:household
npm run test:household-scope
npm run test:nf-url
npm run test:nf-collectors
```

Digest de e-mail (opt-in nas preferências):

```bash
npm run notifications:digest
```

## Estrutura de pastas (resumo)

```
database.sql
src/
  index.js / app.js
  bootstrap/          # catálogos no boot
  config/             # env, db
  routes/ controllers/ services/ repositories/
  schemas/ dto/v1/ middlewares/ helpers/ utils/
  mail/ docs/ scripts/
  services/nf/        # collectors e factory
tests/
```

## Notas de operação

- `CORS_ORIGIN` aceita várias origens separadas por vírgula.
- Cadastro/convite **não falham** se o SMTP timeoutar; o erro fica no log.
- Reset de senha depende de e-mail entregue (SMTP configurado).
- Em hosting free (ex.: Render), cold start e SMTP externo podem ser lentos.
