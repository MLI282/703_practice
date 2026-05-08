# Server LangGraph Layer

This folder contains a parallel LangGraph.js orchestration layer for the existing
Express server.

It is intentionally not imported by `server.js` yet, so the current REST API
logic stays unchanged.

Current graph intents:

- `search_places`
- `reverse_geocode`
- `route`
- `shopping`

Example usage from future code:

```js
const { invokeServerGraph, INTENTS } = require("./graph");

const result = await invokeServerGraph({
  intent: INTENTS.SEARCH_PLACES,
  userInput: "cheap Chinese food nearby",
  lat: "-36.8485",
  lng: "174.7633",
});
```

## Compare Graph

The `compare/` folder mirrors the Python `pygraph` workflow:

```txt
parse_request -> load_candidates -> shortlist -> recommend
```

Example:

```js
const { invokeCompareGraph } = require("./graph");

const result = await invokeCompareGraph({
  user_request:
    "I want a student laptop under 1500 NZD with good battery life and decent performance for coding.",
});

console.log(result.recommendation);
```

## Live Compare Graph

The `liveCompare/` graph connects the existing service layer to a comparison
workflow without replacing the current API routes.

```txt
analyze_input -> fetch_candidates -> normalize_candidates -> compare_candidates -> format_response
```

It is exposed through the new route:

```txt
GET /agent-search?q=...&lat=...&lng=...
```

The response is still an array like the existing `/search` and `/shop-search`
routes. Existing fields are preserved, and comparison metadata is appended:

```js
{
  compare_rank: 1,
  compare_reason: "...",
  best_for: "...",
  agent_recommendation: "..."
}
```
