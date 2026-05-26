const routeService = require("../services/routeService");
const { requireModelAccess } = require("../services/modelAccessService");

async function getRoute(req, res) {
  const userInput = req.query.q;
  const llmModel = requireModelAccess(req, res);

  if (!llmModel) {
    return;
  }

  try {
    const result = await routeService.getRoute(userInput, llmModel);
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
