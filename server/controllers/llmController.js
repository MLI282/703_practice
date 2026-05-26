const {
  DEFAULT_MODEL_KEY,
  getAvailableModels,
} = require("../config/llmClient");

function listModels(req, res) {
  res.json({
    defaultModel: DEFAULT_MODEL_KEY,
    models: getAvailableModels(),
  });
}

module.exports = {
  listModels,
};
