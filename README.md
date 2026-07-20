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
- Winston (logs)

> Observação: nesta fatia usei `bcryptjs` (JS puro, sem compilação nativa) e
> Express 4 para rodar sem dependências de build no Windows. Os módulos de IA,
> OCR, NF-e, filas (Redis/BullMQ), e-mail e login social descritos no
> `BACKEND.md` entram nas fases seguintes (dependem de chaves/serviços externos).

## Como rodar

1. Garanta o banco criado e as tabelas aplicadas (rode `database.sql` no
   banco `estoque_inteligente`).
2. Configure o `.env` (já vem apontando para `localhost:5432` / `estoque_inteligente`).
3. Instale e suba:

```bash
npm install
npm start
```

A API sobe em `http://localhost:3001`.

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

> `POST /api/products` (cadastro manual) foi adicionado nesta fatia para permitir
> alimentar o estoque sem depender da IA/NF; no `BACKEND.md` os produtos nascem
> principalmente via confirmação de intake.
