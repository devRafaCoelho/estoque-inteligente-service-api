const { Router } = require("express");
const ShoppingListShareController = require("../controllers/ShoppingListShareController");
const validateAuthentication = require("../middlewares/validateAuthentication");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

// Rota pública — leitura da lista via token
router.get(
  "/public/:token",
  asyncHandler(ShoppingListShareController.getSharedList),
);

// Rotas autenticadas
router.use(validateAuthentication);

router.get("/", asyncHandler(ShoppingListShareController.listShares));
router.post("/", asyncHandler(ShoppingListShareController.createShare));
router.delete("/:shareId", asyncHandler(ShoppingListShareController.revokeShare));

module.exports = router;
