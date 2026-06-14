const crypto = require("crypto");
const { SearchUsage } = require("../models");
const { isVipUser } = require("./historyRetentionService");

const ANONYMOUS_DAILY_LIMIT = 2;
const FREE_DAILY_LIMIT = 8;
const VIP_DAILY_LIMIT = 50;

function getDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Pacific/Auckland",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function hashValue(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function getQuotaIdentity(req) {
  if (req.user?._id) {
    return {
      subjectType: "user",
      subjectKey: String(req.user._id),
      plan: isVipUser(req.user) ? "vip" : "free",
      limit: isVipUser(req.user) ? VIP_DAILY_LIMIT : FREE_DAILY_LIMIT,
    };
  }

  return {
    subjectType: "anonymous",
    subjectKey: hashValue(getClientIp(req)),
    plan: "anonymous",
    limit: ANONYMOUS_DAILY_LIMIT,
  };
}

async function consumeSearchQuota(req) {
  const identity = getQuotaIdentity(req);
  const dateKey = getDateKey();

  const usage = await SearchUsage.findOneAndUpdate(
    {
      subjectType: identity.subjectType,
      subjectKey: identity.subjectKey,
      dateKey,
    },
    {
      $inc: { count: 1 },
      $setOnInsert: {
        subjectType: identity.subjectType,
        subjectKey: identity.subjectKey,
        dateKey,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  const remaining = Math.max(identity.limit - usage.count, 0);

  if (usage.count > identity.limit) {
    return {
      allowed: false,
      plan: identity.plan,
      limit: identity.limit,
      used: usage.count - 1,
      remaining: 0,
      dateKey,
    };
  }

  return {
    allowed: true,
    plan: identity.plan,
    limit: identity.limit,
    used: usage.count,
    remaining,
    dateKey,
  };
}

module.exports = {
  ANONYMOUS_DAILY_LIMIT,
  FREE_DAILY_LIMIT,
  VIP_DAILY_LIMIT,
  consumeSearchQuota,
};
