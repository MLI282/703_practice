const OpenAI = require("openai");
const { DEEPSEEK_API_KEY } = require("./apiKeys");
const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS) || 15000;

const deepseek = new OpenAI({
  apiKey: DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
  timeout: LLM_TIMEOUT_MS,
});

module.exports = deepseek;
