const OpenAI = require("openai");
const { DEEPSEEK_API_KEY } = require("./apiKeys");

const DEFAULT_MODEL_KEY = "deepseek-chat";
const MODEL_OPTIONS = [
  {
    key: "deepseek-chat",
    label: "DeepSeek Chat",
    provider: "deepseek",
    model: "deepseek-chat",
  },
  {
    key: "deepseek-reasoner",
    label: "DeepSeek Reasoner",
    provider: "deepseek",
    model: "deepseek-reasoner",
  },
  {
    key: "chatgpt",
    label: "ChatGPT",
    provider: "openai",
    model: "gpt-4o-mini",
  },
];

const deepseek = new OpenAI({
  apiKey: DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

let openai;

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return openai;
}

function getAvailableModels() {
  return MODEL_OPTIONS.map(({ key, label, provider }) => ({
    key,
    label,
    provider,
  }));
}

function resolveModel(modelKey) {
  return (
    MODEL_OPTIONS.find((model) => model.key === modelKey) ||
    MODEL_OPTIONS.find((model) => model.key === DEFAULT_MODEL_KEY)
  );
}

async function createChatCompletion(options) {
  const { modelKey, ...requestOptions } = options;
  const resolvedModel = resolveModel(modelKey);

  if (resolvedModel.provider === "deepseek") {
    return deepseek.chat.completions.create({
      ...requestOptions,
      model: resolvedModel.model,
    });
  }

  if (resolvedModel.provider === "openai") {
    return getOpenAIClient().chat.completions.create({
      ...requestOptions,
      model: resolvedModel.model,
    });
  }

  throw new Error(`Unsupported LLM provider: ${resolvedModel.provider}`);
}

module.exports = {
  DEFAULT_MODEL_KEY,
  createChatCompletion,
  getAvailableModels,
  resolveModel,
};
