const CATEGORIES = [
  "cleaning",
  "hygiene",
  "produce",
  "grocery",
  "dairy",
  "beverages",
  "frozen",
  "household",
  "other",
];

const UNITS = ["un", "g", "kg", "ml", "l", "pack", "can", "bottle", "box", "other"];

const Error = {
  type: "object",
  required: ["error"],
  properties: {
    error: { type: "string", example: "Mensagem de erro" },
    details: {
      description: "Detalhes opcionais (validação Joi, constraint, etc.)",
      nullable: true,
    },
  },
};

const User = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    firstName: { type: "string", example: "Maria" },
    lastName: { type: "string", example: "Silva", nullable: true },
    name: {
      type: "string",
      example: "Maria Silva",
      description: "Nome completo derivado de firstName + lastName",
    },
    email: { type: "string", format: "email", example: "maria@email.com" },
    avatarUrl: { type: "string", format: "uri", nullable: true },
    phone: { type: "string", nullable: true, example: "11999998888" },
    cpf: { type: "string", nullable: true, example: "12345678901" },
    zipCode: { type: "string", nullable: true, example: "01310100" },
    street: { type: "string", nullable: true },
    streetNumber: { type: "string", nullable: true },
    complement: { type: "string", nullable: true },
    neighborhood: { type: "string", nullable: true },
    city: { type: "string", nullable: true },
    defaultState: {
      type: "string",
      nullable: true,
      minLength: 2,
      maxLength: 2,
      example: "SP",
      description: "UF do endereço / padrão para NF-e",
    },
    status: { type: "string", example: "active" },
    authProviders: {
      type: "array",
      items: { type: "string", example: "local" },
    },
    lastLoginAt: { type: "string", format: "date-time", nullable: true },
    createdAt: { type: "string", format: "date-time" },
  },
};

const Session = {
  type: "object",
  required: ["token", "user", "isNewUser"],
  properties: {
    token: {
      type: "string",
      description: "JWT Bearer — use no header Authorization",
    },
    user: { $ref: "#/components/schemas/User" },
    isNewUser: { type: "boolean" },
  },
};

const Movement = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    type: { type: "string", example: "consume" },
    quantity: { type: "number", example: 1 },
    unit: { type: "string", enum: UNITS },
    quantityBefore: { type: "number" },
    quantityAfter: { type: "number" },
    note: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" },
  },
};

const Product = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    name: { type: "string", example: "Arroz" },
    category: { type: "string", enum: CATEGORIES },
    quantity: { type: "number", example: 2 },
    unit: { type: "string", enum: UNITS },
    minQuantity: { type: "number", example: 1 },
    stockStatus: { type: "string", enum: ["ok", "low", "out"] },
    avgUnitPrice: { type: "number", nullable: true },
    lastPurchasedAt: { type: "string", format: "date-time", nullable: true },
    lastConsumedAt: { type: "string", format: "date-time", nullable: true },
    avgWeeklyUsage: { type: "number", nullable: true },
    repurchaseDays: { type: "integer", nullable: true },
    active: { type: "boolean" },
  },
};

const ProductDetail = {
  allOf: [
    { $ref: "#/components/schemas/Product" },
    {
      type: "object",
      properties: {
        notes: { type: "string", nullable: true },
        consumptionCycleDays: { type: "integer", nullable: true },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
        movements: {
          type: "array",
          items: { $ref: "#/components/schemas/Movement" },
        },
      },
    },
  ],
};

module.exports = {
  CATEGORIES,
  UNITS,
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Token retornado em `/api/auth/login` ou `/api/auth/register`",
      },
    },
    schemas: {
      Error,
      User,
      Session,
      Movement,
      Product,
      ProductDetail,
      RegisterRequest: {
        type: "object",
        required: ["name", "email", "password"],
        properties: {
          name: { type: "string", minLength: 2, maxLength: 150 },
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 8, maxLength: 128 },
          defaultState: {
            type: "string",
            minLength: 2,
            maxLength: 2,
            nullable: true,
            example: "SP",
          },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string" },
        },
      },
      OAuthTokenRequest: {
        type: "object",
        required: ["idToken"],
        properties: {
          idToken: {
            type: "string",
            description: "id_token JWT emitido pelo Google ou Apple",
          },
          fullName: {
            type: "string",
            nullable: true,
            maxLength: 150,
            description: "Nome (Apple costuma enviar só na 1ª autorização)",
          },
        },
      },
      LinkProviderResponse: {
        type: "object",
        properties: {
          user: { $ref: "#/components/schemas/User" },
          linked: {
            type: "boolean",
            description: "true se o vínculo foi criado agora; false se já existia",
          },
        },
      },
      UpdateMeRequest: {
        type: "object",
        minProperties: 1,
        properties: {
          firstName: { type: "string", minLength: 2, maxLength: 150 },
          lastName: { type: "string", maxLength: 150, nullable: true },
          defaultState: {
            type: "string",
            minLength: 2,
            maxLength: 2,
            nullable: true,
          },
          avatarUrl: { type: "string", format: "uri", nullable: true },
          phone: { type: "string", nullable: true },
          cpf: { type: "string", nullable: true },
          zipCode: { type: "string", nullable: true },
          street: { type: "string", nullable: true },
          streetNumber: { type: "string", nullable: true },
          complement: { type: "string", nullable: true },
          neighborhood: { type: "string", nullable: true },
          city: { type: "string", nullable: true },
        },
      },
      ChangePasswordRequest: {
        type: "object",
        required: ["newPassword"],
        properties: {
          currentPassword: {
            type: "string",
            nullable: true,
            description: "Obrigatório se a conta já tiver senha local",
          },
          newPassword: { type: "string", minLength: 8, maxLength: 128 },
        },
      },
      UserPreferences: {
        type: "object",
        properties: {
          notifyLowStock: { type: "boolean" },
          notifyOutOfStock: { type: "boolean" },
          notifyRepurchase: { type: "boolean" },
          notifyConsumptionNudge: { type: "boolean" },
          notifyEmailDigest: { type: "boolean" },
          consumptionNudgeDays: { type: "integer", minimum: 1, maximum: 30 },
          shoppingListViewMode: { type: "string", enum: ["list", "paper"] },
          currency: { type: "string" },
          locale: { type: "string" },
        },
      },
      UpdatePreferencesRequest: {
        type: "object",
        minProperties: 1,
        properties: {
          notifyLowStock: { type: "boolean" },
          notifyOutOfStock: { type: "boolean" },
          notifyRepurchase: { type: "boolean" },
          notifyConsumptionNudge: { type: "boolean" },
          notifyEmailDigest: { type: "boolean" },
          consumptionNudgeDays: { type: "integer", minimum: 1, maximum: 30 },
          shoppingListViewMode: { type: "string", enum: ["list", "paper"] },
        },
      },
      CreateProductRequest: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 200 },
          category: { type: "string", enum: CATEGORIES, default: "other" },
          quantity: { type: "number", minimum: 0, default: 0 },
          unit: { type: "string", enum: UNITS, default: "un" },
          minQuantity: { type: "number", minimum: 0, default: 1 },
          avgUnitPrice: { type: "number", minimum: 0, nullable: true },
          repurchaseDays: { type: "integer", minimum: 1, nullable: true },
          notes: { type: "string", nullable: true },
        },
      },
      UpdateProductRequest: {
        type: "object",
        minProperties: 1,
        properties: {
          name: { type: "string", minLength: 1, maxLength: 200 },
          category: { type: "string", enum: CATEGORIES },
          quantity: { type: "number", minimum: 0 },
          unit: { type: "string", enum: UNITS },
          minQuantity: { type: "number", minimum: 0 },
          avgUnitPrice: { type: "number", minimum: 0, nullable: true },
          repurchaseDays: { type: "integer", minimum: 1, nullable: true },
          notes: { type: "string", nullable: true },
          active: { type: "boolean" },
        },
      },
      ConsumeProductRequest: {
        type: "object",
        required: ["quantity"],
        properties: {
          quantity: { type: "number", exclusiveMinimum: 0 },
          note: { type: "string", nullable: true },
        },
      },
      IntakeItem: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          productId: { type: "string", format: "uuid", nullable: true },
          name: { type: "string", example: "Arroz" },
          quantity: { type: "number", example: 2 },
          unit: { type: "string", enum: UNITS },
          category: { type: "string", enum: CATEGORIES, nullable: true },
          unitPrice: { type: "number", nullable: true },
          confidence: { type: "number", nullable: true },
          matchedExisting: { type: "boolean" },
          excluded: { type: "boolean" },
          sortOrder: { type: "integer" },
        },
      },
      Intake: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          source: { type: "string", example: "natural_language" },
          status: { type: "string", enum: ["draft", "confirmed", "cancelled"] },
          rawInput: { type: "string", nullable: true },
          storeName: { type: "string", nullable: true },
          parser: { type: "string", nullable: true, example: "heuristic" },
          confirmedAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/IntakeItem" },
          },
        },
      },
      ParseTextRequest: {
        type: "object",
        required: ["text"],
        properties: {
          text: {
            type: "string",
            minLength: 3,
            maxLength: 4000,
            example: "2kg arroz, 1 leite, 500g feijão",
          },
        },
      },
      UpdateIntakeRequest: {
        type: "object",
        required: ["items"],
        properties: {
          storeName: { type: "string", nullable: true },
          items: {
            type: "array",
            minItems: 1,
            items: { $ref: "#/components/schemas/IntakeItem" },
          },
        },
      },
      ConfirmIntakeRequest: {
        type: "object",
        required: ["items"],
        properties: {
          storeName: { type: "string", nullable: true },
          purchasedAt: { type: "string", format: "date-time", nullable: true },
          items: {
            type: "array",
            minItems: 1,
            items: { $ref: "#/components/schemas/IntakeItem" },
          },
        },
      },
      Notification: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          type: {
            type: "string",
            enum: [
              "low_stock",
              "out_of_stock",
              "repurchase_reminder",
              "consumption_nudge",
              "missing_consumption",
              "intake_ready",
              "system",
            ],
          },
          title: { type: "string" },
          body: { type: "string" },
          productId: { type: "string", format: "uuid", nullable: true },
          payload: { type: "object" },
          readAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          unread: { type: "boolean" },
        },
      },
    },
    responses: {
      BadRequest: {
        description: "Requisição inválida",
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/Error" } },
        },
      },
      Unauthorized: {
        description: "Token ausente, inválido ou credenciais incorretas",
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/Error" } },
        },
      },
      NotFound: {
        description: "Recurso não encontrado",
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/Error" } },
        },
      },
      Conflict: {
        description: "Conflito (ex.: e-mail já cadastrado)",
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/Error" } },
        },
      },
    },
  },
};
