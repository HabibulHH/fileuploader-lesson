const express = require("express");
const path = require("path");
const routes = require("./routes");
const uploadRoutes = require("./routes/upload");

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, "../public")));

// Routes
app.use("/", routes);
app.use("/upload", uploadRoutes);

module.exports = app;
