const { StateGraph, START, END } = require("@langchain/langgraph");
const { LiveCompareState } = require("./state");
const {
  analyzeInputNode,
  analyzePlaceIntentNode,
  fetchCandidatesNode,
  normalizeCandidatesNode,
  compareCandidatesNode,
  formatResponseNode,
} = require("./nodes");

function buildLiveCompareGraph() {
  return new StateGraph(LiveCompareState)
    .addNode("analyze_input", analyzeInputNode)
    .addNode("analyze_place_intent", analyzePlaceIntentNode)
    .addNode("fetch_candidates", fetchCandidatesNode)
    .addNode("normalize_candidates", normalizeCandidatesNode)
    .addNode("compare_candidates", compareCandidatesNode)
    .addNode("format_response", formatResponseNode)
    .addEdge(START, "analyze_input")
    .addEdge("analyze_input", "analyze_place_intent")
    .addEdge("analyze_place_intent", "fetch_candidates")
    .addEdge("fetch_candidates", "normalize_candidates")
    .addEdge("normalize_candidates", "compare_candidates")
    .addEdge("compare_candidates", "format_response")
    .addEdge("format_response", END)
    .compile();
}

module.exports = {
  buildLiveCompareGraph,
};
