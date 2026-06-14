const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MAX_QUERY_LENGTH,
  createRateLimiter,
  favoriteBodySchema,
  loginBodySchema,
  protectVipActivation,
  registerBodySchema,
  searchQuerySchema,
  securityHeaders,
  validate,
} = require("../middleware/securityMiddleware");
const { assertSecurityConfiguration } = require("../utils/auth");

function createResponse() {
  return {
    headers: {},
    statusCode: 200,
    payload: null,
    set(nameOrHeaders, value) {
      if (typeof nameOrHeaders === "string") {
        this.headers[nameOrHeaders] = value;
      } else {
        Object.assign(this.headers, nameOrHeaders);
      }
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

test("search validation accepts a normal request without changing values", () => {
  const query = {
    q: "cheap laptop near campus",
    lat: "-36.8485",
    lng: "174.7633",
  };
  const req = { query };
  const res = createResponse();
  let called = false;

  validate("query", searchQuerySchema)(req, res, () => {
    called = true;
  });

  assert.equal(called, true);
  assert.deepEqual(req.query, query);
});

test("search validation rejects missing, oversized, and invalid coordinate input", () => {
  const cases = [
    { q: "", lat: "-36.8", lng: "174.7" },
    { q: "x".repeat(MAX_QUERY_LENGTH + 1), lat: "-36.8", lng: "174.7" },
    { q: "cafe", lat: "91", lng: "174.7" },
    { q: "cafe", lat: "-36.8", lng: "181" },
    { q: "cafe", lat: "not-a-number", lng: "174.7" },
  ];

  for (const query of cases) {
    const req = { query };
    const res = createResponse();

    validate("query", searchQuerySchema)(req, res, () => {
      assert.fail("Invalid request reached the next middleware.");
    });

    assert.equal(res.statusCode, 400);
    assert.equal(res.payload.error, "Invalid request.");
  }
});

test("authentication and favorite schemas reject oversized or ambiguous input", () => {
  const invalidCases = [
    {
      source: "body",
      schema: registerBodySchema,
      value: {
        username: "student",
        email: "student@example.com",
        password: "x".repeat(129),
      },
    },
    {
      source: "body",
      schema: loginBodySchema,
      value: {
        email: "not-an-email",
        password: "password",
      },
    },
    {
      source: "body",
      schema: favoriteBodySchema,
      value: {
        isFavorite: "false",
      },
    },
  ];

  for (const testCase of invalidCases) {
    const req = { [testCase.source]: testCase.value };
    const res = createResponse();

    validate(testCase.source, testCase.schema)(req, res, () => {
      assert.fail("Invalid body reached the next middleware.");
    });

    assert.equal(res.statusCode, 400);
  }
});

test("rate limiter keys anonymous requests from req.ip, not forwarded headers", () => {
  const limiter = createRateLimiter({ windowMs: 60000, max: 1 });
  const firstReq = {
    headers: { "x-forwarded-for": "198.51.100.1" },
    ip: "203.0.113.10",
  };
  const secondReq = {
    headers: { "x-forwarded-for": "198.51.100.2" },
    ip: "203.0.113.10",
  };
  const firstRes = createResponse();
  const secondRes = createResponse();

  limiter(firstReq, firstRes, () => {});
  limiter(secondReq, secondRes, () => {
    assert.fail("Rate-limited request reached the next middleware.");
  });

  assert.equal(firstRes.statusCode, 200);
  assert.equal(secondRes.statusCode, 429);
  assert.equal(secondRes.headers["Retry-After"], "60");
});

test("security headers hide platform details and constrain browser behavior", () => {
  const req = {};
  const res = createResponse();
  let called = false;

  securityHeaders(req, res, () => {
    called = true;
  });

  assert.equal(called, true);
  assert.equal(res.headers["X-Content-Type-Options"], "nosniff");
  assert.equal(res.headers["X-Frame-Options"], "DENY");
  assert.match(res.headers["Content-Security-Policy"], /default-src 'none'/);
});

test("production disables demo VIP activation unless explicitly enabled", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousVipSetting = process.env.ENABLE_SELF_SERVICE_VIP;

  process.env.NODE_ENV = "production";
  delete process.env.ENABLE_SELF_SERVICE_VIP;

  try {
    const res = createResponse();

    protectVipActivation({}, res, () => {
      assert.fail("Disabled VIP activation reached the controller.");
    });

    assert.equal(res.statusCode, 403);
  } finally {
    restoreEnv("NODE_ENV", previousNodeEnv);
    restoreEnv("ENABLE_SELF_SERVICE_VIP", previousVipSetting);
  }
});

test("production requires a strong JWT secret", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousSecret = process.env.JWT_SECRET;

  process.env.NODE_ENV = "production";

  try {
    delete process.env.JWT_SECRET;
    assert.throws(assertSecurityConfiguration, /JWT_SECRET is required/);

    process.env.JWT_SECRET = "too-short";
    assert.throws(assertSecurityConfiguration, /at least 32 characters/);

    process.env.JWT_SECRET = "a-secure-production-secret-with-32-chars";
    assert.doesNotThrow(assertSecurityConfiguration);
  } finally {
    restoreEnv("NODE_ENV", previousNodeEnv);
    restoreEnv("JWT_SECRET", previousSecret);
  }
});

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
