const path = require("path");

const ALLOWED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",

]);

const ALLOWED_MIMETYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function fileTypeValidator(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();

  if (ALLOWED_EXTENSIONS.has(ext) && ALLOWED_MIMETYPES.has(file.mimetype)) {
    return cb(null, true);
  }

  cb(new Error(`File type not allowed: ${ext} (${file.mimetype})`));
}

module.exports = fileTypeValidator;
