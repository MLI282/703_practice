require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const {
  connectMongo,
  ensureMongoCollections,
} = require("./config/mongoClient");

const homeController = require("./controllers/homeController");
const placesController = require("./controllers/placesController");
const routeController = require("./controllers/routeController");
const shoppingController = require("./controllers/shoppingController");
const agentCompareController = require("./controllers/agentCompareController");
const advertisementController = require("./controllers/advertisementController");
const authController = require("./controllers/authController");
const historyController = require("./controllers/historyController");
const llmController = require("./controllers/llmController");
const {
  optionalAuth,
  requireAuth,
} = require("./middleware/authMiddleware");
const {
  coordinateQuerySchema,
  createRateLimiter,
  favoriteBodySchema,
  historyParamsSchema,
  loginBodySchema,
  protectVipActivation,
  registerBodySchema,
  routeQuerySchema,
  searchQuerySchema,
  securityHeaders,
  validate,
} = require("./middleware/securityMiddleware");
const { assertSecurityConfiguration } = require("./utils/auth");

const app = express();
const PORT = process.env.PORT || 3001;
const EXTERNAL_REQUEST_TIMEOUT_MS =
  Number(process.env.EXTERNAL_REQUEST_TIMEOUT_MS) || 10000;
const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

axios.defaults.timeout = EXTERNAL_REQUEST_TIMEOUT_MS;

if (process.env.TRUST_PROXY) {
  const trustProxy = /^\d+$/.test(process.env.TRUST_PROXY)
    ? Number(process.env.TRUST_PROXY)
    : process.env.TRUST_PROXY;

  app.set("trust proxy", trustProxy);
}

function getAllowedOrigins() {
  const configuredOrigins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return configuredOrigins.length ? configuredOrigins : DEFAULT_ALLOWED_ORIGINS;
}

const generalRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
});
const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many authentication attempts. Please try again later.",
});
const externalApiRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: "Too many search requests. Please try again shortly.",
});

app.disable("x-powered-by");
app.use(securityHeaders);
app.use(generalRateLimit);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || getAllowedOrigins().includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
  })
);
app.use(express.json({ limit: "32kb", strict: true }));

app.get("/", homeController.index);
app.get(
  "/search",
  validate("query", searchQuerySchema),
  optionalAuth,
  externalApiRateLimit,
  placesController.search
);
app.get(
  "/reverse-geocode",
  validate("query", coordinateQuerySchema),
  externalApiRateLimit,
  placesController.reverseGeocode
);
app.get(
  "/route",
  validate("query", routeQuerySchema),
  optionalAuth,
  externalApiRateLimit,
  routeController.getRoute
);
app.get(
  "/shop-search",
  validate("query", searchQuerySchema),
  optionalAuth,
  externalApiRateLimit,
  shoppingController.search
);
app.get(
  "/agent-search",
  validate("query", searchQuerySchema),
  optionalAuth,
  externalApiRateLimit,
  agentCompareController.search
);
app.get("/ads", advertisementController.list);
app.get("/llm/models", llmController.listModels);
app.post(
  "/auth/register",
  authRateLimit,
  validate("body", registerBodySchema),
  authController.register
);
app.post(
  "/auth/login",
  authRateLimit,
  validate("body", loginBodySchema),
  authController.login
);
app.post(
  "/auth/vip",
  requireAuth,
  protectVipActivation,
  authController.activateVip
);
app.get("/history", requireAuth, historyController.list);
app.patch(
  "/history/:id/favorite",
  requireAuth,
  validate("params", historyParamsSchema),
  validate("body", favoriteBodySchema),
  historyController.updateFavorite
);
app.get(
  "/history/:id",
  requireAuth,
  validate("params", historyParamsSchema),
  historyController.getById
);

app.use((req, res) => {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.path}`,
  });
});

app.use((err, req, res, next) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body is too large." });
  }

  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ error: "Malformed JSON body." });
  }

  console.error("Unhandled server error:", err);
  return res.status(500).json({
    error: "Internal server error.",
  });
});

async function startServer() {
  try {
    assertSecurityConfiguration();
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
