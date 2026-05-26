const { UserHistory } = require("../models");

const FREE_HISTORY_LIMIT = 20;
const VIP_HISTORY_LIMIT = 80;

function isVipUser(user) {
  if (!user) {
    return false;
  }

  if (user.membership !== "vip") {
    return false;
  }

  if (!user.vipExpiresAt) {
    return true;
  }

  return new Date(user.vipExpiresAt) > new Date();
}

function getHistoryLimit(user) {
  return isVipUser(user) ? VIP_HISTORY_LIMIT : FREE_HISTORY_LIMIT;
}

async function enforceHistoryLimit(user) {
  if (!user?._id) {
    return;
  }

  const limit = getHistoryLimit(user);
  const removableHistories = await UserHistory.find({
    user: user._id,
    isFavorite: { $ne: true },
  })
    .sort({ createdAt: -1 })
    .skip(limit)
    .select("_id")
    .lean();

  if (!removableHistories.length) {
    return;
  }

  await UserHistory.deleteMany({
    _id: {
      $in: removableHistories.map((history) => history._id),
    },
    user: user._id,
    isFavorite: { $ne: true },
  });
}

module.exports = {
  FREE_HISTORY_LIMIT,
  VIP_HISTORY_LIMIT,
  enforceHistoryLimit,
  getHistoryLimit,
  isVipUser,
};
