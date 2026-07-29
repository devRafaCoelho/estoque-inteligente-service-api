const { Router } = require("express");
const Joi = require("joi");
const ShoppingListShareController = require("../controllers/ShoppingListShareController");
const validateAuthentication = require("../middlewares/validateAuthentication");
const validateSchema = require("../middlewares/validateSchema");
const asyncHandler = require("../utils/asyncHandler");

const updateSharedItemSchema = Joi.object({
  checked: Joi.boolean().required(),
});

const router = Router();

// Rotas públicas — leitura e marcação de itens via token
router.get(
  "/public/:token",
  asyncHandler(ShoppingListShareController.getSharedList),
);
router.patch(
  "/public/:token/items/:itemId",
  validateSchema(updateSharedItemSchema),
  asyncHandler(ShoppingListShareController.updateSharedItem),
);

// Rotas autenticadas
router.use(validateAuthentication);

router.get("/", asyncHandler(ShoppingListShareController.listShares));
router.post("/", asyncHandler(ShoppingListShareController.createShare));
router.delete("/:shareId", asyncHandler(ShoppingListShareController.revokeShare));

module.exports = router;
