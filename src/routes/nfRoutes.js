const { Router } = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { getCoverage } = require("../services/nf/NfCollectorFactory");
const NfCollectorLogRepository = require("../repositories/NfCollectorLogRepository");
const validateAuthentication = require("../middlewares/validateAuthentication");

const router = Router();

/**
 * Cobertura pública de UFs no QR NF-e (F3-5.3 / F3-5.5 client).
 * GET /api/nf/coverage
 */
router.get(
  "/coverage",
  asyncHandler(async (_req, res) => {
    return res.status(200).json(getCoverage());
  }),
);

/**
 * Resumo operacional de tentativas recentes (auth).
 * GET /api/nf/collector-stats?days=7
 */
router.get(
  "/collector-stats",
  validateAuthentication,
  asyncHandler(async (req, res) => {
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 7));
    const byState = await NfCollectorLogRepository.countByState(days);
    return res.status(200).json({ days, byState });
  }),
);

module.exports = router;
