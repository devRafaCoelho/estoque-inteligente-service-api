# Estoque Inteligente — Próximos passos e plano de evolução

Documento de orientação de negócio e operação **além do código que já funciona**. Números em R$ / US$ são **ilustrativos** (ordem de grandeza, Brasil, 2026) — validar com cotações reais antes de decidir.

Produto atual: web app PWA + API + PostgreSQL, utilizável. O que falta para “empresa no ar” é sobretudo **aquisição, legal, lojas, pagamentos, escala e parcerias**.

---

## 1. Landing page (próximo passo recomendado)

### Por que

O app logado converte mal sozinho: falta página pública que explique a dor, mostre valor, CTA de cadastro/login e links legais (privacidade / termos).

### LP é parte do app ou repo à parte?

**Recomendação: repositório (ou site) separado**, com deploy estático próprio.

| Opção | Prós | Contras |
|-------|------|---------|
| **Site/repo à parte** (recomendado) | SEO limpo, deploy simples (Vercel/Netlify/Cloudflare Pages), time de marketing independente, zero risco de misturar rotas públicas com shell autenticado | Mais um repositório |
| Rota no client atual (`/`) | Um só projeto | Bundle do app, auth/PWA atrapalham SEO, deploys acoplados |
| Monorepo com package `marketing` | Organização única | Ainda deve ter **deploy separado** da app |

Fluxo ideal: `https://estoqueinteligente.com.br` (LP) → CTA → `https://app.estoqueinteligente.com.br` (produto atual).

Conteúdo mínimo da LP: proposta de valor, 3–5 benefícios, print/demo, FAQ, preços (quando houver), CTA Google/cadastro, links Privacidade e Termos.

---

## 2. Colocar o produto “de verdade” no ar

Já há hospedagem típica (ex.: Render). Para operação séria:

| Item | Ação |
|------|------|
| Domínio + DNS | Domínio próprio; `app.` e API em subdomínios |
| HTTPS | Obrigatório (PWA, push, OAuth) |
| Staging | Ambiente espelho antes de produção |
| Backups PostgreSQL | Diários + teste de restore |
| Observabilidade | Logs centralizados + APM/erros (Sentry ou similar) |
| Secrets | Rotação de JWT, VAPID, SMTP, chaves de IA |
| Cron | Digest de e-mail e jobs de monitor sob scheduler (não só sob demanda) |
| Apple Sign In | Conta Apple Developer + Service ID + domínio verificado |
| Política de privacidade e termos | Páginas públicas + aceite no cadastro |
| Suporte | E-mail/canal único (ex.: suporte@…) |

---

## 3. App nas lojas (Google Play + App Store)

### Caminho técnico

Reutilizar a **mesma API**. Client nativo com **React Native** (ou Expo) — port das telas principais, push nativo, voz nativa depois.

A PWA continua válida como canal web; lojas aumentam descoberta e confiança.

### Investimentos diretos (aprox.)

| Item | Estimativa |
|------|------------|
| Apple Developer Program | ~US$ 99 / ano |
| Google Play Console | ~US$ 25 (única) |
| Conta PJ / CNPJ (se necessário para loja/pagamento) | variável |
| Design store (ícone, screenshots, preview) | R$ 1.500–8.000 (freelance) ou interno |
| Textos dispositivos + QA | 2–6 semanas de esforço |
| Port RN (MVP paridade PWA) | 2–4 meses (1–2 devs) — ordem de grandeza |
| Compliance lojas (privacidade, age rating, login Apple se houver Google) | obrigatório no iOS |

### Ordem sugerida

1. LP + domínio + legal  
2. Hardening produção (backup, staging, erros)  
3. Assinaturas / gateway (se for cobrar)  
4. App nativo MVP  
5. Submissão lojas + iteração de review  

---

## 4. Modelo de receita (simulação)

### Planos ilustrativos

| Plano | Preço / mês | Inclui (exemplo) |
|-------|-------------|------------------|
| **Free** | R$ 0 | Estoque + lista + entrada texto; limites baixos de IA/foto |
| **Plus** | R$ 12,90 | IA generosa, foto/QR, push, financeiro completo |
| **Família** | R$ 24,90 | Plus + membros da casa + shares ilimitados |

Anual com desconto (~2 meses grátis) melhora caixa e retenção.

### Funil ilustrativo (mês 12)

| Métrica | Cenário conservador | Cenário base |
|---------|---------------------|--------------|
| Contas cadastradas (acumulado) | 3.000 | 10.000 |
| Ativos/mês (MAU) | 900 (30%) | 3.500 (35%) |
| Conversão paga | 4% dos MAU | 7% dos MAU |
| Assinantes | ~36 | ~245 |
| Mix ARPU | ~R$ 15 | ~R$ 16 |
| **Receita mensal** | ~R$ 540 | ~R$ 3.900 |

Break-even de infra “enxuta” (~R$ 400–800/mês) é alcançável no cenário base; break-even de **salário de 1 dev** exige bem mais escala ou receita B2B.

---

## 5. Custos para manter online (simulação mensal)

### Fase early (poucos usuários)

| Rubrica | Faixa R$/mês |
|---------|--------------|
| API + Postgres (Render/Railway/Fly) | 0–150 (hobby) → 80–300 (pago mínimo) |
| Front estático (Vercel/Netlify/Cloudflare) | 0–100 |
| Domínio / e-mail | 10–40 |
| SMTP transacional | 0–80 |
| IA (Gemini/OpenAI) | 50–400 (muito sensível a uso) |
| Monitoramento | 0–80 |
| **Total early** | **~R$ 150–800** |

### Fase growth (milhares de MAU + app)

| Rubrica | Faixa R$/mês |
|---------|--------------|
| API / workers | 400–2.000 |
| Postgres gerenciado + backup | 200–1.200 |
| CDN / WAF | 50–400 |
| IA | 500–5.000+ |
| Push / e-mail | 50–300 |
| Lojas (rateado) + ferramentas | 50–200 |
| Gateway (taxas % sobre MRR) | ~3–5% + fixo |
| **Total growth** | **~R$ 1.500–10.000+** |

Reserve buffer de **20–30%** para picos de IA e incidentes.

---

## 6. Ideias de evolução de produto

### 6.1 Mercadinhos locais parceiros (alto potencial + LGPD)

**Ideia:** com **opt-in explícito**, compartilhar com mercados parceiros próximos (CEP/bairro) um resumo ou lista agregada/anonimizada — ou, com consentimento forte, a lista do usuário para oferta/reserva.

Exige:

- Finalidade clara no Termo e na tela de consentimento  
- Opt-in granular (não “aceito tudo” escondido)  
- Base legal LGPD (consentimento; ou legítimo interesse só se bem fundamentado — preferir consentimento)  
- Contrato com o parceiro (DPA / cláusulas de tratamento)  
- Direito de revogar e apagar  
- Minimização: preferir agregados a dados identificáveis  
- Registro de quem acessou o quê  

Sem isso, a feature não deve ir ao ar.

### 6.2 Outras ideias

| Ideia | Valor | Complexidade |
|-------|-------|--------------|
| Mais UFs no NF-e | Menos atrito regional | Média (adapters) |
| Offline parcial | Uso no mercado sem sinal | Alta |
| Dicas financeiras mais fortes | Retenção Plus | Média |
| Lista colaborativa em tempo real | Família | Média |
| B2B leve (síndico / kit casas) | Receita B2B | Alta |
| API para parceiros (white-label leve) | Escala | Alta |
| Ofertas com base em lista (cashback) | Monetização | Alta + compliance |
| Widget / atalhos iOS/Android | Hábito | Média (nativo) |

---

## 7. LGPD e confiança

Checklist mínimo antes de escala e parcerias:

1. Política de Privacidade e Termos públicos  
2. Aceite versionado no cadastro  
3. Preferências de comunicação (e-mail/push)  
4. Exportação / exclusão de conta  
5. Inventário de dados (o que guarda e por quê)  
6. Para parceiros: consentimento específico + contrato  
7. Canal de titular (e-mail DPO ou responsável)  
8. Logs de acesso a dados sensíveis de parceria  

---

## 8. Infra, segurança e escala (além do código ok)

| Área | Situação típica atual | Próximo nível |
|------|----------------------|---------------|
| Filas | Sem Redis/BullMQ | Fila para OCR/NF/digest |
| Rate limit IA | Memória por processo | Redis / gateway |
| Multi-instância | Arriscado com estado em memória | Stateless + store compartilhado |
| Pagamentos | Não há | Stripe / Pagar.me / ASI |
| Staging | Pode faltar | Obrigatório pré-loja |
| CI/CD | Push manual | Pipeline + migrations controladas |
| Segurança | JWT + HTTPS | WAF, headers, pentest leve, rotação de secrets |
| Escala leitura | Postgres único | Réplicas / cache quando necessário |
| App stores | Só PWA | Binários + review contínua |

---

## 9. Roadmap sugerido (12–18 meses)

| Fase | Foco | Resultado |
|------|------|-----------|
| **A — Embalar** | LP, domínio, legal, backups, Sentry, Apple login prod | Produto apresentável e seguro |
| **B — Monetizar** | Planos + gateway + paywall suave na IA | Primeira receita |
| **C — Distribuir** | RN MVP + Play + App Store | Canal lojas |
| **D — Crescer** | Parcerias locais (LGPD), mais UFs, offline parcial | Diferenciação e B2B leve |

---

## 10. Respostas diretas

**Precisa de landing page?** Sim, como próximo passo de aquisição — antes ou em paralelo ao app nativo.

**A LP entra no projeto atual?** Não como tela misturada ao app logado. Ideal: **site/repo à parte** apontando para o app.

**O que mais falta além do código?** Domínio/legal, operação (backup/monitor/cron), login Apple em produção, cobrança, lojas, e decisões de parceria com compliance.

**Código de barras / trocar nome da marca?** Fora do roadmap atual (mantém-se Estoque Inteligente).
