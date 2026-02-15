const express = require("express");
const multer = require("multer");
const path = require("path");
const fileTypeValidator = require("../middleware/fileTypeValidator");
const { enqueue } = require("../services/uploadQueue");
const { uploadRateLimit, duplicateFileLimit } = require("../middleware/rate-limit");

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, "../../public/uploads"),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileTypeValidator,
});

// Handle multer errors
function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: "Invalid file upload request" });
  }
  next();
}

// Single file upload
router.post("/single", upload.single("file"), handleMulterError, uploadRateLimit, duplicateFileLimit, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  enqueue({
    filePath: req.file.path,
    filename: req.file.filename,
    mimetype: req.file.mimetype,
  });

  res.json({
    message: "File uploaded successfully",
    file: {
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      url: `/uploads/${req.file.filename}`,
    },
  });
});

// Multiple files upload (up to 5)
router.post("/multiple", upload.array("files", 5), handleMulterError, uploadRateLimit, duplicateFileLimit, (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No files uploaded" });
  }

  const files = req.files.map((file) => ({
    filename: file.filename,
    originalname: file.originalname,
    size: file.size,
    mimetype: file.mimetype,
    url: `/uploads/${file.filename}`,
  }));

  req.files.forEach((file) => {
    enqueue({
      filePath: file.path,
      filename: file.filename,
      mimetype: file.mimetype,
    });
  });

  res.json({
    message: `${files.length} file(s) uploaded successfully`,
    files,
  });
});

module.exports = router;
