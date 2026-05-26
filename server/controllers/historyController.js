const { UserHistory } = require("../models");
const {
  getHistoryLimit,
  isVipUser,
} = require("../services/historyRetentionService");

function parseLimit(value, user) {
  const limit = Number(value);
  const maxLimit = getHistoryLimit(user);

  if (!Number.isInteger(limit)) {
    return maxLimit;
  }

  return Math.min(Math.max(limit, 1), maxLimit);
}

async function list(req, res) {
  try {
    const histories = await UserHistory.find({ user: req.user._id })
      .sort({ isFavorite: -1, createdAt: -1 })
      .limit(parseLimit(req.query.limit, req.user))
      .lean();

    res.json({
      limit: getHistoryLimit(req.user),
      canFavorite: isVipUser(req.user),
      histories,
    });
  } catch (err) {
    console.error("List history error:", err);
    res.status(500).json({ error: "Failed to load history." });
  }
}

async function getById(req, res) {
  try {
    const history = await UserHistory.findOne({
      _id: req.params.id,
      user: req.user._id,
    }).lean();

    if (!history) {
      return res.status(404).json({ error: "History not found." });
    }

    res.json(history);
  } catch (err) {
    console.error("Get history error:", err);
    res.status(500).json({ error: "Failed to load history." });
  }
}

async function updateFavorite(req, res) {
  if (!isVipUser(req.user)) {
    return res.status(403).json({ error: "VIP membership required." });
  }

  try {
    const isFavorite = Boolean(req.body?.isFavorite);
    const history = await UserHistory.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.user._id,
      },
      {
        isFavorite,
        favoritedAt: isFavorite ? new Date() : null,
      },
      {
        new: true,
      }
    ).lean();

    if (!history) {
      return res.status(404).json({ error: "History not found." });
    }

    res.json(history);
  } catch (err) {
    console.error("Update favorite history error:", err);
    res.status(500).json({ error: "Failed to update favorite." });
  }
}

module.exports = {
  list,
  getById,
  updateFavorite,
};
