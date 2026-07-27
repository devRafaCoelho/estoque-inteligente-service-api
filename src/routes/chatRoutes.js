const { Router } = require("express");
const ChatController = require("../controllers/ChatController");
const validateSchema = require("../middlewares/validateSchema");
const validateAuthentication = require("../middlewares/validateAuthentication");
const asyncHandler = require("../utils/asyncHandler");
const aiRateLimit = require("../middlewares/aiRateLimit");
const { postChatMessageSchema } = require("../schemas/chatSchemas");

const router = Router();

router.use(validateAuthentication);

router.get("/session", asyncHandler(ChatController.getSession));
router.post(
  "/messages",
  aiRateLimit("chat"),
  validateSchema(postChatMessageSchema),
  asyncHandler(ChatController.postMessage),
);

module.exports = router;
