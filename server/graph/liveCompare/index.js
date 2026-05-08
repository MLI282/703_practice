const { buildLiveCompareGraph } = require("./workflow");

let compiledLiveCompareGraph;

function getLiveCompareGraph() {
  if (!compiledLiveCompareGraph) {
    compiledLiveCompareGraph = buildLiveCompareGraph();
  }

  return compiledLiveCompareGraph;
}

async function invokeLiveCompareGraph(input) {
  return getLiveCompareGraph().invoke(input);
}

module.exports = {
  buildLiveCompareGraph,
  getLiveCompareGraph,
  invokeLiveCompareGraph,
};
