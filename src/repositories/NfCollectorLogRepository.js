const db = require("../config/db");

const NfCollectorLogRepository = {
  async create(
    {
      userId = null,
      intakeId = null,
      stateCode = null,
      accessKey = null,
      sourceUrl = null,
      success,
      errorMessage = null,
      metadata = {},
    },
    client = db,
  ) {
    const { rows } = await client.query(
      `INSERT INTO nf_collector_logs
         (user_id, intake_id, state_code, access_key, source_url, success, error_message, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       RETURNING *`,
      [
        userId,
        intakeId,
        stateCode ? String(stateCode).toUpperCase().slice(0, 2) : null,
        accessKey ? String(accessKey).slice(0, 44) : null,
        sourceUrl,
        Boolean(success),
        errorMessage ? String(errorMessage).slice(0, 2000) : null,
        JSON.stringify(metadata || {}),
      ],
    );
    return rows[0] || null;
  },

  async countByState(days = 7, client = db) {
    const { rows } = await client.query(
      `SELECT state_code,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE success)::int AS successes,
              COUNT(*) FILTER (WHERE NOT success)::int AS failures
       FROM nf_collector_logs
       WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
         AND state_code IS NOT NULL
       GROUP BY state_code
       ORDER BY total DESC`,
      [days],
    );
    return rows;
  },
};

module.exports = NfCollectorLogRepository;
