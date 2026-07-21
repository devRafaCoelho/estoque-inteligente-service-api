const { Router } = require("express");
const DashboardController = require("../controllers/DashboardController");
const validateAuthentication = require("../middlewares/validateAuthentication");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

router.use(validateAuthentication);

router.get("/stats", asyncHandler(DashboardController.getStats));

module.exports = router;
