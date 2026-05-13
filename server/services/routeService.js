const axios = require("axios");
const deepseek = require("../config/deepseekClient");
const { GOOGLE_ROUTE_API_KEY } = require("../config/apiKeys");

function serviceError(code) {
  const err = new Error(code);
  err.code = code;
  return err;
}

async function geocode(place) {
  try {
    const res = await axios.get(
      "https://maps.googleapis.com/maps/api/geocode/json",
      {
        params: {
          address: place,
          key: GOOGLE_ROUTE_API_KEY,
        },
      }
    );

    if (!res.data.results.length) return place;

    return res.data.results[0].formatted_address;
  } catch (err) {
    console.log("Geocode failed:", place);
    return place;
  }
}

async function getRoute(userInput) {
  const aiResponse = await deepseek.chat.completions.create({
    model: "deepseek-chat",
    messages: [
      {
        role: "system",
        content: `
You are a map assistant.
Extract the origin ("from") and destination ("to") from the user's request.
Convert both into complete English addresses that Google Maps can recognize.
Include the city and country whenever possible.

Return valid JSON only:
{"from":"...","to":"..."}

Rules:
- Use English addresses.
- Be as specific as possible, using street names or well-known landmarks.
- Do not explain.

Examples:
Sky Tower -> Sky Tower, Victoria Street West, Auckland Central, Auckland 1010, New Zealand
University of Auckland -> 34 Princes Street, Auckland, New Zealand
`,
      },
      { role: "user", content: userInput },
    ],
  });

  console.log("Route parse AI response:", aiResponse.choices[0].message.content);

  let from;
  let to;

  try {
    const parsed = JSON.parse(aiResponse.choices[0].message.content);
    from = parsed.from;
    to = parsed.to;
  } catch (e) {
    console.log("Route JSON parse failed, using fallback.");

    const parts = userInput.split(/\s+to\s+/i);
    from = parts[0] || userInput;
    to = parts[1] || userInput;
  }

  console.log("Parsed route:", from, "->", to);

  const fromAddr = await geocode(from);
  const toAddr = await geocode(to);
  console.log("Normalized addresses:", fromAddr, "->", toAddr);

  const response = await axios.get(
    "https://maps.googleapis.com/maps/api/directions/json",
    {
      params: {
        origin: from,
        destination: to,
        key: GOOGLE_ROUTE_API_KEY,
      },
    }
  );

  if (!response.data.routes.length) {
    throw serviceError("NO_ROUTE_FOUND");
  }

  const route = response.data.routes[0];
  const leg = route.legs[0];

  return {
    from: leg.start_address,
    to: leg.end_address,
    distance: leg.distance.text,
    duration: leg.duration.text,
    polyline: route.overview_polyline.points,
  };
}

module.exports = {
  getRoute,
};
