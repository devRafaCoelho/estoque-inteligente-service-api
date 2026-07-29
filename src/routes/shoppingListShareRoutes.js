const { Router } = require("express");
const ShoppingListShareController = require("../controllers/ShoppingListShareController");
const validateAuthentication = require("../middlewares/validateAuthentication");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

// Público v1 — somente leitura (GET). Sem POST/PATCH públicos.
router.get(
  "/public/:token",
  asyncHandler(ShoppingListShareController.getSharedList),
);

// Rotas autenticadas (somente dono da lista)
router.use(validateAuthentication);

router.get("/", asyncHandler(ShoppingListShareController.listShares));
router.post("/", asyncHandler(ShoppingListShareController.createShare));
router.delete("/:shareId", asyncHandler(ShoppingListShareController.revokeShare));

module.exports = router;
