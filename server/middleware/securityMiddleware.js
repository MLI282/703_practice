const { z } = require("zod");

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MAX_REQUESTS = 300;
const MAX_QUERY_LENGTH = 500;

const modelSchema = z.string().trim().min(1).max(64).optional();
const latitudeSchema = z.coerce.number().finite().min(-90).max(90);
const longitudeSchema = z.coerce.number().finite().min(-180).max(180);
const queryTextSchema = z.string().trim().min(1).max(MAX_QUERY_LENGTH);

const searchQuerySchema = z.object({
  q: queryTextSchema,
  lat: latitudeSchema,
  lng: longitudeSchema,
  model: modelSchema,
});

const routeQuerySchema = z.object({
  q: queryTextSchema,
  model: modelSchema,
});

const coordinateQuerySchema = z.object({
  lat: latitudeSchema,
  lng: longitudeSchema,
});

const registerBodySchema = z.object({
  username: z.string().trim().min(2).max(50),
  email: z.string().trim().email().max(254),
  password: z.string().min(6).max(128),
});

const loginBodySchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

const favoriteBodySchema = z.object({
  isFavorite: z.boolean(),
});

const historyParamsSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid history id."),
});

function validationError(res, result) {
  const issue = result.error.issues[0];

  return res.status(400).json({
    error: "Invalid request.",
    details: issue?.message || "Request validation failed.",
  });
}

function validate(source, schema) {
  return function validateRequest(req, res, next) {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      return validationError(res, result);
    }

    return next();
  };
}

function securityHeaders(req, res, next) {
  res.set({
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-site",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  });

  if (process.env.NODE_ENV === "production") {
    res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  next();
}

function getRateLimitKey(req) {
  if (req.user?._id) {
    return `user:${req.user._id}`;
  }

  return `ip:${req.ip || req.socket?.remoteAddress || "unknown"}`;
}

function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || DEFAULT_WINDOW_MS;
  const max = options.max || DEFAULT_MAX_REQUESTS;
  const message = options.message || "Too many requests. Please try again later.";
  const keyGenerator = options.keyGenerator || getRateLimitKey;
  const requests = new Map();

  function rateLimiter(req, res, next) {
    const now = Date.now();
    const key = keyGenerator(req);
    const current = requests.get(key);
    const entry =
      !current || current.resetAt <= now
        ? { count: 0, resetAt: now + windowMs }
        : current;

    entry.count += 1;
    requests.set(key, entry);

    const remaining = Math.max(max - entry.count, 0);
    res.set({
      "RateLimit-Limit": String(max),
      "RateLimit-Remaining": String(remaining),
      "RateLimit-Reset": String(Math.ceil(entry.resetAt / 1000)),
    });

    if (entry.count > max) {
      res.set("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: message });
    }

    if (requests.size > 5000) {
      for (const [storedKey, storedEntry] of requests) {
        if (storedEntry.resetAt <= now) {
          requests.delete(storedKey);
        }
      }
    }

    return next();
  }

  rateLimiter.reset = () => requests.clear();
  return rateLimiter;
}

function protectVipActivation(req, res, next) {
  const enabled = process.env.ENABLE_SELF_SERVICE_VIP === "true";

  if (process.env.NODE_ENV === "production" && !enabled) {
    return res.status(403).json({
      error: "Self-service VIP activation is disabled.",
    });
  }

  return next();
}

module.exports = {
  MAX_QUERY_LENGTH,
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
};
