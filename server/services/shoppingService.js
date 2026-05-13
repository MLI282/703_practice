const axios = require("axios");
const deepseek = require("../config/deepseekClient");
const serpSearch = require("../config/serpClient");
const { GOOGLE_API_KEY } = require("../config/apiKeys");
const { ShoppingCache } = require("../models");

const PRODUCT_RESULT_LIMIT = 8;
const STORE_RESULT_LIMIT = 6;
const INTENT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PRODUCT_CACHE_TTL_MS = 30 * 60 * 1000;
const STORE_CACHE_TTL_MS = 60 * 60 * 1000;
const DISTANCE_FALLBACK_KM = 20;
const PRODUCT_STOPWORDS = new Set([
  "buy",
  "find",
  "shopping",
  "shop",
  "need",
  "want",
  "with",
  "for",
  "and",
  "the",
  "under",
  "below",
  "less",
  "than",
  "budget",
  "cheap",
  "near",
  "nearby",
  "closest",
  "best",
  "good",
  "nzd",
]);
const FEATURE_KEYWORDS = [
  "gaming",
  "lightweight",
  "portable",
  "waterproof",
  "wireless",
  "bluetooth",
  "organic",
  "vegan",
  "leather",
  "cotton",
  "running",
  "office",
  "student",
  "premium",
  "budget",
  "cheap",
  "durable",
  "fast",
  "quiet",
  "small",
  "large",
  "new",
  "used",
  "refurbished",
];

const CATEGORY_RULES = [
  {
    keywords: ["laptop", "computer", "macbook", "notebook"],
    category: "laptop",
    store_type: "electronics store",
  },
  {
    keywords: ["phone", "iphone", "android", "samsung"],
    category: "phone",
    store_type: "electronics store",
  },
  {
    keywords: ["shoe", "shoes", "sneaker", "sneakers", "boots"],
    category: "shoes",
    store_type: "shoe store",
  },
  {
    keywords: ["clothes", "clothing", "shirt", "jacket", "dress"],
    category: "clothes",
    store_type: "clothing store",
  },
  {
    keywords: ["fruit", "vegetable", "grocery", "milk", "bread", "food"],
    category: "food",
    store_type: "supermarket",
  },
  {
    keywords: ["furniture", "desk", "chair", "sofa", "bed"],
    category: "furniture",
    store_type: "furniture store",
  },
  {
    keywords: ["book", "books", "textbook", "novel"],
    category: "books",
    store_type: "book store",
  },
  {
    keywords: ["cosmetic", "cosmetics", "makeup", "skincare"],
    category: "cosmetics",
    store_type: "cosmetics store",
  },
];

function serviceError(code) {
  const err = new Error(code);
  err.code = code;
  return err;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function makeCacheKey(kind, parts) {
  return `${kind}:${parts.map(normalizeText).join(":")}`;
}

function roundCoordinate(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue.toFixed(2) : "";
}

async function readCache(cacheKey) {
  try {
    const cached = await ShoppingCache.findOne({
      cacheKey,
      expiresAt: { $gt: new Date() },
    }).lean();

    return cached?.payload || null;
  } catch (err) {
    console.warn("Shopping cache read failed:", err.message);
    return null;
  }
}

async function writeCache(cacheKey, kind, payload, ttlMs) {
  try {
    await ShoppingCache.findOneAndUpdate(
      { cacheKey },
      {
        cacheKey,
        kind,
        payload,
        expiresAt: new Date(Date.now() + ttlMs),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    console.warn("Shopping cache write failed:", err.message);
  }
}

function cleanJsonText(text) {
  return String(text || "").replace(/```json/g, "").replace(/```/g, "").trim();
}

function parsePriceToNumber(price) {
  const match = String(price || "").replace(/,/g, "").match(/[\d.]+/);
  return match ? Number(match[0]) : null;
}

function getSearchTerms(text) {
  return normalizeText(text)
    .split(" ")
    .map((term) => term.replace(/[^a-z0-9.-]/gi, ""))
    .filter((term) => term.length > 1 && !PRODUCT_STOPWORDS.has(term));
}

function extractFeatureTerms(userInput) {
  const text = normalizeText(userInput);

  return FEATURE_KEYWORDS.filter((keyword) => text.includes(keyword));
}

function extractBudget(userInput) {
  const text = normalizeText(userInput);
  const patterns = [
    /(?:under|below|less than|max|budget)\s*\$?\s*(\d+(?:\.\d+)?)/i,
    /\$?\s*(\d+(?:\.\d+)?)\s*(?:nzd|dollars?)?\s*(?:or less)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return Number(match[1]);
    }
  }

  return null;
}

function inferIntentFromRules(userInput) {
  const text = normalizeText(userInput);
  const matchedRule = CATEGORY_RULES.find((rule) =>
    rule.keywords.some((keyword) => text.includes(keyword))
  );

  if (!matchedRule) {
    return null;
  }

  return {
    shopping_query: userInput,
    category: matchedRule.category,
    store_type: matchedRule.store_type,
    budget_nzd: extractBudget(userInput),
    preferred_features: CATEGORY_RULES.flatMap((rule) => rule.keywords).filter(
      (keyword) => text.includes(keyword)
    ).concat(extractFeatureTerms(userInput)),
    reasoning: "Matched by local category rules for faster intent parsing.",
    confidence: 0.85,
    source: "rules",
  };
}

function normalizeIntent(parsed, userInput) {
  const ruleFallback = inferIntentFromRules(userInput);
  const parsedFeatures = Array.isArray(parsed.preferred_features)
    ? parsed.preferred_features
    : ruleFallback?.preferred_features || [];

  return {
    shopping_query: parsed.shopping_query || userInput,
    category: parsed.category || ruleFallback?.category || "shopping",
    store_type: parsed.store_type || ruleFallback?.store_type || "store",
    budget_nzd:
      Number.isFinite(Number(parsed.budget_nzd))
        ? Number(parsed.budget_nzd)
        : ruleFallback?.budget_nzd ?? null,
    preferred_features: [...new Set([...parsedFeatures, ...extractFeatureTerms(userInput)])],
    reasoning:
      parsed.reasoning ||
      ruleFallback?.reasoning ||
      "Parsed shopping intent from the user request.",
    confidence:
      Number.isFinite(Number(parsed.confidence)) ? Number(parsed.confidence) : 0.6,
    source: parsed.source || "llm",
  };
}

async function parseShoppingIntent(userInput) {
  const cacheKey = makeCacheKey("intent", [userInput]);
  const cachedIntent = await readCache(cacheKey);

  if (cachedIntent) {
    return {
      ...cachedIntent,
      source: `${cachedIntent.source || "intent"}_cache`,
    };
  }

  const ruleIntent = inferIntentFromRules(userInput);

  if (ruleIntent?.confidence >= 0.85) {
    await writeCache(cacheKey, "intent", ruleIntent, INTENT_CACHE_TTL_MS);
    return ruleIntent;
  }

  console.time("deepseek_shopping_parse");

  const response = await deepseek.chat.completions.create({
    model: "deepseek-chat",
    temperature: 0,
    messages: [
      {
        role: "system",
        content: `
You are an AI shopping agent.
Understand user shopping intent.
Return JSON only.

Format:
{
  "shopping_query": "...",
  "category": "...",
  "store_type": "...",
  "budget_nzd": number or null,
  "preferred_features": ["..."],
  "reasoning": "...",
  "confidence": number from 0 to 1
}

Rules:
- category can be anything: laptop, fruit, clothes, furniture, cosmetics, books, toys, shoes, food, etc.
- store_type should match the shopping category.
- Extract budget_nzd when the user says a max price or budget.
- preferred_features should include concrete attributes such as lightweight, gaming, waterproof, organic, cheap, premium.

Examples:
Laptop -> electronics store
Fruit -> supermarket
Shoes -> shoe store
Furniture -> furniture store
Books -> book store
Clothes -> clothing store
`,
      },
      {
        role: "user",
        content: userInput,
      },
    ],
  });

  console.timeEnd("deepseek_shopping_parse");

  const cleaned = cleanJsonText(response.choices[0].message.content);
  let parsed;

  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.log("JSON parse failed:", cleaned);
    throw serviceError("AGENT_JSON_PARSE_FAILED");
  }

  const intent = normalizeIntent(parsed, userInput);
  await writeCache(cacheKey, "intent", intent, INTENT_CACHE_TTL_MS);

  return intent;
}

async function searchGoogleShoppingLive(query) {
  return new Promise((resolve, reject) => {
    serpSearch.json(
      {
        engine: "google_shopping",
        q: query,
        google_domain: "google.com",
        gl: "nz",
        hl: "en",
        num: PRODUCT_RESULT_LIMIT,
      },
      (data) => {
        if (data.error) {
          reject(data.error);
          return;
        }

        resolve((data.shopping_results || []).slice(0, PRODUCT_RESULT_LIMIT));
      }
    );
  });
}

async function searchGoogleShopping(query) {
  const cacheKey = makeCacheKey("products", [query]);
  const cachedProducts = await readCache(cacheKey);

  if (cachedProducts) {
    return cachedProducts;
  }

  const products = await searchGoogleShoppingLive(query);
  await writeCache(cacheKey, "products", products, PRODUCT_CACHE_TTL_MS);

  return products;
}

async function searchNearbyStoresLive(lat, lng, storeType) {
  const response = await axios.get(
    "https://maps.googleapis.com/maps/api/place/textsearch/json",
    {
      params: {
        query: storeType,
        key: GOOGLE_API_KEY,
        location: `${lat},${lng}`,
        radius: 10000,
      },
    }
  );

  return (response.data.results || []).slice(0, STORE_RESULT_LIMIT).map((place) => ({
    name: place.name,
    rating: place.rating,
    address: place.formatted_address,
    location: place.geometry.location,
    photo_url: place.photos?.[0]
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${place.photos[0].photo_reference}&key=${GOOGLE_API_KEY}`
      : null,
  }));
}

async function searchNearbyStores(lat, lng, storeType) {
  const cacheKey = makeCacheKey("stores", [
    storeType,
    roundCoordinate(lat),
    roundCoordinate(lng),
  ]);
  const cachedStores = await readCache(cacheKey);

  if (cachedStores) {
    return cachedStores;
  }

  const stores = await searchNearbyStoresLive(lat, lng, storeType);
  await writeCache(cacheKey, "stores", stores, STORE_CACHE_TTL_MS);

  return stores;
}

async function computeDistances(lat, lng, stores) {
  if (!stores.length) {
    return [];
  }

  const response = await axios.post(
    "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
    {
      origins: [
        {
          waypoint: {
            location: {
              latLng: {
                latitude: parseFloat(lat),
                longitude: parseFloat(lng),
              },
            },
          },
        },
      ],
      destinations: stores.map((store) => ({
        waypoint: {
          location: {
            latLng: {
              latitude: store.location.lat,
              longitude: store.location.lng,
            },
          },
        },
      })),
      travelMode: "DRIVE",
    },
    {
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": "originIndex,destinationIndex,distanceMeters,duration",
      },
    }
  );

  return (response.data || []).sort((a, b) => {
    return (a.destinationIndex ?? 0) - (b.destinationIndex ?? 0);
  });
}

function distanceToKm(distanceText) {
  const match = String(distanceText || "").match(/[\d.]+/);
  return match ? Number(match[0]) : DISTANCE_FALLBACK_KM;
}

function buildMerchantMeta(store, distance) {
  const distanceText = distance?.distanceMeters
    ? `${(distance.distanceMeters / 1000).toFixed(1)} km`
    : null;

  const durationText = distance?.duration
    ? `${Math.round(parseInt(distance.duration.replace("s", ""), 10) / 60)} mins`
    : null;

  return {
    distanceText,
    durationText,
    merchant: {
      name: store?.name || null,
      address: store?.address || null,
      rating: store?.rating ?? null,
      photo_url: store?.photo_url || null,
      location: store?.location || null,
      distance_text: distanceText,
      duration_text: durationText,
    },
  };
}

function getProductScoreBreakdown(result, intent) {
  const title = normalizeText(result.product_title);
  const source = normalizeText(result.source);
  const category = normalizeText(intent.category);
  const queryTerms = [...new Set(getSearchTerms(intent.shopping_query))];
  const featureTerms = [
    ...new Set((intent.preferred_features || []).map(normalizeText).filter(Boolean)),
  ];
  const matchedQueryTerms = queryTerms.filter((term) => title.includes(term));
  const matchedFeatureTerms = featureTerms.filter((term) => title.includes(term));
  const priceNumber = parsePriceToNumber(result.product_price);
  const budget = intent.budget_nzd;
  const queryCoverage = queryTerms.length
    ? matchedQueryTerms.length / queryTerms.length
    : 0;
  const featureCoverage = featureTerms.length
    ? matchedFeatureTerms.length / featureTerms.length
    : 0;
  const categoryMatch = category && title.includes(category) ? 1 : 0;
  const exactPhraseMatch = title.includes(normalizeText(intent.shopping_query)) ? 1 : 0;
  const productMatchScore =
    queryCoverage * 5 +
    featureCoverage * 2 +
    categoryMatch * 1.5 +
    exactPhraseMatch * 1;
  const budgetScore =
    budget && priceNumber
      ? priceNumber <= budget
        ? 1.8 - Math.min(priceNumber / budget, 1) * 0.8
        : -Math.min((priceNumber - budget) / budget, 1.5) * 3
      : priceNumber
        ? 0.2
        : -0.2;
  const rating = Number(result.store_rating || 0);
  const distanceKm = distanceToKm(result.distance_text);
  const merchantScore =
    Math.min(rating, 5) * 0.12 +
    Math.max(0, 0.5 - distanceKm * 0.03);
  const sourceScore = source ? 0.25 : 0;
  const lowMatchPenalty = queryTerms.length && matchedQueryTerms.length === 0 ? -2.5 : 0;

  return {
    matchedQueryTerms,
    matchedFeatureTerms,
    productMatchScore,
    budgetScore,
    merchantScore,
    sourceScore,
    lowMatchPenalty,
    total:
      productMatchScore +
      budgetScore +
      merchantScore +
      sourceScore +
      lowMatchPenalty,
  };
}

function scoreProductResult(result, intent) {
  return getProductScoreBreakdown(result, intent).total;
}

function rankShoppingResults(results, intent) {
  return results
    .map((result, index) => ({
      ...result,
      __original_index: index,
      match_score: Number(scoreProductResult(result, intent).toFixed(3)),
    }))
    .sort((a, b) => b.match_score - a.match_score || a.__original_index - b.__original_index)
    .map((result, index) => {
      const { __original_index, ...cleanResult } = result;

      return {
        ...cleanResult,
        compare_rank: index + 1,
        product_match: getProductScoreBreakdown(cleanResult, intent),
        compare_reason: buildCompareReason(cleanResult, intent),
        best_for: buildBestFor(cleanResult, intent),
      };
    });
}

function buildCompareReason(result, intent) {
  const breakdown = getProductScoreBreakdown(result, intent);
  const details = [];

  if (breakdown.matchedQueryTerms.length) {
    details.push(`the title matches ${breakdown.matchedQueryTerms.slice(0, 4).join(", ")}`);
  }

  if (breakdown.matchedFeatureTerms.length) {
    details.push(`it includes requested features like ${breakdown.matchedFeatureTerms.slice(0, 3).join(", ")}`);
  }

  if (result.product_price) {
    details.push(`the listed price is ${result.product_price}`);
  }

  const priceNumber = parsePriceToNumber(result.product_price);
  if (intent.budget_nzd && priceNumber && priceNumber <= intent.budget_nzd) {
    details.push(`it stays within your NZ$${intent.budget_nzd} budget`);
  } else if (intent.budget_nzd && priceNumber && priceNumber > intent.budget_nzd) {
    details.push(`it is above your NZ$${intent.budget_nzd} budget, so it is ranked mainly on product fit`);
  }

  if (result.source) {
    details.push(`it is listed by ${result.source}`);
  }

  if (result.nearby_store && result.distance_text) {
    details.push(`nearby pickup may be available at ${result.nearby_store}, about ${result.distance_text} away`);
  }

  const detailSentence = details.length
    ? details.slice(0, 2).join("; ")
    : "it has strong product-title and budget fit";

  return `Good ${intent.category || "product"} option. ${detailSentence}.`;
}

function buildBestFor(result, intent) {
  const breakdown = getProductScoreBreakdown(result, intent);

  if (breakdown.matchedFeatureTerms.length) {
    return "feature match";
  }

  if (breakdown.matchedQueryTerms.length >= 2) {
    return "product match";
  }

  if (intent.budget_nzd && parsePriceToNumber(result.product_price) <= intent.budget_nzd) {
    return "budget fit";
  }

  if (result.distance_text && distanceToKm(result.distance_text) < 3) {
    return "nearest pickup";
  }

  return "overall match";
}

async function searchShopping({ userInput, lat, lng }) {
  console.time("shopping_total");

  console.time("shopping_intent");
  const parsed = await parseShoppingIntent(userInput);
  console.timeEnd("shopping_intent");

  console.log("Shopping intent:", parsed);

  console.time("parallel_search_apis");

  const [stores, products] = await Promise.all([
    (async () => {
      console.time("nearby_stores");

      const result = await searchNearbyStores(lat, lng, parsed.store_type);

      console.timeEnd("nearby_stores");

      return result;
    })(),
    (async () => {
      console.time("google_shopping");

      const result = await searchGoogleShopping(parsed.shopping_query);

      console.timeEnd("google_shopping");

      return result;
    })(),
  ]);

  console.timeEnd("parallel_search_apis");

  console.log("Stores:", stores.length);

  console.time("distance_matrix");
  const matrix = await computeDistances(lat, lng, stores);
  console.timeEnd("distance_matrix");

  const limitedProducts = products.slice(0, PRODUCT_RESULT_LIMIT);
  console.log("Products:", limitedProducts.length);

  console.time("shopping_result_format");

  const finalResults = limitedProducts.map((product, index) => {
    const store = stores.length ? stores[index % stores.length] : null;
    const d = matrix.length ? matrix[index % matrix.length] : null;
    const { distanceText, durationText, merchant } = buildMerchantMeta(store, d);

    return {
      product_title: product.title,
      product_price: product.price,
      product_image: product.thumbnail,
      product_link: product.link,
      source: product.source,

      nearby_store: store?.name,
      store_address: store?.address,
      store_rating: store?.rating,
      store_photo: store?.photo_url,
      store_location: store?.location || null,

      merchant,

      distance_text: distanceText,
      duration_text: durationText,
      agent_reasoning: parsed.reasoning,
      intent: {
        category: parsed.category,
        store_type: parsed.store_type,
        budget_nzd: parsed.budget_nzd,
        confidence: parsed.confidence,
        source: parsed.source,
      },
    };
  });

  const rankedResults = rankShoppingResults(finalResults, parsed);

  console.timeEnd("shopping_result_format");
  console.timeEnd("shopping_total");

  return rankedResults;
}

module.exports = {
  searchShopping,
  searchGoogleShopping,
  searchNearbyStores,
  computeDistances,
  parseShoppingIntent,
  rankShoppingResults,
};
