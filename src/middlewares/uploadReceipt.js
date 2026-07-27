const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const AppError = require("../utils/AppError");
const {
  receiptsDirForUser,
  relativeReceiptPath,
  uploadMaxBytes,
} = require("../config/storage");

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

const EXT_BY_MIME = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

function extensionFor(file) {
  const fromMime = EXT_BY_MIME[file.mimetype];
  if (fromMime) return fromMime;
  const ext = path.extname(file.originalname || "").toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
    return ext === ".jpeg" ? ".jpg" : ext;
  }
  return ".jpg";
}

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    try {
      if (!req.user?.id) {
        return cb(new AppError("Não autenticado", 401));
      }
      cb(null, receiptsDirForUser(req.user.id));
    } catch (err) {
      cb(err);
    }
  },
  filename(req, file, cb) {
    const name = `${crypto.randomUUID()}${extensionFor(file)}`;
    req.receiptRelativePath = relativeReceiptPath(req.user.id, name);
    cb(null, name);
  },
});

function fileFilter(_req, file, cb) {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(new AppError("Use imagem JPG, PNG ou WebP", 400));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: uploadMaxBytes, files: 1 },
});

/**
 * Aceita um arquivo no campo `image` (multipart/form-data).
 * Grava em uploads/receipts/{userId}/{uuid}.ext e preenche `req.file`
 * + `req.receiptRelativePath`.
 */
function uploadReceiptImage(req, res, next) {
  upload.single("image")(req, res, (err) => {
    if (!err) return next();

    if (err instanceof AppError) return next(err);

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(
          new AppError(
            `Imagem muito grande (máximo ${Math.round(uploadMaxBytes / (1024 * 1024))} MB)`,
            413,
          ),
        );
      }
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return next(new AppError("Campo de arquivo deve se chamar image", 400));
      }
      return next(new AppError(err.message || "Falha no upload", 400));
    }

    return next(err);
  });
}

module.exports = uploadReceiptImage;
