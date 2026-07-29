const crypto = require("node:crypto");
const db = require("../config/db");
const AppError = require("../utils/AppError");
const ShoppingListRepository = require("../repositories/ShoppingListRepository");
const ShoppingListItemRepository = require("../repositories/ShoppingListItemRepository");
const ShoppingListShareRepository = require("../repositories/ShoppingListShareRepository");
const ProductRepository = require("../repositories/ProductRepository");
const { ShoppingListDto } = require("../dto/v1/shoppingListDto");
const { estimateShoppingListSpend } = require("../utils/shoppingListSpend");

/** TTL padrão: 7 dias */
const SHARE_TTL_DAYS = 7;
const SHARE_TOKEN_BYTES = 32;

function hashToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function generateToken() {
  return crypto.randomBytes(SHARE_TOKEN_BYTES).toString("hex");
}

function expiresAt(days = SHARE_TTL_DAYS) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function resolveValidShare(rawToken) {
  if (!rawToken || typeof rawToken !== "string" || rawToken.length < 8) {
    throw new AppError("Token inválido", 404);
  }

  const tokenHash = hashToken(rawToken);
  const share = await ShoppingListShareRepository.findValidByHash(tokenHash);
  if (!share) throw new AppError("Link inválido, expirado ou revogado", 404);

  const list = await ShoppingListRepository.findById(share.list_id);
  if (!list) throw new AppError("Lista não encontrada", 404);
  if (list.status !== "active") {
    throw new AppError("Esta lista não está mais ativa", 410);
  }

  return { share, list };
}

async function buildSharedListDto(share, list) {
  const items = await ShoppingListItemRepository.listByList(list.id);

  const productIds = [...new Set(items.map((i) => i.product_id).filter(Boolean))];
  const productsById = new Map();
  if (productIds.length) {
    const allProducts = await ProductRepository.list(share.user_id, {});
    for (const p of allProducts) {
      if (productIds.includes(p.id)) productsById.set(p.id, p);
    }
  }

  const spendEstimate = estimateShoppingListSpend(items, productsById, {
    onlyPending: true,
  });

  const viewMode = list.view_mode || "paper";
  return ShoppingListDto(list, items, viewMode, spendEstimate);
}

const ShoppingListShareService = {
  /**
   * Cria um link compartilhável para a lista ativa do usuário.
   * Retorna o token raw (só aqui) e os metadados do share.
   */
  async createShare(userId) {
    const list = await ShoppingListRepository.findActive(userId);
    if (!list) throw new AppError("Nenhuma lista ativa para compartilhar", 404);

    const raw = generateToken();
    const tokenHash = hashToken(raw);
    const exp = expiresAt();

    const share = await ShoppingListShareRepository.create(
      { listId: list.id, userId, tokenHash, expiresAt: exp },
    );

    return {
      shareId: share.id,
      token: raw,
      expiresAt: share.expires_at,
      listId: list.id,
    };
  },

  /**
   * Revoga um share específico do usuário.
   * 404 se não encontrar ou já revogado.
   */
  async revokeShare(userId, shareId) {
    const revoked = await ShoppingListShareRepository.revoke(userId, shareId);
    if (!revoked) throw new AppError("Compartilhamento não encontrado ou já revogado", 404);
    return { revoked: true, shareId };
  },

  /**
   * Lê a lista via token público (sem autenticação).
   * 404 se token inválido/expirado/revogado.
   * 410 se a lista não estiver mais ativa (status != active).
   */
  async getSharedList(rawToken) {
    const { share, list } = await resolveValidShare(rawToken);
    return buildSharedListDto(share, list);
  },

  /**
   * Marca/desmarca item via token público (somente checked).
   */
  async updateSharedItem(rawToken, itemId, { checked } = {}) {
    if (typeof checked !== "boolean") {
      throw new AppError("Informe checked (boolean)", 422);
    }
    const { share, list } = await resolveValidShare(rawToken);
    const item = await ShoppingListItemRepository.findByIdInList(list.id, itemId);
    if (!item) throw new AppError("Item não encontrado nesta lista", 404);

    const updated = await ShoppingListItemRepository.update(itemId, { checked });
    const dto = await buildSharedListDto(share, list);
    return { list: dto, item: dto.items.find((row) => row.id === updated?.id) || null };
  },

  /** Lista shares ativos da lista ativa do usuário. */
  async listShares(userId) {
    const list = await ShoppingListRepository.findActive(userId);
    if (!list) return { shares: [] };
    const rows = await ShoppingListShareRepository.listActiveByUser(userId, list.id);
    return {
      shares: rows.map((row) => ({
        shareId: row.id,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
      })),
    };
  },
};

module.exports = ShoppingListShareService;
