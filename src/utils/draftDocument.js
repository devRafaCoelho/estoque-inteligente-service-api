const AppError = require("./AppError");

/**
 * Garante que o documento (intake / stock-out) existe e está em draft.
 * @param {object|null} doc
 * @param {string} notFoundMessage
 * @param {string} [notDraftMessage]
 */
function assertDraftDocument(
  doc,
  notFoundMessage,
  notDraftMessage = "Só é possível editar rascunhos",
) {
  if (!doc) throw new AppError(notFoundMessage, 404);
  if (doc.status !== "draft") throw new AppError(notDraftMessage, 400);
  return doc;
}

module.exports = { assertDraftDocument };
