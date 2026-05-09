const { UserHistory } = require("../models");

function parseLimit(value) {
  const limit = Number(value);

  if (!Number.isInteger(limit)) {
    return 20;
  }

  return Math.min(Math.max(limit, 1), 100);
}

async function list(req, res) {
  try {
    const histories = await UserHistory.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(parseLimit(req.query.limit))
      .lean();

    res.json(histories);
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

module.exports = {
  list,
  getById,
};
