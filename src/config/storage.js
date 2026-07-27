const fs = require("fs");
const path = require("path");
const env = require("./env");

const uploadRoot = path.isAbsolute(env.UPLOAD_DIR)
  ? env.UPLOAD_DIR
  : path.join(process.cwd(), env.UPLOAD_DIR);

const receiptsDir = path.join(uploadRoot, "receipts");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function receiptsDirForUser(userId) {
  const dir = path.join(receiptsDir, String(userId));
  ensureDir(dir);
  return dir;
}

/** Caminho relativo ao UPLOAD_DIR, para gravar em media_url. */
function relativeReceiptPath(userId, filename) {
  return path.posix.join("receipts", String(userId), filename);
}

function absoluteFromRelative(relativePath) {
  return path.join(uploadRoot, relativePath);
}

module.exports = {
  uploadRoot,
  receiptsDir,
  uploadMaxBytes: env.UPLOAD_MAX_MB * 1024 * 1024,
  ensureDir,
  receiptsDirForUser,
  relativeReceiptPath,
  absoluteFromRelative,
};
