const AiRateLimitService = require("../services/AiRateLimitService");

/**
 * Rate limit diário de IA (parse ou chat).
 * Deve rodar após `validateAuthentication`.
 *
 * @param {"parse"|"chat"} kind
 */
function aiRateLimit(kind) {
  return (req, res, next) => {
    try {
      const usage = AiRateLimitService.consume(req.user.id, kind);
      if (usage.remaining != null) {
        res.setHeader("X-RateLimit-Limit", String(usage.limit));
        res.setHeader("X-RateLimit-Remaining", String(usage.remaining));
        res.setHeader("X-RateLimit-Kind", kind);
      }
      return next();
    } catch (err) {
      if (err?.statusCode === 429 && err.details?.limit != null) {
        res.setHeader("X-RateLimit-Limit", String(err.details.limit));
        res.setHeader("X-RateLimit-Remaining", "0");
        res.setHeader("Retry-After", String(60 * 60));
      }
      return next(err);
    }
  };
}

module.exports = aiRateLimit;
