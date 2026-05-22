const { Advertisement } = require("../models");

async function list(req, res, next) {
  try {
    const advertisements = await Advertisement.find({ isActive: true })
      .sort({ displayOrder: 1, createdAt: -1 })
      .select("slug title imageUrl websiteUrl displayOrder")
      .lean();

    res.json({
      advertisements,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
};
