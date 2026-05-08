const { buildCompareGraph } = require("./workflow");

let compiledCompareGraph;

function getCompareGraph() {
  if (!compiledCompareGraph) {
    compiledCompareGraph = buildCompareGraph();
  }

  return compiledCompareGraph;
}

async function invokeCompareGraph(input) {
  return getCompareGraph().invoke(input);
}

module.exports = {
  buildCompareGraph,
  getCompareGraph,
  invokeCompareGraph,
};
