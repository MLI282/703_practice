const shoppingService = require("../services/shoppingService");

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
