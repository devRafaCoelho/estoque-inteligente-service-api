const { Router } = require("express");
const AuthController = require("../controllers/AuthController");
const validateSchema = require("../middlewares/validateSchema");
const validateAuthentication = require("../middlewares/validateAuthentication");
const asyncHandler = require("../utils/asyncHandler");
const { registerSchema, loginSchema } = require("../schemas/authSchemas");

const router = Router();

router.post("/register", validateSchema(registerSchema), asyncHandler(AuthController.register));
router.post("/login", validateSchema(loginSchema), asyncHandler(AuthController.login));
router.get("/me", validateAuthentication, asyncHandler(AuthController.me));

module.exports = router;
