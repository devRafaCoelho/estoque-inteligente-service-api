const { Router } = require("express");
const CatalogController = require("../controllers/CatalogController");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

/** Público — usado em formulários antes e depois do login */
router.get("/", asyncHandler(CatalogController.listUnits));

module.exports = router;
