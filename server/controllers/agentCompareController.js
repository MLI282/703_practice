const { invokeLiveCompareGraph } = require("../graph");

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
