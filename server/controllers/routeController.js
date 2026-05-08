const routeService = require("../services/routeService");

async function getRoute(req, res) {
  const userInput = req.query.q;

  try {
    const result = await routeService.getRoute(userInput);
    res.json(result);
  } catch (err) {
    if (err.code === "NO_ROUTE_FOUND") {
      return res.status(400).json({ error: "No route found" });
    }

    console.error("Route error:", err);
    res.status(500).json({ error: "Route failed" });
  }
}

module.exports = {
  getRoute,
};
