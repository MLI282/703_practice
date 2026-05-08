const { StateGraph, START, END } = require("@langchain/langgraph");
const { CompareState } = require("./state");
const {
  parseRequestNode,
  loadCandidatesNode,
  shortlistNode,
  recommendNode,
} = require("./nodes");

function buildCompareGraph() {
  return new StateGraph(CompareState)
    .addNode("parse_request", parseRequestNode)
    .addNode("load_candidates", loadCandidatesNode)
    .addNode("shortlist", shortlistNode)
    .addNode("recommend", recommendNode)
    .addEdge(START, "parse_request")
    .addEdge("parse_request", "load_candidates")
    .addEdge("load_candidates", "shortlist")
    .addEdge("shortlist", "recommend")
    .addEdge("recommend", END)
    .compile();
}

module.exports = {
  buildCompareGraph,
};
