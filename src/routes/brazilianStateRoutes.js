const { Router } = require("express");
const CatalogController = require("../controllers/CatalogController");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

/** Público — necessário no cadastro (UF) antes do login */
router.get("/", asyncHandler(CatalogController.listStates));

module.exports = router;
