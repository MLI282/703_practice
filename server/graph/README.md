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

## Trust and Robustness

The security layer is implemented at the Express boundary so valid requests
still use the existing controllers, services, ranking logic, and graph nodes.

Current controls:

- Search text is required and limited to 500 characters.
- Latitude and longitude must be finite and within geographic ranges.
- Registration, login, history IDs, and favorite updates are schema-validated.
- JSON request bodies are limited to 32 KB.
- General, authentication, and external-API routes have short-window rate
  limits in addition to the existing daily search quota.
- Anonymous rate-limit and quota identities use Express `req.ip`. Forwarded
  headers are trusted only when `TRUST_PROXY` is explicitly configured.
- Browser-facing security headers disable framing, MIME sniffing, and
  unnecessary browser capabilities.
- Outbound Axios and LLM requests have deadlines.
- Production startup fails when `JWT_SECRET` is missing or shorter than 32
  characters.
- The demo `/auth/vip` activation route is disabled by default in production.

Run the security regression suite:

```bash
cd server
npm test
```

The suite covers valid request compatibility, empty and oversized input,
invalid coordinates, spoofed forwarding headers, burst requests, production
JWT configuration, response headers, and production VIP activation.

### Residual Risks

- Rate limiting is process-local. A commercial multi-instance deployment
  should use a shared Redis-backed limiter.
- User and third-party text is still supplied to an LLM. JSON parsing and local
  fallbacks limit some malformed output, but prompt injection and recommendation
  quality require an adversarial evaluation dataset before commercial release.
- Google place photo URLs currently include the configured API key. Production
  deployments should restrict that key by API and origin, or proxy photo
  requests through a dedicated endpoint.
- The system depends on Google, LLM, Reddit, SerpAPI, and MongoDB availability.
  Timeouts bound individual waits, but retries, circuit breakers, and measured
  service-level objectives are not yet implemented.
- External product, website, image, and advertisement URLs should be treated as
  untrusted. A future hardening pass should enforce an HTTP/HTTPS allowlist at
  ingestion and rendering boundaries.
