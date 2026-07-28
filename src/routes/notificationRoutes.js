const { Router } = require("express");
const NotificationController = require("../controllers/NotificationController");
const validateSchema = require("../middlewares/validateSchema");
const validateAuthentication = require("../middlewares/validateAuthentication");
const asyncHandler = require("../utils/asyncHandler");
const {
  listNotificationsSchema,
  pushSubscriptionSchema,
  deletePushSubscriptionSchema,
} = require("../schemas/notificationSchemas");

const router = Router();

router.use(validateAuthentication);

router.get(
  "/",
  validateSchema(listNotificationsSchema, "query"),
  asyncHandler(NotificationController.list),
);
router.get("/push/config", asyncHandler(NotificationController.pushConfig));
router.post(
  "/push/subscribe",
  validateSchema(pushSubscriptionSchema),
  asyncHandler(NotificationController.subscribe),
);
router.post(
  "/push/unsubscribe",
  validateSchema(deletePushSubscriptionSchema),
  asyncHandler(NotificationController.unsubscribe),
);
router.get("/unread-count", asyncHandler(NotificationController.unreadCount));
router.post("/read-all", asyncHandler(NotificationController.markAllRead));
router.post("/:id/read", asyncHandler(NotificationController.markRead));

module.exports = router;
