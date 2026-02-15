const rateLimit = require("express-rate-limit");

// General upload rate limit: max 2 uploads per IP per minute
const uploadRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 2,
  message: { error: "Too many uploads. Max 2 per minute." },
});

// Per-file duplicate check: reject if same IP uploads same filename twice in 1 min
const recentUploads = new Map(); // "ip:filename" -> timestamp

function duplicateFileLimit(req, res, next) {
  const ip = req.ip;
  const files = req.file ? [req.file] : req.files || [];
  const now = Date.now();
  const WINDOW_MS = 60 * 1000;

  // Cleanup expired entries
  for (const [key, ts] of recentUploads) {
    if (now - ts >= WINDOW_MS) recentUploads.delete(key);
  }

  for (const file of files) {
    const key = `${ip}:${file.originalname}`;
    if (recentUploads.has(key)) {
      return res.status(429).json({
        error: `"${file.originalname}" was already uploaded recently. Try again in a minute.`,
      });
    }
  }

  // Record uploads
  for (const file of files) {
    recentUploads.set(`${ip}:${file.originalname}`, now);
  }

  next();
}

module.exports = { uploadRateLimit, duplicateFileLimit };
