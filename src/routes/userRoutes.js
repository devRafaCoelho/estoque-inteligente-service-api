const { Router } = require("express");
const UserController = require("../controllers/UserController");
const validateSchema = require("../middlewares/validateSchema");
const validateAuthentication = require("../middlewares/validateAuthentication");
const asyncHandler = require("../utils/asyncHandler");
const { updateMeSchema, changePasswordSchema } = require("../schemas/userSchemas");

const router = Router();

router.use(validateAuthentication);

router.patch("/me", validateSchema(updateMeSchema), asyncHandler(UserController.updateMe));
router.post(
  "/me/password",
  validateSchema(changePasswordSchema),
  asyncHandler(UserController.changePassword),
);
router.delete("/me", asyncHandler(UserController.deleteAccount));

module.exports = router;
