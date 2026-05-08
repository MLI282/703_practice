const placesService = require("../services/placesService");
const routeService = require("../services/routeService");
const shoppingService = require("../services/shoppingService");

function normalizeIntentNode(state) {
  const intent = state.intent || "unknown";

  return {
    intent,
  };
}

async function searchPlacesNode(state) {
  const results = await placesService.searchPlaces({
    lat: state.lat,
    lng: state.lng,
    userInput: state.userInput,
  });

  return {
    results,
  };
}

async function reverseGeocodeNode(state) {
  const results = await placesService.reverseGeocode({
    lat: state.lat,
    lng: state.lng,
  });

  return {
    results,
  };
}

async function routeNode(state) {
  const results = await routeService.getRoute(state.routeQuery || state.userInput);

  return {
    results,
  };
}

async function shoppingNode(state) {
  const results = await shoppingService.searchShopping({
    userInput: state.userInput,
    lat: state.lat,
    lng: state.lng,
  });

  return {
    results,
  };
}

function unsupportedIntentNode(state) {
  return {
    error: {
      code: "UNSUPPORTED_INTENT",
      message: `Unsupported graph intent: ${state.intent}`,
    },
  };
}

module.exports = {
  normalizeIntentNode,
  searchPlacesNode,
  reverseGeocodeNode,
  routeNode,
  shoppingNode,
  unsupportedIntentNode,
};
