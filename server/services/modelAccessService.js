const { DEFAULT_MODEL_KEY, resolveModel } = require("../config/llmClient");
const { isVipUser } = require("./historyRetentionService");

function getRequestedModel(req) {
  return String(req.query.model || DEFAULT_MODEL_KEY).trim() || DEFAULT_MODEL_KEY;
}

function requireModelAccess(req, res) {
  const requestedModel = getRequestedModel(req);
  const resolvedModel = resolveModel(requestedModel);

  if (resolvedModel.key === DEFAULT_MODEL_KEY) {
    return requestedModel;
  }

  if (!isVipUser(req.user)) {
    res.status(403).json({
      error: "VIP membership required to switch models.",
    });
    return null;
  }

  return requestedModel;
}

module.exports = {
  getRequestedModel,
  requireModelAccess,
};
