const placesService = require("../services/placesService");

async function search(req, res) {
  const lat = req.query.lat;
  const lng = req.query.lng;
  const userInput = req.query.q;

  try {
    const results = await placesService.searchPlaces({
      lat,
      lng,
      userInput,
    });

    res.json(results);
  } catch (err) {
    if (err.code === "AI_PARSE_FAILED") {
      return res.status(400).json({ error: "AI parse failed" });
    }

    console.error("Search error:", err?.response?.data || err);
    res.status(500).json({ error: "Failed to fetch" });
  }
}

async function reverseGeocode(req, res) {
  const lat = req.query.lat;
  const lng = req.query.lng;

  try {
    const result = await placesService.reverseGeocode({ lat, lng });
    res.json(result);
  } catch (err) {
    if (err.code === "MISSING_LAT_LNG") {
      return res.status(400).json({
        error: "Missing lat/lng",
      });
    }

    if (err.code === "NO_ADDRESS_FOUND") {
      return res.status(404).json({
        error: "No address found",
      });
    }

    console.error("Reverse Geocode error:", err?.response?.data || err);
    res.status(500).json({
      error: "Reverse geocode failed",
    });
  }
}

module.exports = {
  search,
  reverseGeocode,
};

