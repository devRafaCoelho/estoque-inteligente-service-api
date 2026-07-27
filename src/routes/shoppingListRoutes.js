const { Router } = require("express");
const ShoppingListController = require("../controllers/ShoppingListController");
const validateSchema = require("../middlewares/validateSchema");
const validateAuthentication = require("../middlewares/validateAuthentication");
const asyncHandler = require("../utils/asyncHandler");
const {
  generateShoppingListSchema,
  addShoppingItemSchema,
  updateShoppingItemSchema,
  updateViewModeSchema,
} = require("../schemas/shoppingListSchemas");

const router = Router();

router.use(validateAuthentication);

router.get("/active", asyncHandler(ShoppingListController.getActive));
router.get("/suggestions-preview", asyncHandler(ShoppingListController.previewSuggestions));
router.post(
  "/generate",
  validateSchema(generateShoppingListSchema),
  asyncHandler(ShoppingListController.generate),
);
router.patch(
  "/view-mode",
  validateSchema(updateViewModeSchema),
  asyncHandler(ShoppingListController.setViewMode),
);
router.post(
  "/items",
  validateSchema(addShoppingItemSchema),
  asyncHandler(ShoppingListController.addItem),
);
router.patch(
  "/items/:id",
  validateSchema(updateShoppingItemSchema),
  asyncHandler(ShoppingListController.updateItem),
);
router.delete("/items", asyncHandler(ShoppingListController.clearItems));
router.delete("/items/:id", asyncHandler(ShoppingListController.deleteItem));

module.exports = router;
