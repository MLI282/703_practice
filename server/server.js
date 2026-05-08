const express = require("express");
const cors = require("cors");

const homeController = require("./controllers/homeController");
const placesController = require("./controllers/placesController");
const routeController = require("./controllers/routeController");
const shoppingController = require("./controllers/shoppingController");
const agentCompareController = require("./controllers/agentCompareController");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", homeController.index);
app.get("/search", placesController.search);
app.get("/reverse-geocode", placesController.reverseGeocode);
app.get("/route", routeController.getRoute);
app.get("/shop-search", shoppingController.search);
app.get("/agent-search", agentCompareController.search);

app.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});
