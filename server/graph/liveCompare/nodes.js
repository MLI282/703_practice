const deepseek = require("../../config/deepseekClient");
const placesService = require("../../services/placesService");
const shoppingService = require("../../services/shoppingService");

function cleanJsonText(text) {
  return text.replace(/```json/g, "").replace(/```/g, "").trim();
}

function guessCategory(userInput) {
  const text = String(userInput || "").toLowerCase();
  const shoppingWords = [
    "buy",
    "purchase",
    "shopping",
    "shop",
    "laptop",
    "phone",
    "shoes",
    "clothes",
    "furniture",
    "book",
    "books",
  ];

  return shoppingWords.some((word) => text.includes(word)) ? "product" : "place";
}

async function invokeDeepSeekJson(prompt, fallback) {
  const response = await deepseek.chat.completions.create({
    model: "deepseek-chat",
    temperature: 0,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  try {
    return JSON.parse(cleanJsonText(response.choices[0].message.content));
  } catch (err) {
    return fallback;
  }
}

async function analyzeInputNode(state) {
  const fallback = {
    category: guessCategory(state.userInput),
    budget_nzd: null,
    preferred_features: [],
    ranking_focus: ["distance", "rating", "match"],
    use_case: state.userInput,
  };

  const parsed = await invokeDeepSeekJson(
    `
You are an assistant that classifies a user's local search or shopping request.

User request:
${state.userInput}

Return ONLY valid JSON:
{
  "category": "place" or "product",
  "budget_nzd": number or null,
  "preferred_features": [string],
  "ranking_focus": [string],
  "use_case": string
}

Rules:
- Use "place" for restaurants, cafes, supermarkets, attractions, routes, or local places.
- Use "product" for buying products such as laptops, phones, clothes, shoes, books, furniture, food items, etc.
- Do not explain.
`,
    fallback
  );

  return {
    category: parsed.category === "product" ? "product" : "place",
    parsedPreferences: parsed,
  };
}

async function analyzePlaceIntentNode(state) {
  if (state.category !== "place") {
    return {
      placeIntent: null,
    };
  }

  const fallback = {
    place_type: "local place",
    keywords: state.userInput,
    features: [],
    food_cuisine: null,
    price: null,
    max_distance_km: null,
    open_now: null,
    use_case: state.userInput,
  };

  const parsed = await invokeDeepSeekJson(
    `
You analyze what kind of PLACE the user is looking for.

User request:
${state.userInput}

Return ONLY valid JSON:
{
  "place_type": "library | museum | park | gym | pharmacy | supermarket | restaurant | cafe | attraction | hotel | school | hospital | parking | local place | etc",
  "keywords": "short search phrase or null",
  "features": ["quiet", "open now", "kid friendly", "near campus", "good for walking"],
  "food_cuisine": "italian | chinese | japanese | korean | indian | thai | null",
  "price": "cheap | medium | expensive | null",
  "max_distance_km": number or null,
  "open_now": true or false or null,
  "use_case": "short description of why the user wants this place"
}

Rules:
- Focus on the place category first, not food.
- Only set food_cuisine when the user clearly asks for food, restaurants, cafes, meals, cuisine, drinks, or dining.
- For non-food places, food_cuisine must be null.
- Do not force restaurant or cafe when the user asks for libraries, parks, museums, gyms, pharmacies, attractions, shops, or services.
- Do not explain.
`,
    fallback
  );

  const placeIntent = {
    ...fallback,
    ...parsed,
    food_cuisine: parsed.food_cuisine || null,
  };

  return {
    placeIntent,
    parsedPreferences: {
      ...state.parsedPreferences,
      place_intent: placeIntent,
    },
  };
}

async function fetchCandidatesNode(state) {
  if (state.category === "product") {
    const results = await shoppingService.searchShopping({
      userInput: state.userInput,
      lat: state.lat,
      lng: state.lng,
    });

    return {
      candidates: results,
    };
  }

  const results = await placesService.searchPlaces({
    lat: state.lat,
    lng: state.lng,
    userInput: state.userInput,
    placeIntent: state.placeIntent,
  });

  return {
    candidates: results,
  };
}

function normalizeCandidatesNode(state) {
  const normalizedCandidates = state.candidates.map((item, index) => {
    if (state.category === "product") {
      return {
        index,
        title: item.product_title,
        price: item.product_price,
        source: item.source,
        nearby_store: item.nearby_store,
        store_rating: item.store_rating,
        distance_text: item.distance_text,
        duration_text: item.duration_text,
        summary: item.agent_reasoning,
      };
    }

    return {
      index,
      title: item.name,
      rating: item.rating,
      address: item.address,
      price_level: item.price_level,
      distance_text: item.distance_text,
      duration_text: item.duration_text,
    };
  });

  return {
    normalizedCandidates,
  };
}

function fallbackComparisons(candidates) {
  return candidates.map((candidate, index) => ({
    index: candidate.index ?? index,
    compare_rank: index + 1,
    compare_reason: "Ranked by the current service result order.",
    best_for: "overall match",
  }));
}

async function compareCandidatesNode(state) {
  if (!state.normalizedCandidates.length) {
    return {
      comparisons: [],
      recommendation: "",
    };
  }

  const fallback = {
    recommendation: "Compared using the existing service result order.",
    comparisons: fallbackComparisons(state.normalizedCandidates),
  };

  const parsed = await invokeDeepSeekJson(
    `
You compare candidates returned by live Google Maps or shopping APIs.

User request:
${state.userInput}

Parsed preferences:
${JSON.stringify(state.parsedPreferences, null, 2)}

Candidates:
${JSON.stringify(state.normalizedCandidates, null, 2)}

Return ONLY valid JSON:
{
  "recommendation": "one concise overall recommendation",
  "comparisons": [
    {
      "index": number,
      "compare_rank": number,
      "compare_reason": "short reason",
      "best_for": "short label"
    }
  ]
}

Rules:
- Use only candidate indexes that exist.
- Keep original candidate information unchanged.
- Rank the candidates by user fit, not by explanation length.
`,
    fallback
  );

  return {
    comparisons: Array.isArray(parsed.comparisons)
      ? parsed.comparisons
      : fallback.comparisons,
    recommendation: parsed.recommendation || fallback.recommendation,
  };
}

function formatResponseNode(state) {
  const comparisonByIndex = new Map(
    state.comparisons.map((item) => [Number(item.index), item])
  );

  const enriched = state.candidates.map((item, index) => {
    const comparison = comparisonByIndex.get(index);

    return {
      ...item,
      compare_rank: comparison?.compare_rank ?? index + 1,
      compare_reason:
        comparison?.compare_reason || "Ranked by the current service result order.",
      best_for: comparison?.best_for || "overall match",
      agent_recommendation: state.recommendation,
    };
  });

  enriched.sort((a, b) => {
    return (a.compare_rank ?? 999999) - (b.compare_rank ?? 999999);
  });

  const results = state.category === "place" ? enriched.slice(0, 6) : enriched;

  return {
    results,
  };
}

module.exports = {
  analyzeInputNode,
  analyzePlaceIntentNode,
  fetchCandidatesNode,
  normalizeCandidatesNode,
  compareCandidatesNode,
  formatResponseNode,
};
