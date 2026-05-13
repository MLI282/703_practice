const shoppingService = require("../services/shoppingService");
const { UserHistory } = require("../models");

function toNumberOrNull(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function createResultSummary(results) {
  return results
    .slice(0, 3)
    .map((item) => item.product_title)
    .filter(Boolean)
    .join(", ");
}

function createHistoryResults(results) {
  return results.slice(0, 10).map((item) => ({
    title: item.product_title,
    type: "product",
    imageUrl: item.product_image || "",
    productImage: item.product_image || null,
    rank: item.compare_rank,
    reason: item.compare_reason,
    bestFor: item.best_for,
    rating: item.store_rating ?? item.merchant?.rating ?? null,
    price: item.product_price || null,
    address: item.nearby_store || item.merchant?.name || null,
    merchant: {
      name: item.nearby_store || item.merchant?.name || null,
      address: item.store_address || item.merchant?.address || null,
      rating: item.store_rating ?? item.merchant?.rating ?? null,
      photoUrl: item.store_photo || item.merchant?.photo_url || null,
      location: item.store_location || item.merchant?.location || null,
      distanceText: item.distance_text || item.merchant?.distance_text || null,
      durationText: item.duration_text || item.merchant?.duration_text || null,
    },
    source: item.source || null,
    distanceText: item.distance_text || null,
    durationText: item.duration_text || null,
    matchScore: item.match_score ?? null,
  }));
}

async function saveShoppingHistory(req, results) {
  if (!req.user?._id) {
    return;
  }

  try {
    await UserHistory.create({
      user: req.user._id,
      type: "shopping",
      query: req.query.q,
      location: {
        lat: toNumberOrNull(req.query.lat),
        lng: toNumberOrNull(req.query.lng),
      },
      requestMeta: {
        endpoint: "/shop-search",
        resultCount: results.length,
      },
      resultSummary: createResultSummary(results),
      results: createHistoryResults(results),
    });
  } catch (err) {
    console.error("Save shopping history error:", err);
  }
}

async function search(req, res) {
  const userInput = req.query.q;
  const lat = req.query.lat;
  const lng = req.query.lng;

  try {
    const results = await shoppingService.searchShopping({
      userInput,
      lat,
      lng,
    });

    res.json(results);

    saveShoppingHistory(req, results);
  } catch (err) {
    if (err.code === "AGENT_JSON_PARSE_FAILED") {
      return res.status(400).json({
        error: "Agent JSON parse failed",
      });
    }

    console.error("❌ Shopping Agent Error:", err?.response?.data || err);
    res.status(500).json({
      error: "Shopping agent failed",
    });
  }
}

module.exports = {
  search,
};
