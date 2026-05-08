const { INTENTS, buildServerGraph } = require("./workflow");
const {
  buildCompareGraph,
  getCompareGraph,
  invokeCompareGraph,
} = require("./compare");
const {
  buildLiveCompareGraph,
  getLiveCompareGraph,
  invokeLiveCompareGraph,
} = require("./liveCompare");

let compiledGraph;

function getServerGraph() {
  if (!compiledGraph) {
    compiledGraph = buildServerGraph();
  }

  return compiledGraph;
}

async function invokeServerGraph(input) {
  return getServerGraph().invoke(input);
}

module.exports = {
  INTENTS,
  buildServerGraph,
  getServerGraph,
  invokeServerGraph,
  buildCompareGraph,
  getCompareGraph,
  invokeCompareGraph,
  buildLiveCompareGraph,
  getLiveCompareGraph,
  invokeLiveCompareGraph,
};
