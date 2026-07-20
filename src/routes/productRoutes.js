const { Router } = require("express");
const ProductController = require("../controllers/ProductController");
const validateSchema = require("../middlewares/validateSchema");
const validateAuthentication = require("../middlewares/validateAuthentication");
const asyncHandler = require("../utils/asyncHandler");
const {
  createProductSchema,
  updateProductSchema,
  consumeProductSchema,
  listProductsSchema,
} = require("../schemas/productSchemas");

const router = Router();

router.use(validateAuthentication);

router.get("/", validateSchema(listProductsSchema, "query"), asyncHandler(ProductController.list));
router.post("/", validateSchema(createProductSchema), asyncHandler(ProductController.create));
router.get("/:id", asyncHandler(ProductController.get));
router.patch("/:id", validateSchema(updateProductSchema), asyncHandler(ProductController.update));
router.post(
  "/:id/consume",
  validateSchema(consumeProductSchema),
  asyncHandler(ProductController.consume),
);
router.post("/:id/mark-out", asyncHandler(ProductController.markOut));

module.exports = router;
