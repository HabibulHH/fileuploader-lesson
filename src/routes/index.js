const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({ message: "Welcome to PocketSchool Phase 2!" });
});

module.exports = router;
