# Estoque Inteligente — Back-end (visão geral)

Documentação **geral** da API. Como rodar, variáveis e lista de endpoints: README do repositório `estoque-inteligente-service-api`.

## Papel

API HTTP que autentica o usuário, interpreta entradas (texto/IA, foto, NF-e), persiste estoque/financeiro/lista, monitora alertas, serve o chat com tools e envia canais (push/e-mail).

## Forma

| Aspecto | Abordagem |
|---------|-----------|
| Estilo | API REST JSON |
| Camadas | routes → middlewares → controllers → services → repositories |
| Banco | PostgreSQL (`database.sql` único) |
| Auth | JWT + identidades locais/Google/Apple |
| Docs interativas | Swagger / OpenAPI |
| Filas | Sem broker dedicado na entrega atual (processamento síncrono / scripts) |

## Domínios principais

- Conta e preferências  
- Produtos e movimentações  
- Intakes / stock-outs (draft → confirm)  
- Lista + share  
- Household  
- Financeiro  
- Notificações + Web Push + digest (script)  
- Chat (tools com preview)  
- NF-e (adapters por UF + cobertura/logs)

## Operação

- Catálogos de referência (categorias, unidades, UFs) são **criados vazios no SQL** e **preenchidos no boot** da API  
- Rate limit de IA em memória (por processo) na entrega atual  
- SMTP e VAPID opcionais; sem eles, preview de e-mail / push desligado

## Evolução típica (não implementada aqui)

Filas, rate limit distribuído, ambiente de staging, APM, backups automatizados, gateway de pagamento — ver `PROXIMOS-PASSOS.md`.
