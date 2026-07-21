const { Router } = require("express");
const NotificationController = require("../controllers/NotificationController");
const validateSchema = require("../middlewares/validateSchema");
const validateAuthentication = require("../middlewares/validateAuthentication");
const asyncHandler = require("../utils/asyncHandler");
const { listNotificationsSchema } = require("../schemas/notificationSchemas");

const router = Router();

router.use(validateAuthentication);

router.get(
  "/",
  validateSchema(listNotificationsSchema, "query"),
  asyncHandler(NotificationController.list),
);
router.get("/unread-count", asyncHandler(NotificationController.unreadCount));
router.post("/read-all", asyncHandler(NotificationController.markAllRead));
router.post("/:id/read", asyncHandler(NotificationController.markRead));

module.exports = router;
