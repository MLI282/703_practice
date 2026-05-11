const { invokeLiveCompareGraph } = require("../graph");
const { UserHistory } = require("../models");

function toNumberOrNull(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function getResultTitle(item) {
  return item.name || item.product_title || item.nearby_store || "";
}

function getResultImageUrl(item) {
  return item.photo_url || item.product_image || item.store_photo || "";
}

function createResultSummary(results) {
  const recommendation = results.find((item) => item.agent_recommendation)
    ?.agent_recommendation;

  if (recommendation) {
    return recommendation;
  }

  return results
    .slice(0, 3)
    .map((item) => getResultTitle(item))
    .filter(Boolean)
    .join(", ");
}

function createHistoryResults(results) {
  return results.slice(0, 10).map((item) => ({
    title: getResultTitle(item),
    type: item.product_title ? "product" : "place",
    imageUrl: getResultImageUrl(item),
    photoUrl: item.photo_url || null,
    productImage: item.product_image || null,
    storePhoto: item.store_photo || null,
    rank: item.compare_rank,
    reason: item.compare_reason,
    bestFor: item.best_for,
    rating: item.rating ?? item.store_rating ?? null,
    price: item.product_price || null,
    address: item.product_title
      ? item.nearby_store || item.merchant?.name || null
      : item.address || item.store_address || null,
    merchant: item.product_title
      ? {
          name: item.nearby_store || item.merchant?.name || null,
          address: item.store_address || item.merchant?.address || null,
          rating: item.store_rating ?? item.merchant?.rating ?? null,
          photoUrl: item.store_photo || item.merchant?.photo_url || null,
          location: item.store_location || item.merchant?.location || null,
          distanceText: item.distance_text || item.merchant?.distance_text || null,
          durationText: item.duration_text || item.merchant?.duration_text || null,
        }
      : null,
    source: item.source || null,
    distanceText: item.distance_text || null,
    durationText: item.duration_text || null,
  }));
}

async function saveSearchHistory(req, result) {
  if (!req.user?._id) {
    return;
  }

  const results = Array.isArray(result.results) ? result.results : [];

  try {
    await UserHistory.create({
      user: req.user._id,
      type: "agent_search",
      query: req.query.q,
      location: {
        lat: toNumberOrNull(req.query.lat),
        lng: toNumberOrNull(req.query.lng),
      },
      requestMeta: {
        endpoint: "/agent-search",
        resultCount: results.length,
      },
      resultSummary: createResultSummary(results),
      results: createHistoryResults(results),
    });
  } catch (err) {
    console.error("Save search history error:", err);
  }
}

async function search(req, res) {
  const userInput = req.query.q;
  const lat = req.query.lat;
  const lng = req.query.lng;

  try {
    const result = await invokeLiveCompareGraph({
      userInput,
      lat,
      lng,
    });

    res.json(result.results);

    saveSearchHistory(req, result);
  } catch (err) {
    if (err.code === "AI_PARSE_FAILED") {
      return res.status(400).json({ error: "AI解析失败" });
    }

    if (err.code === "AGENT_JSON_PARSE_FAILED") {
      return res.status(400).json({
        error: "Agent JSON parse failed",
      });
    }

    console.error("Agent compare error:", err?.response?.data || err);
    res.status(500).json({
      error: "Agent compare failed",
    });
  }
}

module.exports = {
  search,
};
