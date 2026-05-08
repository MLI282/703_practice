const { StateGraph, START, END } = require("@langchain/langgraph");
const { ServerGraphState } = require("./state");
const {
  normalizeIntentNode,
  searchPlacesNode,
  reverseGeocodeNode,
  routeNode,
  shoppingNode,
  unsupportedIntentNode,
} = require("./nodes");

const INTENTS = {
  SEARCH_PLACES: "search_places",
  REVERSE_GEOCODE: "reverse_geocode",
  ROUTE: "route",
  SHOPPING: "shopping",
  UNSUPPORTED: "unsupported",
};

function selectWorkflow(state) {
  switch (state.intent) {
    case INTENTS.SEARCH_PLACES:
      return INTENTS.SEARCH_PLACES;
    case INTENTS.REVERSE_GEOCODE:
      return INTENTS.REVERSE_GEOCODE;
    case INTENTS.ROUTE:
      return INTENTS.ROUTE;
    case INTENTS.SHOPPING:
      return INTENTS.SHOPPING;
    default:
      return INTENTS.UNSUPPORTED;
  }
}

function buildServerGraph() {
  return new StateGraph(ServerGraphState)
    .addNode("normalize_intent", normalizeIntentNode)
    .addNode(INTENTS.SEARCH_PLACES, searchPlacesNode)
    .addNode(INTENTS.REVERSE_GEOCODE, reverseGeocodeNode)
    .addNode(INTENTS.ROUTE, routeNode)
    .addNode(INTENTS.SHOPPING, shoppingNode)
    .addNode(INTENTS.UNSUPPORTED, unsupportedIntentNode)
    .addEdge(START, "normalize_intent")
    .addConditionalEdges("normalize_intent", selectWorkflow, {
      [INTENTS.SEARCH_PLACES]: INTENTS.SEARCH_PLACES,
      [INTENTS.REVERSE_GEOCODE]: INTENTS.REVERSE_GEOCODE,
      [INTENTS.ROUTE]: INTENTS.ROUTE,
      [INTENTS.SHOPPING]: INTENTS.SHOPPING,
      [INTENTS.UNSUPPORTED]: INTENTS.UNSUPPORTED,
    })
    .addEdge(INTENTS.SEARCH_PLACES, END)
    .addEdge(INTENTS.REVERSE_GEOCODE, END)
    .addEdge(INTENTS.ROUTE, END)
    .addEdge(INTENTS.SHOPPING, END)
    .addEdge(INTENTS.UNSUPPORTED, END)
    .compile();
}

module.exports = {
  INTENTS,
  buildServerGraph,
};
