const OpenAI = require("openai");
const { DEEPSEEK_API_KEY } = require("./apiKeys");

const deepseek = new OpenAI({
  apiKey: DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

module.exports = deepseek;
