# Estoque Inteligente — Documentação do Produto

## 1. Visão geral

| Uso | Valor |
|-----|-------|
| **Nome** | Estoque Inteligente |
| **Subtítulo** | Assistente de estoque e lista de mercado da casa |

O **Estoque Inteligente** é um aplicativo de **gestão de estoque doméstico**, pensado primeiro para **celular**. Ajuda a saber o que tem em casa, o que está acabando e o que precisa comprar — sem depender só da memória.

**Não é** ERP de loja, marketplace, app de receitas nem scanner de código de barras. É um assistente doméstico que mantém o estoque atualizado e gera listas no momento certo.

### Plataforma

| Fase | Superfície | Objetivo |
|------|------------|----------|
| **Atual** | Web app (PWA) mobile-first + API | Produto utilizável no navegador / instalável |
| **Próximo** | App nativo (iOS/Android) reutilizando a mesma API | Distribuição nas lojas |

### Princípios

| Objetivo | Como |
|----------|------|
| Cadastro sem atrito | Texto, voz, foto do cupom ou QR da NF-e → lista pronta para revisar |
| Login simples | Google (principal) + e-mail/senha; Apple quando configurado |
| Estoque vivo | Baixas rápidas, estimativa de consumo e alertas |
| Lista útil | Regras + chat + compartilhamento + conta familiar |
| Controle financeiro | Compras com preço viram gasto; visão por mês/categoria |

---

## 2. Para quem é

Produto **B2C** — pessoa ou família.

- Conta individual ou **conta familiar** (dono + membros)
- Sem papéis comerciais/admin de empresa

---

## 3. O que o usuário faz

### Entrada de produtos (compra)

1. Informa a compra por **texto**, **voz**, **foto do cupom**, **QR da NF-e** ou **manual**
2. O sistema monta uma lista de itens
3. A pessoa **revisa no preview** (obrigatório) e confirma
4. O estoque sobe; se houver preço, alimenta o financeiro

### Baixa (consumo)

1. Diz o que consumiu (texto/voz) ou usa atalho (“usei o usual”, marcar acabou)
2. Revisa no preview e confirma
3. O estoque desce; o histórico alimenta estimativas e alertas

### Lista de compras

- Gerada por regras (estoque baixo/zerado, tempo de recompra) e ajustes manuais/voz
- Modos de visualização (lista e “paper”)
- Estimativa de gasto quando há preço médio
- **Compartilhar** por link (ex.: WhatsApp) com visão controlada

### Assistente (chat)

Perguntas do tipo “o que falta?”, propostas de baixa/lista/compra e dicas financeiras — sempre com CTA para revisar antes de gravar.

### Alertas

Estoque baixo/zerado, lembrete de recompra, nudge de baixa esquecida — in-app, Web Push (opt-in) e digest por e-mail (opt-in), com horário silencioso.

---

## 4. Telas (visão do produto)

| Área | O que a pessoa encontra |
|------|-------------------------|
| Login / cadastro | Google, e-mail/senha; reset por e-mail |
| Dashboard | Resumo do estoque, atalhos, alertas |
| Entrada | Texto, foto/QR, manual → preview → confirmar |
| Baixa | Texto/voz → preview → confirmar |
| Produtos | Cards, filtros, detalhe, histórico |
| Lista de compras | Itens, paper, share, estimativa de gasto |
| Chat | Assistente com propostas acionáveis |
| Financeiro | Gastos do mês, categorias, tendências, dicas |
| Notificações | Centro de alertas |
| Minha conta | Perfil, preferências, push, quiet hours, conta familiar |

---

## 5. Conta familiar

- Dono cria a casa e convida por e-mail
- Membros compartilham estoque e lista no escopo da casa
- Papéis simples: **dono** e **membro**

---

## 6. NF-e / NFC-e

- Leitura por QR/chave nas **UFs com suporte** (atualmente SP, MG, BA, RJ, PR)
- Se o portal falhar ou a UF não for suportada → fallback para **foto do cupom**
- Cobertura nacional completa **não** é promessa da versão atual

---

## 7. Autenticação

| Método | Situação |
|--------|----------|
| E-mail + senha | Disponível |
| Google | Disponível (com Client ID configurado) |
| Apple | Preparado no produto; depende de configuração / conta developer |

Dados de perfil vêm do provedor quando possível. Contas com o mesmo e-mail podem ser vinculadas.

---

## 8. Regras de operação (produto)

- Nenhuma compra/baixa grava estoque **sem preview confirmado**
- Unidades e categorias padronizadas
- Baixa maior que o estoque: aviso no preview
- Privacidade: dados da conta/casa; exclusão/anonimização ao encerrar conta
- Limites diários de uso de IA para proteger custo e abuso

---

## 9. Status da entrega

### Entregue (Fases 1–3)

- Auth Google + e-mail/senha + minha conta
- App web PWA (shell mobile-first)
- Produtos, entrada e baixa (texto, voz no browser, foto, QR NF, manual)
- Preview obrigatório
- Dashboard, lista (paper), financeiro, chat com tools
- Monitor de recompra, nudges, push, e-mail (boas-vindas/reset/digest)
- Compartilhar lista
- Conta familiar
- UFs extras no collector NF + mensagens de cobertura
- Estimativa de gasto da lista ativa
- Quantidade sugerida no nudge (“usei o usual”)

### Evoluções futuras (não bloqueiam o uso atual)

- App nativo (React Native ou equivalente) nas lojas
- Voz nativa no app
- Modo offline parcial (cache + sync)
- Landing page de marketing (ver `PROXIMOS-PASSOS.md`)
- Parcerias com mercadinhos locais (com LGPD e opt-in)

---

## 10. Especificação técnica (geral)

| Camada | Papel |
|--------|--------|
| **Client** | Web app React (PWA), UI mobile-first |
| **API** | Serviço HTTP que autentica, processa entradas e persiste domínio |
| **Banco** | PostgreSQL — modelo relacional multi-usuário / família |
| **IA** | Parse de texto/imagem e chat (provedor configurável); há fallback sem IA |
| **Canais** | Web Push + e-mail transacional |

Detalhes de pasta, variáveis e como rodar: READMEs de cada repositório. Modelo de dados: `DATABASE.md`. Plano de negócio e próximos passos: `PROXIMOS-PASSOS.md`.

---

## 11. Concorrência (resumo)

A categoria “despensa digital” já existe. O diferencial buscado é **menor atrito para manter o estoque fiel** (linguagem natural, NF/foto, preview, família e lista útil) — não inventar a categoria.

---

## 12. Riscos de produto

| Risco | Mitigação |
|-------|-----------|
| IA erra item/quantidade | Preview obrigatório |
| Portal SEFAZ instável | Fallback foto; UFs incrementais |
| Usuário não dá baixa | Nudges + atalhos + chat |
| Fadiga de notificação | Agrupar, quiet hours, preferências |
| Custo de IA | Rate limit diário |

---

## 13. Métricas de sucesso (orientação)

- Contas ativas semanais
- % de entradas via texto/foto/QR vs manual
- Frequência de baixas (estoque “vivo”)
- Uso da lista no mercado (checks / share)
- Retenção D7 / D30
- (Futuro) conversão Free → pago

---

## 14. Glossário

| Termo | Significado |
|-------|-------------|
| **Intake** | Entrada de compra (rascunho → confirmado) |
| **Stock-out / baixa** | Registro de consumo |
| **Preview** | Tela de revisão antes de gravar |
| **Nudge** | Lembrete suave para dar baixa |
| **Household** | Conta familiar compartilhada |
| **PWA** | App instalável pelo navegador |

---

## Documentação relacionada

| Arquivo | Conteúdo |
|---------|----------|
| `DATABASE.md` | Estrutura do banco |
| `FRONTEND.md` | Visão geral do client |
| `BACKEND.md` | Visão geral da API |
| `PROXIMOS-PASSOS.md` | Plano de evolução, lojas, finanças, LP, LGPD |
| READMEs dos repos | Como rodar e o que cada repo entrega |
