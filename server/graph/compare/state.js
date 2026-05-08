const { Annotation } = require("@langchain/langgraph");

const CompareState = Annotation.Root({
  user_request: Annotation({
    value: (left, right) => right ?? left,
    default: () => "",
  }),
  category: Annotation({
    value: (left, right) => right ?? left,
    default: () => "",
  }),
  parsed_preferences: Annotation({
    value: (left, right) => right ?? left,
    default: () => ({}),
  }),
  candidates: Annotation({
    value: (left, right) => right ?? left,
    default: () => [],
  }),
  shortlisted: Annotation({
    value: (left, right) => right ?? left,
    default: () => [],
  }),
  recommendation: Annotation({
    value: (left, right) => right ?? left,
    default: () => null,
  }),
});

module.exports = {
  CompareState,
};
