require("dotenv").config();

const express = require("express");
const cors = require("cors");
const {
  connectMongo,
  ensureMongoCollections,
} = require("./config/mongoClient");

const homeController = require("./controllers/homeController");
const placesController = require("./controllers/placesController");
const routeController = require("./controllers/routeController");
const shoppingController = require("./controllers/shoppingController");
const agentCompareController = require("./controllers/agentCompareController");
const authController = require("./controllers/authController");
const historyController = require("./controllers/historyController");
const {
  optionalAuth,
  requireAuth,
} = require("./middleware/authMiddleware");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/", homeController.index);
app.get("/search", placesController.search);
app.get("/reverse-geocode", placesController.reverseGeocode);
app.get("/route", routeController.getRoute);
app.get("/shop-search", shoppingController.search);
app.get("/agent-search", optionalAuth, agentCompareController.search);
app.post("/auth/register", authController.register);
app.post("/auth/login", authController.login);
app.get("/history", requireAuth, historyController.list);
app.get("/history/:id", requireAuth, historyController.getById);

app.use((req, res) => {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.path}`,
  });
});

app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  res.status(500).json({
    error: "Internal server error.",
  });
});

async function startServer() {
  try {
    await connectMongo();
    await ensureMongoCollections();

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
