const { User, UserInfo } = require("../models");
const { hashPassword, signToken, verifyPassword } = require("../utils/auth");

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function sanitizeUser(user) {
  return {
    id: String(user._id),
    username: user.username,
    email: user.email,
    role: user.role,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function createAuthResponse(user) {
  const token = signToken({
    sub: String(user._id),
    email: user.email,
    role: user.role,
  });

  return {
    token,
    user: sanitizeUser(user),
  };
}

function validateRegisterBody(body) {
  body = body || {};

  const username = String(body.username || "").trim();
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");

  if (username.length < 2 || username.length > 50) {
    return "Username must be 2-50 characters.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Email is invalid.";
  }

  if (password.length < 6) {
    return "Password must be at least 6 characters.";
  }

  return null;
}

async function register(req, res) {
  const body = req.body || {};
  const validationError = validateRegisterBody(body);

  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const username = String(body.username).trim();
  const email = normalizeEmail(body.email);
  const password = String(body.password);

  try {
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({ error: "Email is already registered." });
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({
      username,
      email,
      passwordHash,
    });

    await UserInfo.create({
      user: user._id,
      displayName: username,
    });

    res.status(201).json(createAuthResponse(user));
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Email is already registered." });
    }

    console.error("Register error:", err);
    res.status(500).json({ error: "Register failed." });
  }
}

async function login(req, res) {
  const body = req.body || {};
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    if (user.status !== "active") {
      return res.status(403).json({ error: "User account is disabled." });
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    user.lastLoginAt = new Date();
    await user.save();

    res.json(createAuthResponse(user));
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed." });
  }
}

module.exports = {
  register,
  login,
};
