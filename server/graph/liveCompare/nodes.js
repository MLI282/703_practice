const deepseek = require("../../config/deepseekClient");
const placesService = require("../../services/placesService");
const shoppingService = require("../../services/shoppingService");

const PLACE_RESULT_LIMIT = 6;
const PRODUCT_RESULT_LIMIT = 8;
const DEFAULT_COMPARE_REASON = "Matched from live search results.";
const DEFAULT_BEST_FOR = "overall match";

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

  return shoppingWords.some((word) => text.includes(word))
    ? "product"
    : "place";
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
  console.time("analyzeInputNode_total");

  const fallbackPlaceIntent = {
    place_type: "local place",
    keywords: state.userInput,
    features: [],
    food_cuisine: null,
    price: null,
    max_distance_km: null,
    open_now: null,
    use_case: state.userInput,
  };

  const fallback = {
    category: guessCategory(state.userInput),
    budget_nzd: null,
    preferred_features: [],
    ranking_focus: ["distance", "rating", "match"],
    use_case: state.userInput,
    place_intent:
      guessCategory(state.userInput) === "place"
        ? fallbackPlaceIntent
        : null,
  };

  console.time("deepseek_intent_classification");

  const parsed = await invokeDeepSeekJson(
    `
You are an assistant that classifies a user's local search or shopping request and extracts any place-search intent in one pass.

User request:
${state.userInput}

Return ONLY valid JSON:
{
  "category": "place" or "product",
  "budget_nzd": number or null,
  "preferred_features": [string],
  "ranking_focus": [string],
  "use_case": string,
  "place_intent": {
    "place_type": "library | museum | park | gym | pharmacy | supermarket | restaurant | cafe | attraction | hotel | school | hospital | parking | local place | etc",
    "keywords": "short search phrase or null",
    "features": ["quiet", "open now", "kid friendly", "near campus", "good for walking"],
    "food_cuisine": "italian | chinese | japanese | korean | indian | thai | null",
    "price": "cheap | medium | expensive | null",
    "max_distance_km": number or null,
    "open_now": true or false or null,
    "use_case": "short description of why the user wants this place"
  } or null
}

Rules:
- Use "place" for restaurants, cafes, supermarkets, attractions, routes, or local places.
- Use "product" for buying products such as laptops, phones, clothes, shoes, books, furniture, food items, etc.
- For product requests, place_intent must be null.
- For place requests, fill place_intent.
- Focus on the place category first, not food.
- Only set food_cuisine when the user clearly asks for food, restaurants, cafes, meals, cuisine, drinks, or dining.
- For non-food places, food_cuisine must be null.
- Do not force restaurant or cafe when the user asks for libraries, parks, museums, gyms, pharmacies, attractions, shops, or services.
- Do not explain.
`,
    fallback
  );

  console.timeEnd("deepseek_intent_classification");

  const category =
    parsed.category === "product"
      ? "product"
      : "place";

  console.time("intent_post_processing");

  const placeIntent =
    category === "place"
      ? {
          ...fallbackPlaceIntent,
          ...(parsed.place_intent || {}),
          food_cuisine: parsed.place_intent?.food_cuisine || null,
        }
      : null;

  console.timeEnd("intent_post_processing");
  console.timeEnd("analyzeInputNode_total");

  return {
    category,
    placeIntent,
    parsedPreferences: {
      ...parsed,
      category,
      place_intent: placeIntent,
    },
  };
}

async function analyzePlaceIntentNode(state) {
  console.time("analyzePlaceIntentNode");

  if (state.category !== "place") {
    console.timeEnd("analyzePlaceIntentNode");

    return {
      placeIntent: null,
    };
  }

  if (state.placeIntent) {
    console.timeEnd("analyzePlaceIntentNode");

    return {
      placeIntent: state.placeIntent,
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

  console.time("deepseek_place_analysis");

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
`,
    fallback
  );

  console.timeEnd("deepseek_place_analysis");

  const placeIntent = {
    ...fallback,
    ...parsed,
    food_cuisine: parsed.food_cuisine || null,
  };

  console.timeEnd("analyzePlaceIntentNode");

  return {
    placeIntent,
    parsedPreferences: {
      ...state.parsedPreferences,
      place_intent: placeIntent,
    },
  };
}

async function fetchCandidatesNode(state) {
  console.time("fetchCandidatesNode_total");

  if (state.category === "product") {
    console.time("shopping_api");

    const results = await shoppingService.searchShopping({
      userInput: state.userInput,
      lat: state.lat,
      lng: state.lng,
    });

    console.timeEnd("shopping_api");
    console.timeEnd("fetchCandidatesNode_total");

    return {
      candidates: results,
    };
  }

  console.time("places_api");

  const results = await placesService.searchPlaces({
    lat: state.lat,
    lng: state.lng,
    userInput: state.userInput,
    placeIntent: state.placeIntent,
  });

  console.timeEnd("places_api");
  console.timeEnd("fetchCandidatesNode_total");

  return {
    candidates: results,
  };
}

function normalizeCandidatesNode(state) {
  console.time("normalizeCandidatesNode");

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

  console.timeEnd("normalizeCandidatesNode");

  return {
    normalizedCandidates,
  };
}

function fallbackComparisons(candidates) {
  return candidates.map((candidate, index) => ({
    index: candidate.index ?? index,
    compare_rank: index + 1,
    compare_reason: DEFAULT_COMPARE_REASON,
    best_for: DEFAULT_BEST_FOR,
  }));
}

function normalizeComparisons(comparisons, candidates) {
  if (!Array.isArray(comparisons)) {
    return fallbackComparisons(candidates);
  }

  const candidateIndexes = new Set(
    candidates.map((candidate) => candidate.index)
  );

  const byIndex = new Map();

  comparisons.forEach((comparison) => {
    const index = Number(comparison?.index);

    if (!candidateIndexes.has(index) || byIndex.has(index)) {
      return;
    }

    const rank = Number(comparison.compare_rank);

    byIndex.set(index, {
      index,
      compare_rank:
        Number.isFinite(rank) && rank > 0
          ? rank
          : index + 1,
      compare_reason:
        comparison.compare_reason || DEFAULT_COMPARE_REASON,
      best_for:
        comparison.best_for || DEFAULT_BEST_FOR,
    });
  });

  candidates.forEach((candidate) => {
    if (!byIndex.has(candidate.index)) {
      byIndex.set(candidate.index, {
        index: candidate.index,
        compare_rank: candidate.index + 1,
        compare_reason: DEFAULT_COMPARE_REASON,
        best_for: DEFAULT_BEST_FOR,
      });
    }
  });

  return Array.from(byIndex.values());
}

async function compareCandidatesNode(state) {
  console.time("compareCandidatesNode");

  if (!state.normalizedCandidates.length) {
    console.timeEnd("compareCandidatesNode");

    return {
      comparisons: [],
      recommendation: "",
    };
  }

  // 本地公式排序
  const scored = state.normalizedCandidates.map((item) => {
    const rating =
      Number(item.rating || item.store_rating || 0);

    const distanceText =
      item.distance_text || "";

    const distanceMatch =
      distanceText.match(/[\d.]+/);

    const distance =
      distanceMatch
        ? Number(distanceMatch[0])
        : 10;

    const score =
      rating * 0.7 - distance * 0.3;

    return {
      ...item,
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  // 只对前3个生成 AI explanation
  const topCandidates = scored.slice(0, 3);

  console.time("deepseek_explanations");

  const comparisons = await Promise.all(
    topCandidates.map(async (item, index) => {
      let reason =
        `Highly rated (${item.rating || item.store_rating || "N/A"}) and nearby.`;

      try {
        const aiResponse =
          await deepseek.chat.completions.create({
            model: "deepseek-chat",
            temperature: 0.7,
            messages: [
              {
                role: "system",
                content:
                  "Write one short natural recommendation sentence for a local place.",
              },
              {
                role: "user",
                content: `
Place: ${item.title}
Rating: ${item.rating || item.store_rating}
Distance: ${item.distance_text}

User request:
${state.userInput}
`,
              },
            ],
          });

        reason =
          aiResponse.choices[0].message.content.trim();
      } catch (err) {
        console.log("AI explanation failed");
      }

      return {
        index: item.index,
        compare_rank: index + 1,
        compare_reason: reason,
        best_for: "overall match",
      };
    })
  );

  console.timeEnd("deepseek_explanations");
  console.timeEnd("compareCandidatesNode");

  return {
    comparisons,
    recommendation:
      "Ranked using local scoring and AI explanations.",
  };
}

function formatResponseNode(state) {
  console.time("formatResponseNode");

  const comparisonByIndex = new Map(
    state.comparisons.map((item) => [
      Number(item.index),
      item,
    ])
  );

  const enriched = state.candidates.map((item, index) => {
    const comparison = comparisonByIndex.get(index);

    return {
      ...item,
      __original_index: index,
      compare_rank:
        comparison?.compare_rank ?? index + 1,
      compare_reason:
        comparison?.compare_reason ||
        DEFAULT_COMPARE_REASON,
      best_for:
        comparison?.best_for ||
        DEFAULT_BEST_FOR,
      agent_recommendation:
        state.recommendation,
    };
  });

  enriched.sort((a, b) => {
    return (
      (a.compare_rank ?? 999999) -
        (b.compare_rank ?? 999999) ||
      a.__original_index - b.__original_index
    );
  });

  enriched.forEach((item, index) => {
    item.compare_rank = index + 1;
  });

  const resultLimit =
    state.category === "place"
      ? PLACE_RESULT_LIMIT
      : PRODUCT_RESULT_LIMIT;

  const results = enriched
    .slice(0, resultLimit)
    .map((item) => {
      const { __original_index, ...result } = item;
      return result;
    });

  console.timeEnd("formatResponseNode");

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