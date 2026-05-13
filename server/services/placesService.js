const axios = require("axios");
const deepseek = require("../config/deepseekClient");
const { GOOGLE_API_KEY } = require("../config/apiKeys");
const { ShoppingCache } = require("../models");

const DEFAULT_DISTANCE_KM = 20;
const PLACE_CACHE_VERSION = "place-ranking-v6-soft-distance";
const PLACE_INTENT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PLACE_RESULTS_CACHE_TTL_MS = 30 * 60 * 1000;
const PLACE_TYPE_SYNONYMS = {
  restaurant: ["restaurant", "dining", "food", "meal"],
  cafe: ["cafe", "coffee", "tea"],
  supermarket: ["supermarket", "grocery", "groceries", "food"],
  library: ["library", "study", "quiet"],
  museum: ["museum", "gallery", "exhibition"],
  park: ["park", "walk", "outdoor", "nature"],
  gym: ["gym", "fitness", "workout"],
  pharmacy: ["pharmacy", "chemist", "medicine"],
  hotel: ["hotel", "accommodation", "stay"],
  parking: ["parking", "car park"],
};

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

function stableJson(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return JSON.stringify(value);
  }

  return JSON.stringify(
    Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = value[key];
        return acc;
      }, {})
  );
}

async function readCache(cacheKey) {
  try {
    const cached = await ShoppingCache.findOne({
      cacheKey,
      expiresAt: { $gt: new Date() },
    }).lean();

    return cached?.payload || null;
  } catch (err) {
    console.warn("Place cache read failed:", err.message);
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
    console.warn("Place cache write failed:", err.message);
  }
}

function getDistanceKm(place) {
  if (Number.isFinite(Number(place.distance_value))) {
    return Number(place.distance_value) / 1000;
  }

  const match = String(place.distance_text || "").match(/[\d.]+/);
  if (!match) {
    return DEFAULT_DISTANCE_KM;
  }

  const distanceText = normalizeText(place.distance_text);
  return distanceText.includes(" m") ? Number(match[0]) / 1000 : Number(match[0]);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getIntentTerms(cond) {
  const features = Array.isArray(cond.features) ? cond.features : [];
  const type = cond.type || cond.place_type || "";
  const typeSynonyms = PLACE_TYPE_SYNONYMS[normalizeText(type)] || [];

  return [
    cond.keywords,
    cond.cuisine,
    type,
    ...typeSynonyms,
    ...features,
  ]
    .filter(Boolean)
    .flatMap((value) => normalizeText(value).split(" "))
    .filter((term) => term.length > 2);
}

function priceMatchScore(place, cond) {
  if (!cond.price || place.price_level === null || place.price_level === undefined) {
    return 0.35;
  }

  if (cond.price === "cheap") {
    return place.price_level <= 2 ? 1 : -0.7;
  }

  if (cond.price === "expensive") {
    return place.price_level >= 3 ? 0.8 : -0.2;
  }

  return place.price_level >= 1 && place.price_level <= 3 ? 0.7 : 0.2;
}

function getRankingFocus(cond) {
  const explicitFocus = Array.isArray(cond.ranking_focus)
    ? cond.ranking_focus.map(normalizeText)
    : [];
  const text = normalizeText(
    [
      cond.userInput,
      cond.use_case,
      cond.keywords,
      ...(Array.isArray(cond.features) ? cond.features : []),
      ...explicitFocus,
    ].filter(Boolean).join(" ")
  );
  const focus = new Set(explicitFocus);

  if (/near|nearby|nearest|closest|walking|distance|location|position|close/.test(text)) {
    focus.add("distance");
  }

  if (/rating|review|rated|popular|best|quality|score/.test(text)) {
    focus.add("rating");
  }

  if (/cheap|budget|affordable|price|value/.test(text)) {
    focus.add("price");
  }

  if (/open now|open/.test(text)) {
    focus.add("open_now");
  }

  if (/match|specific|exact|quiet|kid|family|study|feature/.test(text)) {
    focus.add("match");
  }

  return [...focus];
}

function getPlaceScoreWeights(cond) {
  const focus = getRankingFocus(cond);
  const weights = {
    term: 1,
    rating: 1,
    confidence: 1,
    distance: 1,
    price: 1,
    open: 1,
  };

  if (focus.includes("distance")) {
    weights.distance = 3.2;
    weights.term = 0.55;
    weights.rating = 0.45;
    weights.confidence = 0.6;
  }

  if (focus.includes("rating")) {
    weights.rating = Math.max(weights.rating, 1.6);
    weights.confidence = 1.4;
    weights.distance = Math.max(weights.distance, 0.85);
  }

  if (focus.includes("price")) {
    weights.price = 1.7;
    weights.distance = Math.max(weights.distance, 0.9);
  }

  if (focus.includes("open_now")) {
    weights.open = 1.8;
  }

  if (focus.includes("match")) {
    weights.term = Math.max(weights.term, 1.5);
  }

  return weights;
}

function scorePlace(place, cond) {
  const text = normalizeText(`${place.name} ${place.address}`);
  const terms = getIntentTerms(cond);
  const uniqueTerms = [...new Set(terms)];
  const matchedTerms = uniqueTerms.filter((term) => text.includes(term)).length;
  const weights = getPlaceScoreWeights(cond);
  const termScore = uniqueTerms.length
    ? (matchedTerms / uniqueTerms.length) * 3
    : 0.8;
  const ratingScore = Number(place.rating || 0) / 5 * 2;
  const reviewCount = Number(place.user_ratings_total || 0);
  const confidenceScore = clamp(Math.log10(reviewCount + 1) / 3, 0, 1);
  const distanceKm = getDistanceKm(place);
  const targetDistance = Number(cond.max_distance_km) || 10;
  const distanceScore = clamp(1 - distanceKm / Math.max(targetDistance, 1), 0, 1) * 2;
  const openScore =
    cond.open_now === true
      ? place.open_now === true
        ? 1
        : -1
      : place.open_now === true
        ? 0.25
        : 0;

  return Number(
    (
      termScore * weights.term +
      ratingScore * weights.rating +
      confidenceScore * weights.confidence +
      distanceScore * weights.distance +
      priceMatchScore(place, cond) * weights.price +
      openScore * weights.open
    ).toFixed(3)
  );
}

function buildPlaceMatchReason(place, cond) {
  const terms = getIntentTerms(cond);
  const text = normalizeText(`${place.name} ${place.address}`);
  const matchedTerms = [...new Set(terms)].filter((term) => text.includes(term));
  const focus = getRankingFocus(cond);
  const useCase = cond.use_case || cond.keywords || cond.type || "your request";
  const details = [];

  if (place.distance_text) {
    details.push(`it is ${place.distance_text} away`);
  }

  if (place.rating) {
    const reviewText = place.user_ratings_total
      ? ` from ${place.user_ratings_total} reviews`
      : "";
    details.push(`it has a ${place.rating} rating${reviewText}`);
  }

  if (cond.open_now === true && place.open_now === true) {
    details.push("it is open now");
  }

  if (cond.price && place.price_level !== null && place.price_level !== undefined) {
    const priceText =
      place.price_level <= 1
        ? "low-cost"
        : place.price_level === 2
          ? "moderately priced"
          : "higher-end";
    details.push(`it looks ${priceText}`);
  }

  if (matchedTerms.length) {
    details.push(`its name or address lines up with ${matchedTerms.slice(0, 3).join(", ")}`);
  }

  const detailSentence = details.length
    ? details.slice(0, 2).join("; ")
    : "it balances relevance, distance, and rating";

  if (focus.includes("distance")) {
    return `Good nearby fit for ${useCase}: ${detailSentence}.`;
  }

  if (focus.includes("rating")) {
    return `Strong quality fit for ${useCase}: ${detailSentence}.`;
  }

  if (focus.includes("price")) {
    return `Good value fit for ${useCase}: ${detailSentence}.`;
  }

  if (focus.includes("open_now")) {
    return `Useful right now: ${detailSentence}.`;
  }

  return `Good fit for ${useCase}: ${detailSentence}.`;
}

function buildPlaceBestFor(place, cond) {
  if (cond.open_now === true && place.open_now === true) {
    return "open now";
  }

  if (cond.price === "cheap" && place.price_level !== null && place.price_level <= 2) {
    return "budget friendly";
  }

  if (getDistanceKm(place) < 2) {
    return "nearest option";
  }

  if (place.rating >= 4.5) {
    return "highly rated";
  }

  return "overall match";
}

function filterPlaces(places, cond) {
  return places.filter((p) => {
    if (cond.price === "cheap" && p.price_level !== null && p.price_level > 2) {
      return false;
    }

    if (
      cond.price === "expensive" &&
      p.price_level !== null &&
      p.price_level < 3
    ) {
      return false;
    }

    if (cond.open_now === true && p.open_now === false) {
      return false;
    }

    return true;
  });
}

function buildParsedFromPlaceIntent(placeIntent) {
  if (!placeIntent) {
    return null;
  }

  const features = Array.isArray(placeIntent.features)
    ? placeIntent.features.join(" ")
    : "";
  const keywords = [
    placeIntent.keywords,
    features,
    placeIntent.food_cuisine,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    type: placeIntent.place_type || "local place",
    cuisine: placeIntent.food_cuisine || null,
    keywords: keywords || null,
    price: placeIntent.price || null,
    max_distance_km: placeIntent.max_distance_km || null,
    open_now: placeIntent.open_now ?? null,
    features: Array.isArray(placeIntent.features) ? placeIntent.features : [],
    ranking_focus: Array.isArray(placeIntent.ranking_focus)
      ? placeIntent.ranking_focus
      : [],
  };
}

async function searchPlaces({ lat, lng, userInput, placeIntent }) {
  let parsed = buildParsedFromPlaceIntent(placeIntent);

  if (!parsed) {
    const cachedIntent = await readCache(makeCacheKey("place_intent", [userInput]));

    if (cachedIntent) {
      parsed = cachedIntent;
    }
  }

  if (!parsed) {
    const aiResponse = await deepseek.chat.completions.create({
    model: "deepseek-chat",
    messages: [
      {
        role: "system",
        content: `
You are a local place search assistant. Extract the user's request into JSON only.

Return exactly this JSON shape:
{
  "type": "restaurant | cafe | supermarket | etc",
  "cuisine": "italian | chinese | null",
  "keywords": "pasta | coffee | null",
  "price": "cheap | medium | expensive | null",
  "max_distance_km": number | null,
  "ranking_focus": ["distance" | "rating" | "price" | "open_now" | "match"]
}

Rules:
- Return valid JSON only.
- Do not explain.
- Do not include extra text.
`,
      },
      {
        role: "user",
        content: userInput,
      },
    ],
  });

  try {
    const raw = aiResponse.choices[0].message.content
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    parsed = JSON.parse(raw);
    await writeCache(
      makeCacheKey("place_intent", [userInput]),
      "place_intent",
      parsed,
      PLACE_INTENT_CACHE_TTL_MS
    );
  } catch (e) {
    console.log("Raw AI output:", aiResponse.choices[0].message.content);
    throw serviceError("AI_PARSE_FAILED");
  }
  }

  console.log("Parsed place intent:", parsed);

  parsed = {
    ...parsed,
    userInput,
    ranking_focus: getRankingFocus({
      ...parsed,
      userInput,
      ranking_focus: parsed.ranking_focus,
    }),
  };

  const query = `
      ${parsed.keywords || ""}
      ${parsed.cuisine || ""}
      ${parsed.type || ""}
    `;

  let radius = 5000;
  if (parsed.max_distance_km) {
    radius = parsed.max_distance_km * 1000;
  }
  if (radius > 50000) radius = 50000;

  const resultsCacheKey = makeCacheKey("places", [
    PLACE_CACHE_VERSION,
    query,
    roundCoordinate(lat),
    roundCoordinate(lng),
    radius,
    stableJson({
      features: parsed.features || [],
      max_distance_km: parsed.max_distance_km || null,
      open_now: parsed.open_now ?? null,
      price: parsed.price || null,
      ranking_focus: parsed.ranking_focus || [],
    }),
  ]);
  const cachedResults = await readCache(resultsCacheKey);

  if (cachedResults) {
    return cachedResults;
  }

  const response = await axios.get(
    "https://maps.googleapis.com/maps/api/place/textsearch/json",
    {
      params: {
        query: query,
        key: GOOGLE_API_KEY,
        location: `${lat},${lng}`,
        radius: radius,
      },
    }
  );

  if (!response.data.results.length) {
    await writeCache(
      resultsCacheKey,
      "places",
      [],
      PLACE_RESULTS_CACHE_TTL_MS
    );
    return [];
  }

  const places = response.data.results.slice(0, 10).map((place) => ({
    name: place.name,
    rating: place.rating,
    user_ratings_total: place.user_ratings_total ?? null,
    address: place.formatted_address,
    price_level: place.price_level ?? null,
    open_now: place.opening_hours?.open_now ?? null,
    place_types: place.types || [],
    location: place.geometry.location,
    photo_reference: place.photos?.[0]?.photo_reference ?? null,
  }));

  const originLat = parseFloat(lat);
  const originLng = parseFloat(lng);

  const routeMatrixRes = await axios.post(
    "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
    {
      origins: [
        {
          waypoint: {
            location: {
              latLng: {
                latitude: originLat,
                longitude: originLng,
              },
            },
          },
        },
      ],
      destinations: places.map((p) => ({
        waypoint: {
          location: {
            latLng: {
              latitude: p.location.lat,
              longitude: p.location.lng,
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

  const matrix = routeMatrixRes.data;

  const placesWithDistance = places.map((place, index) => {
    const d = matrix.find((m) => m.destinationIndex === index);

    const distanceMeters = d?.distanceMeters ?? null;
    const durationSeconds = d?.duration
      ? parseInt(d.duration.replace("s", ""))
      : null;

    const photoUrl = place.photo_reference
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${place.photo_reference}&key=${GOOGLE_API_KEY}`
      : null;

    return {
      ...place,
      distance_value: distanceMeters,
      duration_value: durationSeconds,
      distance_text:
        distanceMeters != null
          ? distanceMeters < 1000
            ? `${distanceMeters} m`
            : `${(distanceMeters / 1000).toFixed(1)} km`
          : null,
      duration_text:
        durationSeconds != null ? `${Math.round(durationSeconds / 60)} min` : null,
      photo_url: photoUrl,
    };
  });

  let filtered = filterPlaces(placesWithDistance, parsed);

  const distanceFirst = getRankingFocus(parsed).includes("distance");

  filtered = filtered
    .map((place) => ({
      ...place,
      place_match_score: scorePlace(place, parsed),
      compare_reason: buildPlaceMatchReason(place, parsed),
      best_for: buildPlaceBestFor(place, parsed),
    }))
    .sort((a, b) => {
      const distanceDiff =
        (a.distance_value ?? 999999) - (b.distance_value ?? 999999);

      if (distanceFirst && Math.abs(distanceDiff) > 500) {
        return distanceDiff;
      }

      return (
        b.place_match_score - a.place_match_score ||
        (b.rating ?? 0) - (a.rating ?? 0) ||
        distanceDiff
      );
    });

  const results = filtered;

  await writeCache(
    resultsCacheKey,
    "places",
    results,
    PLACE_RESULTS_CACHE_TTL_MS
  );

  console.log("Final place results:", results);

  return results;
}

async function reverseGeocode({ lat, lng }) {
  if (!lat || !lng) {
    throw serviceError("MISSING_LAT_LNG");
  }

  const response = await axios.get(
    "https://maps.googleapis.com/maps/api/geocode/json",
    {
      params: {
        latlng: `${lat},${lng}`,
        key: GOOGLE_API_KEY,
      },
    }
  );

  if (!response.data.results.length) {
    throw serviceError("NO_ADDRESS_FOUND");
  }

  return {
    address: response.data.results[0].formatted_address,
  };
}

module.exports = {
  searchPlaces,
  reverseGeocode,
};
