const { CATEGORIES } = require("./components");

const paths = {
  "/health": {
    get: {
      tags: ["Health"],
      summary: "Healthcheck",
      security: [],
      responses: {
        200: {
          description: "API no ar",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "string", example: "ok" },
                },
              },
            },
          },
        },
      },
    },
  },

  "/api/auth/register": {
    post: {
      tags: ["Auth"],
      summary: "Cadastro com e-mail e senha",
      security: [],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/RegisterRequest" },
          },
        },
      },
      responses: {
        201: {
          description: "Conta criada e sessão iniciada",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Session" },
            },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        409: { $ref: "#/components/responses/Conflict" },
      },
    },
  },

  "/api/auth/login": {
    post: {
      tags: ["Auth"],
      summary: "Login com e-mail e senha",
      security: [],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/LoginRequest" },
          },
        },
      },
      responses: {
        200: {
          description: "Sessão iniciada",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Session" },
            },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        401: { $ref: "#/components/responses/Unauthorized" },
      },
    },
  },

  "/api/auth/google": {
    post: {
      tags: ["Auth"],
      summary: "Login/cadastro com Google",
      description:
        "Recebe o id_token (credential) do Google Identity Services. " +
        "Cria a conta automaticamente no 1º acesso.",
      security: [],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/OAuthTokenRequest" },
          },
        },
      },
      responses: {
        200: {
          description: "Sessão iniciada (isNewUser=true no 1º acesso)",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Session" },
            },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        401: { $ref: "#/components/responses/Unauthorized" },
        503: {
          description: "GOOGLE_CLIENT_ID não configurado",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/Error" } },
          },
        },
      },
    },
  },

  "/api/auth/apple": {
    post: {
      tags: ["Auth"],
      summary: "Login/cadastro com Apple",
      description:
        "Recebe o id_token do Sign in with Apple. " +
        "fullName é opcional e só costuma vir na 1ª autorização.",
      security: [],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/OAuthTokenRequest" },
          },
        },
      },
      responses: {
        200: {
          description: "Sessão iniciada (isNewUser=true no 1º acesso)",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Session" },
            },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        401: { $ref: "#/components/responses/Unauthorized" },
        503: {
          description: "APPLE_CLIENT_ID não configurado",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/Error" } },
          },
        },
      },
    },
  },

  "/api/auth/me": {
    get: {
      tags: ["Auth"],
      summary: "Usuário da sessão atual",
      responses: {
        200: {
          description: "Perfil autenticado",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  user: { $ref: "#/components/schemas/User" },
                },
              },
            },
          },
        },
        401: { $ref: "#/components/responses/Unauthorized" },
        404: { $ref: "#/components/responses/NotFound" },
      },
    },
  },

  "/api/auth/link/google": {
    post: {
      tags: ["Auth"],
      summary: "Vincular Google à conta logada",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/OAuthTokenRequest" },
          },
        },
      },
      responses: {
        200: {
          description: "Provedor vinculado (ou já estava)",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LinkProviderResponse" },
            },
          },
        },
        401: { $ref: "#/components/responses/Unauthorized" },
        409: { $ref: "#/components/responses/Conflict" },
        503: {
          description: "GOOGLE_CLIENT_ID não configurado",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/Error" } },
          },
        },
      },
    },
  },

  "/api/auth/link/apple": {
    post: {
      tags: ["Auth"],
      summary: "Vincular Apple à conta logada",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/OAuthTokenRequest" },
          },
        },
      },
      responses: {
        200: {
          description: "Provedor vinculado (ou já estava)",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LinkProviderResponse" },
            },
          },
        },
        401: { $ref: "#/components/responses/Unauthorized" },
        409: { $ref: "#/components/responses/Conflict" },
        503: {
          description: "APPLE_CLIENT_ID não configurado",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/Error" } },
          },
        },
      },
    },
  },

  "/api/users/me": {
    patch: {
      tags: ["Users"],
      summary: "Atualizar perfil",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/UpdateMeRequest" },
          },
        },
      },
      responses: {
        200: {
          description: "Perfil atualizado",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  user: { $ref: "#/components/schemas/User" },
                },
              },
            },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        401: { $ref: "#/components/responses/Unauthorized" },
        404: { $ref: "#/components/responses/NotFound" },
      },
    },
    delete: {
      tags: ["Users"],
      summary: "Encerrar conta (soft-delete)",
      responses: {
        200: {
          description: "Conta encerrada",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  deleted: { type: "boolean", example: true },
                },
              },
            },
          },
        },
        401: { $ref: "#/components/responses/Unauthorized" },
      },
    },
  },

  "/api/users/me/password": {
    post: {
      tags: ["Users"],
      summary: "Definir ou trocar senha",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ChangePasswordRequest" },
          },
        },
      },
      responses: {
        200: {
          description: "Senha atualizada",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  updated: { type: "boolean", example: true },
                },
              },
            },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        401: { $ref: "#/components/responses/Unauthorized" },
        404: { $ref: "#/components/responses/NotFound" },
      },
    },
  },

  "/api/products": {
    get: {
      tags: ["Products"],
      summary: "Listar produtos",
      parameters: [
        {
          name: "category",
          in: "query",
          schema: { type: "string", enum: CATEGORIES },
        },
        {
          name: "status",
          in: "query",
          schema: { type: "string", enum: ["ok", "low", "out"] },
          description: "Status derivado do estoque",
        },
        {
          name: "search",
          in: "query",
          schema: { type: "string", maxLength: 200 },
        },
        {
          name: "active",
          in: "query",
          schema: { type: "boolean" },
        },
      ],
      responses: {
        200: {
          description: "Lista de produtos",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  products: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Product" },
                  },
                },
              },
            },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        401: { $ref: "#/components/responses/Unauthorized" },
      },
    },
    post: {
      tags: ["Products"],
      summary: "Criar produto (cadastro manual)",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CreateProductRequest" },
          },
        },
      },
      responses: {
        201: {
          description: "Produto criado",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  product: { $ref: "#/components/schemas/ProductDetail" },
                },
              },
            },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        401: { $ref: "#/components/responses/Unauthorized" },
      },
    },
  },

  "/api/products/{id}": {
    get: {
      tags: ["Products"],
      summary: "Detalhe do produto + movimentos",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: {
        200: {
          description: "Produto encontrado",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  product: { $ref: "#/components/schemas/ProductDetail" },
                },
              },
            },
          },
        },
        401: { $ref: "#/components/responses/Unauthorized" },
        404: { $ref: "#/components/responses/NotFound" },
      },
    },
    patch: {
      tags: ["Products"],
      summary: "Atualizar produto",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/UpdateProductRequest" },
          },
        },
      },
      responses: {
        200: {
          description: "Produto atualizado",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  product: { $ref: "#/components/schemas/ProductDetail" },
                },
              },
            },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        401: { $ref: "#/components/responses/Unauthorized" },
        404: { $ref: "#/components/responses/NotFound" },
      },
    },
  },

  "/api/products/{id}/consume": {
    post: {
      tags: ["Products"],
      summary: "Dar baixa (consumo)",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ConsumeProductRequest" },
          },
        },
      },
      responses: {
        200: {
          description: "Baixa registrada",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  product: { $ref: "#/components/schemas/ProductDetail" },
                },
              },
            },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        401: { $ref: "#/components/responses/Unauthorized" },
        404: { $ref: "#/components/responses/NotFound" },
      },
    },
  },

  "/api/products/{id}/mark-out": {
    post: {
      tags: ["Products"],
      summary: 'Zerar estoque ("acabou")',
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: {
        200: {
          description: "Produto zerado",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  product: { $ref: "#/components/schemas/ProductDetail" },
                },
              },
            },
          },
        },
        401: { $ref: "#/components/responses/Unauthorized" },
        404: { $ref: "#/components/responses/NotFound" },
      },
    },
  },

  "/api/intakes/parse-text": {
    post: {
      tags: ["Intakes"],
      summary: "Parse texto → draft de compra",
      description:
        "Etapa 1 usa parser heurístico (sem OpenAI). " +
        'Ex.: "2kg arroz, 1 leite, 500g feijão".',
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ParseTextRequest" },
          },
        },
      },
      responses: {
        201: {
          description: "Draft criado",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  intake: { $ref: "#/components/schemas/Intake" },
                },
              },
            },
          },
        },
        401: { $ref: "#/components/responses/Unauthorized" },
        422: { $ref: "#/components/responses/BadRequest" },
      },
    },
  },

  "/api/intakes/{id}": {
    get: {
      tags: ["Intakes"],
      summary: "Obter draft/preview da entrada",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: {
        200: {
          description: "Entrada encontrada",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  intake: { $ref: "#/components/schemas/Intake" },
                },
              },
            },
          },
        },
        401: { $ref: "#/components/responses/Unauthorized" },
        404: { $ref: "#/components/responses/NotFound" },
      },
    },
    patch: {
      tags: ["Intakes"],
      summary: "Editar itens do draft",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/UpdateIntakeRequest" },
          },
        },
      },
      responses: {
        200: {
          description: "Draft atualizado",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  intake: { $ref: "#/components/schemas/Intake" },
                },
              },
            },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        401: { $ref: "#/components/responses/Unauthorized" },
        404: { $ref: "#/components/responses/NotFound" },
      },
    },
  },

  "/api/intakes/{id}/confirm": {
    post: {
      tags: ["Intakes"],
      summary: "Confirmar draft → atualiza estoque",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ConfirmIntakeRequest" },
          },
        },
      },
      responses: {
        200: {
          description: "Estoque atualizado",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  intake: { $ref: "#/components/schemas/Intake" },
                  products: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Product" },
                  },
                  purchase: { type: "object", nullable: true },
                },
              },
            },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        401: { $ref: "#/components/responses/Unauthorized" },
        404: { $ref: "#/components/responses/NotFound" },
      },
    },
  },

  "/api/intakes/{id}/cancel": {
    post: {
      tags: ["Intakes"],
      summary: "Cancelar draft",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: {
        200: {
          description: "Draft cancelado",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  intake: { $ref: "#/components/schemas/Intake" },
                },
              },
            },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        401: { $ref: "#/components/responses/Unauthorized" },
        404: { $ref: "#/components/responses/NotFound" },
      },
    },
  },

  "/api/shopping-lists/active": {
    get: {
      tags: ["ShoppingLists"],
      summary: "Obter lista ativa",
      responses: {
        200: { description: "Lista ativa (cria vazia se não existir)" },
        401: { $ref: "#/components/responses/Unauthorized" },
      },
    },
  },

  "/api/shopping-lists/generate": {
    post: {
      tags: ["ShoppingLists"],
      summary: "Gerar/atualizar por regras",
      description:
        "Inclui produtos zerados, acabando e com recompra vencida. Mantém itens marcados e manuais.",
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                mode: { type: "string", enum: ["rules"], default: "rules" },
              },
            },
          },
        },
      },
      responses: {
        200: { description: "Lista regenerada" },
        401: { $ref: "#/components/responses/Unauthorized" },
      },
    },
  },

  "/api/shopping-lists/view-mode": {
    patch: {
      tags: ["ShoppingLists"],
      summary: "Salvar preferência Lista/Paper",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["viewMode"],
              properties: {
                viewMode: { type: "string", enum: ["list", "paper"] },
              },
            },
          },
        },
      },
      responses: {
        200: { description: "Preferência salva" },
        401: { $ref: "#/components/responses/Unauthorized" },
      },
    },
  },

  "/api/shopping-lists/items": {
    post: {
      tags: ["ShoppingLists"],
      summary: "Adicionar item manual",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["name"],
              properties: {
                name: { type: "string" },
                suggestedQty: { type: "number", nullable: true },
                unit: { type: "string" },
                priority: { type: "string", enum: ["high", "medium", "low"] },
              },
            },
          },
        },
      },
      responses: {
        201: { description: "Item criado" },
        401: { $ref: "#/components/responses/Unauthorized" },
      },
    },
  },

  "/api/shopping-lists/items/{id}": {
    patch: {
      tags: ["ShoppingLists"],
      summary: "Atualizar item (check/editar)",
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                checked: { type: "boolean" },
                name: { type: "string" },
                suggestedQty: { type: "number", nullable: true },
                priority: { type: "string", enum: ["high", "medium", "low"] },
              },
            },
          },
        },
      },
      responses: {
        200: { description: "Item atualizado" },
        401: { $ref: "#/components/responses/Unauthorized" },
        404: { $ref: "#/components/responses/NotFound" },
      },
    },
    delete: {
      tags: ["ShoppingLists"],
      summary: "Remover item",
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
      ],
      responses: {
        200: { description: "Item removido" },
        401: { $ref: "#/components/responses/Unauthorized" },
        404: { $ref: "#/components/responses/NotFound" },
      },
    },
  },

  "/api/notifications": {
    get: {
      tags: ["Notifications"],
      summary: "Listar notificações (avalia monitor de estoque antes)",
      parameters: [
        {
          name: "unreadOnly",
          in: "query",
          schema: { type: "boolean" },
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", minimum: 1, maximum: 100 },
        },
      ],
      responses: {
        200: {
          description: "Lista + contagem de não lidas",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  notifications: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Notification" },
                  },
                  unreadCount: { type: "integer" },
                },
              },
            },
          },
        },
        401: { $ref: "#/components/responses/Unauthorized" },
      },
    },
  },

  "/api/notifications/unread-count": {
    get: {
      tags: ["Notifications"],
      summary: "Contagem de não lidas",
      responses: {
        200: {
          description: "Contagem",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { unreadCount: { type: "integer" } },
              },
            },
          },
        },
        401: { $ref: "#/components/responses/Unauthorized" },
      },
    },
  },

  "/api/notifications/read-all": {
    post: {
      tags: ["Notifications"],
      summary: "Marcar todas como lidas",
      responses: {
        200: { description: "Atualizado" },
        401: { $ref: "#/components/responses/Unauthorized" },
      },
    },
  },

  "/api/notifications/{id}/read": {
    post: {
      tags: ["Notifications"],
      summary: "Marcar notificação como lida",
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
      ],
      responses: {
        200: { description: "Notificação atualizada" },
        401: { $ref: "#/components/responses/Unauthorized" },
        404: { $ref: "#/components/responses/NotFound" },
      },
    },
  },

  "/api/dashboard/stats": {
    get: {
      tags: ["Dashboard"],
      summary: "Cards + alertas recentes + produtos críticos",
      responses: {
        200: {
          description: "Resumo do dashboard",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  stats: {
                    type: "object",
                    properties: {
                      total: { type: "integer" },
                      ok: { type: "integer" },
                      low: { type: "integer" },
                      out: { type: "integer" },
                      unreadNotifications: { type: "integer" },
                    },
                  },
                  criticalProducts: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Product" },
                  },
                  recentAlerts: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Notification" },
                  },
                },
              },
            },
          },
        },
        401: { $ref: "#/components/responses/Unauthorized" },
      },
    },
  },
};

module.exports = paths;
