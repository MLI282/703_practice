const { Annotation } = require("@langchain/langgraph");

const LiveCompareState = Annotation.Root({
  userInput: Annotation({
    value: (left, right) => right ?? left,
    default: () => "",
  }),
  lat: Annotation({
    value: (left, right) => right ?? left,
    default: () => null,
  }),
  lng: Annotation({
    value: (left, right) => right ?? left,
    default: () => null,
  }),
  category: Annotation({
    value: (left, right) => right ?? left,
    default: () => "place",
  }),
  parsedPreferences: Annotation({
    value: (left, right) => right ?? left,
    default: () => ({}),
  }),
  placeIntent: Annotation({
    value: (left, right) => right ?? left,
    default: () => null,
  }),
  candidates: Annotation({
    value: (left, right) => right ?? left,
    default: () => [],
  }),
  normalizedCandidates: Annotation({
    value: (left, right) => right ?? left,
    default: () => [],
  }),
  comparisons: Annotation({
    value: (left, right) => right ?? left,
    default: () => [],
  }),
  recommendation: Annotation({
    value: (left, right) => right ?? left,
    default: () => "",
  }),
  results: Annotation({
    value: (left, right) => right ?? left,
    default: () => [],
  }),
});

module.exports = {
  LiveCompareState,
};
