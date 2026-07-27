const { Router } = require("express");
const StockOutController = require("../controllers/StockOutController");
const validateSchema = require("../middlewares/validateSchema");
const validateAuthentication = require("../middlewares/validateAuthentication");
const asyncHandler = require("../utils/asyncHandler");
const {
  parseConsumeTextSchema,
  updateStockOutSchema,
  confirmStockOutSchema,
} = require("../schemas/stockOutSchemas");

const router = Router();

router.use(validateAuthentication);

router.get("/", asyncHandler(StockOutController.list));
router.post("/clear-drafts", asyncHandler(StockOutController.clearDrafts));
router.post(
  "/parse-text",
  validateSchema(parseConsumeTextSchema),
  asyncHandler(StockOutController.parseText),
);
router.get("/:id", asyncHandler(StockOutController.get));
router.patch(
  "/:id",
  validateSchema(updateStockOutSchema),
  asyncHandler(StockOutController.update),
);
router.post(
  "/:id/confirm",
  validateSchema(confirmStockOutSchema),
  asyncHandler(StockOutController.confirm),
);
router.post("/:id/cancel", asyncHandler(StockOutController.cancel));

module.exports = router;
