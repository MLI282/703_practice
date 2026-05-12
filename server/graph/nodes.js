const placesService = require("../services/placesService");
const routeService = require("../services/routeService");
const shoppingService = require("../services/shoppingService");

function normalizeIntentNode(state) {
  console.time("normalizeIntentNode");

  const intent = state.intent || "unknown";

  console.timeEnd("normalizeIntentNode");

  return {
    intent,
  };
}

async function searchPlacesNode(state) {
  console.time("searchPlacesNode");

  const results = await placesService.searchPlaces({
    lat: state.lat,
    lng: state.lng,
    userInput: state.userInput,
  });

  console.timeEnd("searchPlacesNode");

  return {
    results,
  };
}

async function reverseGeocodeNode(state) {
  console.time("reverseGeocodeNode");

  const results = await placesService.reverseGeocode({
    lat: state.lat,
    lng: state.lng,
  });

  console.timeEnd("reverseGeocodeNode");

  return {
    results,
  };
}

async function routeNode(state) {
  console.time("routeNode");

  const results = await routeService.getRoute(
    state.routeQuery || state.userInput
  );

  console.timeEnd("routeNode");

  return {
    results,
  };
}

async function shoppingNode(state) {
  console.time("shoppingNode");

  const results = await shoppingService.searchShopping({
    userInput: state.userInput,
    lat: state.lat,
    lng: state.lng,
  });

  console.timeEnd("shoppingNode");

  return {
    results,
  };
}

function unsupportedIntentNode(state) {
  console.time("unsupportedIntentNode");

  const result = {
    error: {
      code: "UNSUPPORTED_INTENT",
      message: `Unsupported graph intent: ${state.intent}`,
    },
  };

  console.timeEnd("unsupportedIntentNode");

  return result;
}

module.exports = {
  normalizeIntentNode,
  searchPlacesNode,
  reverseGeocodeNode,
  routeNode,
  shoppingNode,
  unsupportedIntentNode,
};