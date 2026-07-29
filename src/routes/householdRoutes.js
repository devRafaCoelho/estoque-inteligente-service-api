const { Router } = require("express");
const HouseholdController = require("../controllers/HouseholdController");
const validateAuthentication = require("../middlewares/validateAuthentication");
const validateSchema = require("../middlewares/validateSchema");
const asyncHandler = require("../utils/asyncHandler");
const {
  createHouseholdSchema,
  inviteHouseholdSchema,
  acceptHouseholdInviteSchema,
} = require("../schemas/householdSchemas");

const router = Router();

router.use(validateAuthentication);

router.post(
  "/",
  validateSchema(createHouseholdSchema),
  asyncHandler(HouseholdController.create),
);
router.get("/me", asyncHandler(HouseholdController.getMine));
router.post(
  "/invites/accept",
  validateSchema(acceptHouseholdInviteSchema),
  asyncHandler(HouseholdController.acceptInvite),
);
router.get("/:id/members", asyncHandler(HouseholdController.listMembers));
router.get("/:id/invites", asyncHandler(HouseholdController.listInvites));
router.post(
  "/:id/invites",
  validateSchema(inviteHouseholdSchema),
  asyncHandler(HouseholdController.invite),
);
router.delete(
  "/:id/invites/:inviteId",
  asyncHandler(HouseholdController.revokeInvite),
);
router.delete(
  "/:id/members/:userId",
  asyncHandler(HouseholdController.removeMember),
);
router.post("/:id/leave", asyncHandler(HouseholdController.leave));

module.exports = router;
