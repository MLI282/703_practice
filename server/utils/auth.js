const crypto = require("crypto");

const SCRYPT_KEY_LENGTH = 64;
const TOKEN_ALGORITHM = "HS256";
const DEFAULT_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function getJwtSecret() {
  return process.env.JWT_SECRET || "development-only-change-this-secret";
}

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");

    crypto.scrypt(password, salt, SCRYPT_KEY_LENGTH, (err, derivedKey) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(`${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

function verifyPassword(password, storedHash) {
  return new Promise((resolve, reject) => {
    const [salt, key] = String(storedHash || "").split(":");

    if (!salt || !key) {
      resolve(false);
      return;
    }

    crypto.scrypt(password, salt, SCRYPT_KEY_LENGTH, (err, derivedKey) => {
      if (err) {
        reject(err);
        return;
      }

      const storedKey = Buffer.from(key, "hex");

      if (storedKey.length !== derivedKey.length) {
        resolve(false);
        return;
      }

      resolve(crypto.timingSafeEqual(storedKey, derivedKey));
    });
  });
}

function signToken(payload, options = {}) {
  const now = Math.floor(Date.now() / 1000);
  const ttlSeconds = options.ttlSeconds || DEFAULT_TOKEN_TTL_SECONDS;

  const header = {
    alg: TOKEN_ALGORITHM,
    typ: "JWT",
  };

  const tokenPayload = {
    ...payload,
    iat: now,
    exp: now + ttlSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(tokenPayload));
  const signature = crypto
    .createHmac("sha256", getJwtSecret())
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyToken(token) {
  const [encodedHeader, encodedPayload, signature] = String(token || "").split(".");

  if (!encodedHeader || !encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = crypto
    .createHmac("sha256", getJwtSecret())
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  let payload;

  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch (err) {
    return null;
  }

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
};
