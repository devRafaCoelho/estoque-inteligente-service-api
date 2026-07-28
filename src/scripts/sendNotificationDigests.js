require("dotenv").config();

const db = require("../config/db");
const NotificationDigestService = require("../services/NotificationDigestService");

async function main() {
  const { rows } = await db.query(
    `SELECT user_id
     FROM user_preferences
     WHERE notify_email_digest = TRUE`,
  );

  let sent = 0;
  for (const row of rows) {
    const result = await NotificationDigestService.sendDigestForUser(row.user_id);
    if (result.sent) sent += 1;
  }

  console.log(`Digests enviados: ${sent}/${rows.length}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Falha ao enviar digests:", err);
  process.exit(1);
});
