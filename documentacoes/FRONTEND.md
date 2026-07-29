# Estoque Inteligente — Front-end (visão geral)

Documentação **geral** do client. Detalhes de stack, scripts e rotas: README do repositório `estoque-inteligente-client`.

## Papel

Interface **app-first** (celular primeiro) do Estoque Inteligente: autenticação, estoque, entrada/baixa, lista, financeiro, chat, notificações e conta familiar.

É o **produto** que a pessoa usa. Marketing / landing page de aquisição **não** faz parte deste app (ver `PROXIMOS-PASSOS.md`).

## Forma

| Aspecto | Abordagem |
|---------|-----------|
| Superfície | Web + PWA (instalável) |
| UI | Mobile-first; desktop como adaptação |
| Organização | Páginas → componentes → serviços HTTP → API |
| Estado | Contexto da sessão + dados vindos da API |
| Offline | Ainda online-first; offline parcial é evolução futura |

## Fluxos centrais

1. **Entrada / baixa** → parse (texto, voz no browser, foto, QR) → **preview** → confirmar  
2. **Lista** → regras + edição → paper / share / estimativa  
3. **Chat** → proposta → CTA para o mesmo preview  
4. **Alertas** → in-app + push (opt-in)

## Integração

- Em desenvolvimento, proxy `/api` → API local  
- Em produção, `VITE_API_BASE_URL` aponta para a API hospedada  
- Login social depende de Client IDs configurados (Google/Apple)

## Fora deste documento

Árvore de pastas detalhada, guia de componentes e contratos de cada endpoint — ver README do client e Swagger da API.
