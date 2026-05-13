const deepseek = require("../../config/deepseekClient");
const placesService = require("../../services/placesService");
const shoppingService = require("../../services/shoppingService");

const PLACE_RESULT_LIMIT = 6;
const PRODUCT_RESULT_LIMIT = 8;
const DEFAULT_COMPARE_REASON = "Matched from live search results.";
const DEFAULT_BEST_FOR = "overall match";
const DEFAULT_DISTANCE_KM = 20;

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
    placeIntent: {
      ...(state.placeIntent || {}),
      ranking_focus: state.parsedPreferences?.ranking_focus || [],
    },
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
        match_score: item.match_score,
        product_match: item.product_match,
        compare_reason: item.compare_reason,
        best_for: item.best_for,
        summary: item.agent_reasoning,
      };
    }

    return {
      index,
      title: item.name,
      rating: item.rating,
      user_ratings_total: item.user_ratings_total,
      address: item.address,
      price_level: item.price_level,
      open_now: item.open_now,
      distance_value: item.distance_value,
      distance_text: item.distance_text,
      duration_text: item.duration_text,
      place_match_score: item.place_match_score,
      compare_reason: item.compare_reason,
      best_for: item.best_for,
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

function normalizeText(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getDistanceKm(item) {
  if (Number.isFinite(Number(item.distance_value))) {
    return Number(item.distance_value) / 1000;
  }

  const match = String(item.distance_text || "").match(/[\d.]+/);
  if (!match) {
    return DEFAULT_DISTANCE_KM;
  }

  const distanceText = normalizeText(item.distance_text);
  return distanceText.includes(" m") ? Number(match[0]) / 1000 : Number(match[0]);
}

function getPlaceIntentTerms(state) {
  const intent = state.placeIntent || state.parsedPreferences?.place_intent || {};
  const features = Array.isArray(intent.features) ? intent.features : [];

  return [
    intent.place_type,
    intent.keywords,
    intent.food_cuisine,
    intent.use_case,
    ...features,
  ]
    .filter(Boolean)
    .flatMap((value) => normalizeText(value).split(" "))
    .filter((term) => term.length > 2);
}

function scorePlaceCandidate(item, state) {
  if (Number.isFinite(Number(item.place_match_score))) {
    return Number(item.place_match_score);
  }

  const intent = state.placeIntent || state.parsedPreferences?.place_intent || {};
  const text = normalizeText(`${item.title} ${item.address}`);
  const terms = [...new Set(getPlaceIntentTerms(state))];
  const matchedTerms = terms.filter((term) => text.includes(term)).length;
  const termScore = terms.length ? (matchedTerms / terms.length) * 3 : 0.8;
  const ratingScore = Number(item.rating || 0) / 5 * 2;
  const reviewCount = Number(item.user_ratings_total || 0);
  const confidenceScore = clamp(Math.log10(reviewCount + 1) / 3, 0, 1);
  const distanceKm = getDistanceKm(item);
  const targetDistance = Number(intent.max_distance_km) || 10;
  const distanceScore =
    clamp(1 - distanceKm / Math.max(targetDistance, 1), 0, 1) * 2;
  const priceScore =
    intent.price === "cheap"
      ? item.price_level === null || item.price_level === undefined
        ? 0.25
        : item.price_level <= 2
          ? 1
          : -0.7
      : 0.35;
  const openScore =
    intent.open_now === true
      ? item.open_now === true
        ? 1
        : -1
      : item.open_now === true
        ? 0.25
        : 0;

  return Number(
    (
      termScore +
      ratingScore +
      confidenceScore +
      distanceScore +
      priceScore +
      openScore
    ).toFixed(3)
  );
}

function buildPlaceCompareReason(item, state) {
  if (item.compare_reason) {
    return item.compare_reason;
  }

  const intent = state.placeIntent || state.parsedPreferences?.place_intent || {};
  const text = normalizeText(`${item.title} ${item.address}`);
  const matchedTerms = [...new Set(getPlaceIntentTerms(state))]
    .filter((term) => text.includes(term))
    .slice(0, 3);
  const details = [];

  if (item.distance_text) {
    details.push(`it is ${item.distance_text} away`);
  }

  if (item.rating) {
    const reviewText = item.user_ratings_total
      ? ` from ${item.user_ratings_total} reviews`
      : "";
    details.push(`it has a ${item.rating} rating${reviewText}`);
  }

  if (matchedTerms.length) {
    details.push(`it lines up with ${matchedTerms.join(", ")}`);
  }

  if (item.open_now === true) {
    details.push("it is open now");
  }

  const useCase = intent.use_case || intent.keywords || state.userInput || "your request";
  const detailSentence = details.length
    ? details.slice(0, 2).join("; ")
    : "it balances relevance, distance, and rating";

  return `Good fit for ${useCase}: ${detailSentence}.`;
}

function buildPlaceBestFor(item, state) {
  if (item.best_for) {
    return item.best_for;
  }

  const intent = state.placeIntent || state.parsedPreferences?.place_intent || {};

  if (intent.open_now === true && item.open_now === true) {
    return "open now";
  }

  if (intent.price === "cheap" && item.price_level !== null && item.price_level <= 2) {
    return "budget friendly";
  }

  if (getDistanceKm(item) < 2) {
    return "nearest option";
  }

  if (item.rating >= 4.5) {
    return "highly rated";
  }

  return DEFAULT_BEST_FOR;
}

function scoreProductCandidate(item) {
  if (Number.isFinite(Number(item.match_score))) {
    return Number(item.match_score);
  }

  const title = normalizeText(item.title);
  const queryTerms = normalizeText(item.summary || item.title)
    .split(" ")
    .filter((term) => term.length > 2);
  const matchedTerms = queryTerms.filter((term) => title.includes(term)).length;

  return matchedTerms || 0;
}

function hasDistanceFocus(state) {
  const focus = Array.isArray(state.parsedPreferences?.ranking_focus)
    ? state.parsedPreferences.ranking_focus.map(normalizeText)
    : [];
  const text = normalizeText([state.userInput, ...focus].filter(Boolean).join(" "));

  return (
    focus.includes("distance") ||
    /near|nearby|nearest|closest|walking|distance|location|position|close/.test(text)
  );
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

  // Local deterministic ranking.
  if (state.category === "place") {
    const distanceFirst = hasDistanceFocus(state);
    const scored = state.normalizedCandidates
      .map((item) => ({
        ...item,
        score: scorePlaceCandidate(item, state),
      }))
      .sort((a, b) => {
        const distanceDiff = getDistanceKm(a) - getDistanceKm(b);

        if (distanceFirst && Math.abs(distanceDiff) > 0.5) {
          return distanceDiff;
        }

        return (
          b.score - a.score ||
          Number(b.rating || 0) - Number(a.rating || 0) ||
          distanceDiff
        );
      });

    const comparisons = scored.map((item, index) => ({
      index: item.index,
      compare_rank: index + 1,
      compare_reason: buildPlaceCompareReason(item, state),
      best_for: buildPlaceBestFor(item, state),
    }));

    console.timeEnd("compareCandidatesNode");

    return {
      comparisons,
      recommendation:
        "Ranked using intent match, rating confidence, distance, price, and availability.",
    };
  }

  const scored = state.normalizedCandidates
    .map((item) => ({
      ...item,
      score: scoreProductCandidate(item),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const comparisons = scored.map((item, index) => ({
    index: item.index,
    compare_rank: index + 1,
    compare_reason:
      item.compare_reason ||
      "Ranked by product title match, requested features, and budget fit.",
    best_for: item.best_for || "product match",
  }));
  console.timeEnd("compareCandidatesNode");

  return {
    comparisons,
    recommendation:
      "Ranked using product fit from shopping results.",
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
