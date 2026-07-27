const db = require("../config/db");
const fs = require("fs");
const AppError = require("../utils/AppError");
const { relativeReceiptPath, absoluteFromRelative } = require("../config/storage");
const AiParseService = require("./AiParseService");
const ProductMatcherService = require("./ProductMatcherService");
const ProductRepository = require("../repositories/ProductRepository");
const StockIntakeRepository = require("../repositories/StockIntakeRepository");
const StockIntakeItemRepository = require("../repositories/StockIntakeItemRepository");
const { IntakeDetailDto, IntakeSummaryDto } = require("../dto/v1/intakeDto");
const { assertDraftDocument } = require("../utils/draftDocument");
const { productHintsFrom } = require("../utils/productHints");
const { parseNfQrInput } = require("./nf/NfUrlParser");
const { collectNfItems } = require("./nf/NfCollectorFactory");
const logger = require("../utils/logger");

async function loadDetail(userId, intakeId, client = db) {
  const intake = await StockIntakeRepository.findById(userId, intakeId, client);
  if (!intake) throw new AppError("Entrada não encontrada", 404);
  const items = await StockIntakeItemRepository.listByIntake(intakeId, client);
  return IntakeDetailDto(intake, items);
}

function safeUnlink(absolutePath) {
  if (!absolutePath) return;
  try {
    if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
  } catch (err) {
    logger.warn("Falha ao remover arquivo de cupom", { message: err.message });
  }
}

const IntakeService = {
  async list(userId, query = {}) {
    const status = query.status || "draft";
    if (!["draft", "confirmed", "cancelled"].includes(status)) {
      throw new AppError("Status inválido", 400);
    }
    const rows = await StockIntakeRepository.listByUser(userId, {
      status,
      limit: query.limit,
    });
    return rows.map(IntakeSummaryDto);
  },

  async parseNaturalLanguage(userId, text) {
    const products = await ProductRepository.list(userId, { active: true });
    const productHints = productHintsFrom(products);

    const parsed = await AiParseService.parseIntake(text, { productHints });

    return db.withTransaction(async (client) => {
      const matched = await ProductMatcherService.matchItems(userId, parsed.items, client);

      const intake = await StockIntakeRepository.create(
        {
          userId,
          source: "natural_language",
          status: "draft",
          rawInput: text,
          rawPayload: {
            parser: parsed.parser || "heuristic",
            action: parsed.action,
            modelItems: parsed.items,
            aiConfigured: AiParseService.isConfigured(),
          },
        },
        client,
      );

      const items = await StockIntakeItemRepository.createMany(intake.id, matched, client);
      return IntakeDetailDto(intake, items);
    });
  },

  /**
   * Foto do cupom → visão/LLM (mesmo schema do parse de texto) → draft com itens.
   *
   * @param {string} userId
   * @param {Express.Multer.File | undefined} file
   * @param {string | null} [relativeMediaPath]
   */
  async parseReceiptPhoto(userId, file, relativeMediaPath = null) {
    if (!file) {
      throw new AppError("Envie uma imagem no campo image (JPG, PNG ou WebP)", 400);
    }

    const mediaUrl =
      relativeMediaPath ||
      (file.filename ? relativeReceiptPath(userId, file.filename) : null);
    if (!mediaUrl) {
      throw new AppError("Falha ao gravar a imagem do cupom", 500);
    }

    const absolutePath = file.path || absoluteFromRelative(mediaUrl);
    const products = await ProductRepository.list(userId, { active: true });
    const productHints = productHintsFrom(products);

    let parsed;
    try {
      parsed = await AiParseService.parseIntakeFromImage({
        absolutePath,
        mimeType: file.mimetype || "image/jpeg",
        productHints,
      });
    } catch (err) {
      safeUnlink(absolutePath);
      throw err;
    }

    try {
      return await db.withTransaction(async (client) => {
        const matched = await ProductMatcherService.matchItems(userId, parsed.items, client);

        const intake = await StockIntakeRepository.create(
          {
            userId,
            source: "receipt_photo",
            status: "draft",
            rawInput: file.originalname || null,
            mediaUrl,
            rawPayload: {
              parser: parsed.parser || "vision",
              action: parsed.action,
              storeName: parsed.storeName || null,
              modelItems: parsed.items,
              mimeType: file.mimetype,
              originalName: file.originalname || null,
              sizeBytes: file.size,
              storedFilename: file.filename,
              aiConfigured: true,
            },
          },
          client,
        );

        const items = await StockIntakeItemRepository.createMany(intake.id, matched, client);
        return IntakeDetailDto(intake, items);
      });
    } catch (err) {
      safeUnlink(absolutePath);
      throw err;
    }
  },

  /**
   * QR / chave NF-e → collector UF → draft `nf_qr` com itens.
   *
   * @param {string} userId
   * @param {{ qrContent?: string, accessKey?: string, stateCode?: string }} body
   */
  async parseNfQr(userId, body = {}) {
    const parsedInput = parseNfQrInput(body);
    if (!parsedInput.ok) {
      const messages = {
        empty: "Envie a URL do QR ou a chave de acesso",
        notFound: "Não encontrei a chave de 44 dígitos",
        length: "A chave de acesso precisa ter 44 dígitos",
        checkDigit: "Chave inválida (dígito verificador não confere)",
        state: "UF da chave não é reconhecida",
        model: "Só aceitamos NF-e (55) ou NFC-e (65)",
      };
      throw new AppError(messages[parsedInput.reason] || "Payload NF-e inválido", 400, {
        code: "nf_invalid_payload",
        reason: parsedInput.reason,
      });
    }

    let collected;
    try {
      collected = await collectNfItems({
        accessKey: parsedInput.accessKey,
        stateCode: parsedInput.stateCode,
        qrContent: parsedInput.qrContent,
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.warn("Collector NF-e falhou", { message: err.message });
      throw new AppError(
        "Não consegui ler a nota agora. Tente a foto do cupom.",
        502,
        { cause: err.message, code: "nf_collector_failed" },
      );
    }

    const modelItems = (collected.items || []).map((item, index) => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit || "un",
      category: item.category || "other",
      unitPrice: item.unitPrice ?? null,
      confidence: 0.9,
      sortOrder: item.sortOrder ?? index,
    }));

    if (!modelItems.length) {
      throw new AppError(
        "A nota não retornou itens. Use a foto do cupom.",
        422,
        { code: "nf_empty_items" },
      );
    }

    return db.withTransaction(async (client) => {
      const matched = await ProductMatcherService.matchItems(userId, modelItems, client);

      const intake = await StockIntakeRepository.create(
        {
          userId,
          source: "nf_qr",
          status: "draft",
          rawInput: parsedInput.qrContent || parsedInput.accessKey,
          stateCode: parsedInput.stateCode,
          accessKey: parsedInput.accessKey,
          rawPayload: {
            parser: "nf_collector",
            collector: collected.collector || parsedInput.stateCode,
            action: "add",
            storeName: collected.storeName || null,
            accessKey: parsedInput.accessKey,
            stateCode: parsedInput.stateCode,
            model: parsedInput.model,
            consultaUrl: collected.consultaUrl || null,
            modelItems,
          },
        },
        client,
      );

      const items = await StockIntakeItemRepository.createMany(intake.id, matched, client);
      return IntakeDetailDto(intake, items);
    });
  },

  async get(userId, intakeId) {
    return loadDetail(userId, intakeId);
  },

  async update(userId, intakeId, body) {
    const intake = await StockIntakeRepository.findById(userId, intakeId);
    assertDraftDocument(
      intake,
      "Entrada não encontrada",
      "Só é possível editar entradas em rascunho",
    );

    return db.withTransaction(async (client) => {
      const rawPayload = {
        ...(intake.raw_payload || {}),
        storeName: body.storeName || null,
      };
      await StockIntakeRepository.updateRawPayload(userId, intakeId, rawPayload, client);

      const items = await StockIntakeItemRepository.replaceAll(
        intakeId,
        body.items.map((item, index) => ({
          productId: item.productId || null,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          category: item.category || "other",
          unitPrice: item.unitPrice ?? null,
          confidence: item.confidence ?? null,
          matchedExisting: Boolean(item.productId || item.matchedExisting),
          excluded: Boolean(item.excluded),
          sortOrder: item.sortOrder ?? index,
        })),
        client,
      );

      const updated = await StockIntakeRepository.findById(userId, intakeId, client);
      return IntakeDetailDto(updated, items);
    });
  },

  async cancel(userId, intakeId) {
    const intake = await StockIntakeRepository.findById(userId, intakeId);
    assertDraftDocument(
      intake,
      "Entrada não encontrada",
      "Só é possível cancelar entradas em rascunho",
    );
    const cancelled = await StockIntakeRepository.updateStatus(userId, intakeId, "cancelled");
    const items = await StockIntakeItemRepository.listByIntake(intakeId);
    return IntakeDetailDto(cancelled, items);
  },

  async clearDrafts(userId) {
    const cleared = await StockIntakeRepository.cancelAllByStatus(userId, "draft");
    return { cleared };
  },
};

module.exports = IntakeService;
