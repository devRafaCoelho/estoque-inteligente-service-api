const { Router } = require("express");
const FinanceController = require("../controllers/FinanceController");
const validateAuthentication = require("../middlewares/validateAuthentication");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

router.use(validateAuthentication);

router.get("/summary", asyncHandler(FinanceController.getSummary));
router.get("/by-category", asyncHandler(FinanceController.getByCategory));
router.get("/series", asyncHandler(FinanceController.getSeries));
router.get("/tips", asyncHandler(FinanceController.getTips));

module.exports = router;
