# Estoque Inteligente — Service API (v1)

Back-end da v1 do Estoque Inteligente. Esta primeira fita entrega o núcleo
**autenticação (local) + produtos/estoque**, totalmente funcional e testável
contra o PostgreSQL local.

> Documentação de arquitetura completa em [`BACKEND.md`](./BACKEND.md) e o schema
> do banco em [`database.sql`](./database.sql).

## Stack

- Node.js 20+ / Express 4
- PostgreSQL (`pg`)
- Joi (validação) + DTOs (`dto/v1`)
- JWT (`jsonwebtoken`) + `bcryptjs`
- OAuth Google (`google-auth-library`) + Apple (JWKS)
- Winston (logs)
- Swagger / OpenAPI (`swagger-ui-express`)

> Observação: nesta fatia usei `bcryptjs` (JS puro, sem compilação nativa) e
> Express 4 para rodar sem dependências de build no Windows. Os módulos de IA,
> OCR, NF-e, filas (Redis/BullMQ) e e-mail descritos no `BACKEND.md` entram nas
> fases seguintes (dependem de chaves/serviços externos). Google/Apple já estão
> na API; basta configurar os Client IDs.

## Como rodar

1. Garanta o banco criado e as tabelas aplicadas (rode `database.sql` no
   banco `estoque_inteligente` — já inclui categorias, unidades e UFs).
2. (Opcional) Popule dados de demonstração com `database_seed.sql`.
3. Configure o `.env` (já vem apontando para `localhost:5432` / `estoque_inteligente`).
4. Instale e suba:

```bash
npm install
npm start
```

A API sobe em `http://localhost:3001`.

## Swagger

Com o servidor no ar:

| Recurso | URL |
|---------|-----|
| UI interativa | [http://localhost:3001/api-docs](http://localhost:3001/api-docs) |
| Spec JSON (OpenAPI 3) | [http://localhost:3001/api-docs.json](http://localhost:3001/api-docs.json) |

Na UI, use **Authorize** com o JWT retornado em `/api/auth/login` ou `/api/auth/register` (sem o prefixo `Bearer` — o Swagger adiciona).

A spec vive em `src/docs/` e deve ser atualizada junto com novas rotas da Fase 1.

## Testar (alimenta o banco via API)

Com o servidor rodando em outro terminal:

```bash
npm run test:api
```

O script cria um usuário, faz login, cadastra produtos, registra consumo/baixa
e valida o status derivado (`ok` / `low` / `out`).

## Endpoints desta fatia

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Healthcheck |
| POST | `/api/auth/register` | Cadastro e-mail/senha |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/google` | Login/cadastro Google (`idToken`) |
| POST | `/api/auth/apple` | Login/cadastro Apple (`idToken`, `fullName?`) |
| POST | `/api/auth/link/google` | Vincular Google (JWT) |
| POST | `/api/auth/link/apple` | Vincular Apple (JWT) |
| GET | `/api/auth/me` | Sessão atual |
| PATCH | `/api/users/me` | Editar perfil |
| POST | `/api/users/me/password` | Definir/trocar senha |
| DELETE | `/api/users/me` | Encerrar conta (soft-delete) |
| GET | `/api/products` | Listar (filtros: `category`, `status`, `search`) |
| POST | `/api/products` | Criar produto (cadastro manual) |
| GET | `/api/products/:id` | Detalhe + histórico de movimentos |
| PATCH | `/api/products/:id` | Editar |
| POST | `/api/products/:id/consume` | Dar baixa (quantidade) |
| POST | `/api/products/:id/mark-out` | Zerar ("acabou") |
| POST | `/api/intakes/parse-text` | Texto → draft de compra |
| GET | `/api/intakes/:id` | Preview do draft |
| PATCH | `/api/intakes/:id` | Editar itens do draft |
| POST | `/api/intakes/:id/confirm` | Confirmar → atualiza estoque |
| POST | `/api/intakes/:id/cancel` | Cancelar draft |
| POST | `/api/stock-outs/parse-text` | Texto → draft de baixa |
| GET | `/api/stock-outs/:id` | Preview da baixa |
| PATCH | `/api/stock-outs/:id` | Editar itens |
| POST | `/api/stock-outs/:id/confirm` | Confirmar → desconta estoque |
| POST | `/api/stock-outs/:id/cancel` | Cancelar draft |
| GET | `/api/shopping-lists/active` | Lista ativa |
| POST | `/api/shopping-lists/generate` | Regenerar por regras |
| PATCH | `/api/shopping-lists/view-mode` | Preferência lista/paper |
| POST | `/api/shopping-lists/items` | Adicionar item manual |
| PATCH | `/api/shopping-lists/items/:id` | Check / editar |
| DELETE | `/api/shopping-lists/items/:id` | Remover item |

### Intake / baixa por texto + Gemini

Com `AI_API_KEY` (Gemini Flash no [AI Studio](https://aistudio.google.com/app/apikey)), o parse usa LLM.
Sem chave, cai no **parser heurístico**.

```env
AI_API_KEY=sua-chave
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
AI_MODEL=gemini-2.5-flash
```

### OAuth (Google / Apple)

1. Configure `GOOGLE_CLIENT_ID` / `APPLE_CLIENT_ID` no `.env` da API (mesmo Client ID do front).
2. No front: `VITE_GOOGLE_CLIENT_ID`, `VITE_APPLE_CLIENT_ID`, `VITE_APPLE_REDIRECT_URI`.
3. O browser obtém o `id_token` via SDK e envia para a API — teste preferencialmente pelo **client**, não pelo Swagger.

> `POST /api/products` (cadastro manual) foi adicionado nesta fatia para permitir
> alimentar o estoque sem depender da IA/NF; no `BACKEND.md` os produtos nascem
> principalmente via confirmação de intake.
