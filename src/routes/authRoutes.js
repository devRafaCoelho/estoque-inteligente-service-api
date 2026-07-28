const { Router } = require("express");
const AuthController = require("../controllers/AuthController");
const validateSchema = require("../middlewares/validateSchema");
const validateAuthentication = require("../middlewares/validateAuthentication");
const asyncHandler = require("../utils/asyncHandler");
const {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  oauthTokenSchema,
} = require("../schemas/authSchemas");

const router = Router();

router.post("/register", validateSchema(registerSchema), asyncHandler(AuthController.register));
router.post("/login", validateSchema(loginSchema), asyncHandler(AuthController.login));
router.post(
  "/forgot-password",
  validateSchema(forgotPasswordSchema),
  asyncHandler(AuthController.forgotPassword),
);
router.post(
  "/reset-password",
  validateSchema(resetPasswordSchema),
  asyncHandler(AuthController.resetPassword),
);
router.post("/google", validateSchema(oauthTokenSchema), asyncHandler(AuthController.google));
router.post("/apple", validateSchema(oauthTokenSchema), asyncHandler(AuthController.apple));
router.get("/me", validateAuthentication, asyncHandler(AuthController.me));
router.post(
  "/link/google",
  validateAuthentication,
  validateSchema(oauthTokenSchema),
  asyncHandler(AuthController.linkGoogle),
);
router.post(
  "/link/apple",
  validateAuthentication,
  validateSchema(oauthTokenSchema),
  asyncHandler(AuthController.linkApple),
);

module.exports = router;
