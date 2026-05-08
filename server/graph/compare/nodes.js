const deepseek = require("../../config/deepseekClient");
const { loadProducts, loadPlaces } = require("../tools/dataLoader");

function cleanJsonText(text) {
  return text.replace(/```json/g, "").replace(/```/g, "").trim();
}

async function invokeDeepSeek(prompt) {
  const response = await deepseek.chat.completions.create({
    model: "deepseek-chat",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  return response.choices[0].message.content;
}

async function parseRequestNode(state) {
  const prompt = `
You are an assistant that extracts structured shopping or place-search preferences.

User request:
${state.user_request}

Return ONLY valid JSON with this structure:
{
  "category": "product" or "place",
  "budget_nzd": number or null,
  "preferred_features": [string],
  "use_case": string
}
`;

  const text = await invokeDeepSeek(prompt);

  let parsed;
  try {
    parsed = JSON.parse(cleanJsonText(text));
  } catch (err) {
    parsed = {
      category: "product",
      budget_nzd: null,
      preferred_features: [],
      use_case: state.user_request,
    };
  }

  return {
    category: parsed.category || "product",
    parsed_preferences: parsed,
  };
}

function loadCandidatesNode(state) {
  const candidates = state.category === "place" ? loadPlaces() : loadProducts();

  return {
    candidates,
  };
}

function shortlistNode(state) {
  const prefs = state.parsed_preferences;
  const budget = prefs.budget_nzd;
  const candidates = state.candidates;

  let filtered = candidates;
  if (budget !== null && budget !== undefined) {
    filtered = candidates.filter((item) => {
      return item.price_nzd === null || item.price_nzd === undefined || item.price_nzd <= budget;
    });
  }

  return {
    shortlisted: filtered.slice(0, 5),
  };
}

async function recommendNode(state) {
  const prompt = `
You are a recommendation assistant.

User preferences:
${JSON.stringify(state.parsed_preferences, null, 2)}

Candidates:
${JSON.stringify(state.shortlisted, null, 2)}

Write:
1. Top recommendation
2. Short comparison
3. Why it fits the user
4. Which option is best value

Keep it concise but useful.
`;

  const recommendation = await invokeDeepSeek(prompt);

  return {
    recommendation,
  };
}

module.exports = {
  parseRequestNode,
  loadCandidatesNode,
  shortlistNode,
  recommendNode,
};
