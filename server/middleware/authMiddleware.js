const { User } = require("../models");
const { verifyToken } = require("../utils/auth");

function getBearerToken(req) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return "";
  }

  return header.slice("Bearer ".length).trim();
}

async function resolveUserFromRequest(req) {
  const token = getBearerToken(req);

  if (!token) {
    return null;
  }

  const payload = verifyToken(token);

  if (!payload?.sub) {
    return null;
  }

  return User.findById(payload.sub).select("-passwordHash");
}

async function optionalAuth(req, res, next) {
  try {
    req.user = await resolveUserFromRequest(req);
    next();
  } catch (err) {
    next(err);
  }
}

async function requireAuth(req, res, next) {
  try {
    const user = await resolveUserFromRequest(req);

    if (!user) {
      return res.status(401).json({ error: "Authentication required." });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  optionalAuth,
  requireAuth,
};
