const { Annotation } = require("@langchain/langgraph");

const ServerGraphState = Annotation.Root({
  intent: Annotation({
    value: (left, right) => right ?? left,
    default: () => "unknown",
  }),
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
  routeQuery: Annotation({
    value: (left, right) => right ?? left,
    default: () => "",
  }),
  results: Annotation({
    value: (left, right) => right ?? left,
    default: () => null,
  }),
  error: Annotation({
    value: (left, right) => right ?? left,
    default: () => null,
  }),
});

module.exports = {
  ServerGraphState,
};
