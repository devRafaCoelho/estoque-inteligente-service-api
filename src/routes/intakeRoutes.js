const { Router } = require("express");
const IntakeController = require("../controllers/IntakeController");
const validateSchema = require("../middlewares/validateSchema");
const validateAuthentication = require("../middlewares/validateAuthentication");
const asyncHandler = require("../utils/asyncHandler");
const aiRateLimit = require("../middlewares/aiRateLimit");
const uploadReceiptImage = require("../middlewares/uploadReceipt");
const {
  parseNaturalLanguageSchema,
  parseNfQrSchema,
  updateIntakeSchema,
  confirmIntakeSchema,
} = require("../schemas/intakeSchemas");

const router = Router();

router.use(validateAuthentication);

router.get("/", asyncHandler(IntakeController.list));
router.post("/clear-drafts", asyncHandler(IntakeController.clearDrafts));
router.post(
  "/parse-text",
  aiRateLimit("parse"),
  validateSchema(parseNaturalLanguageSchema),
  asyncHandler(IntakeController.parseText),
);
router.post(
  "/parse-image",
  aiRateLimit("parse"),
  uploadReceiptImage,
  asyncHandler(IntakeController.parseImage),
);
router.post(
  "/parse-nf-qr",
  validateSchema(parseNfQrSchema),
  asyncHandler(IntakeController.parseNfQr),
);
router.get("/:id", asyncHandler(IntakeController.get));
router.patch(
  "/:id",
  validateSchema(updateIntakeSchema),
  asyncHandler(IntakeController.update),
);
router.post(
  "/:id/confirm",
  validateSchema(confirmIntakeSchema),
  asyncHandler(IntakeController.confirm),
);
router.post("/:id/cancel", asyncHandler(IntakeController.cancel));

module.exports = router;
