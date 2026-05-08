const axios = require("axios");
const deepseek = require("../config/deepseekClient");
const { GOOGLE_API_KEY } = require("../config/apiKeys");

function serviceError(code) {
  const err = new Error(code);
  err.code = code;
  return err;
}

function filterPlaces(places, cond) {
  return places.filter((p) => {
    if (cond.price === "cheap" && p.price_level !== null && p.price_level > 2) {
      return false;
    }

    if (
      cond.price === "expensive" &&
      p.price_level !== null &&
      p.price_level < 3
    ) {
      return false;
    }

    if (cond.max_distance_km && p.distance_value !== null) {
      if (p.distance_value > cond.max_distance_km * 1000) {
        return false;
      }
    }

    return true;
  });
}

function buildParsedFromPlaceIntent(placeIntent) {
  if (!placeIntent) {
    return null;
  }

  const features = Array.isArray(placeIntent.features)
    ? placeIntent.features.join(" ")
    : "";
  const keywords = [
    placeIntent.keywords,
    features,
    placeIntent.food_cuisine,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    type: placeIntent.place_type || "local place",
    cuisine: placeIntent.food_cuisine || null,
    keywords: keywords || null,
    price: placeIntent.price || null,
    max_distance_km: placeIntent.max_distance_km || null,
  };
}

async function searchPlaces({ lat, lng, userInput, placeIntent }) {
  let parsed = buildParsedFromPlaceIntent(placeIntent);

  if (!parsed) {
    const aiResponse = await deepseek.chat.completions.create({
    model: "deepseek-chat",
    messages: [
      {
        role: "system",
        content: `
你是一个智能生活助手，把用户需求解析成JSON。

返回格式（必须严格JSON）：
{
  "type": "restaurant | cafe | supermarket | etc",
  "cuisine": "italian | chinese | null",
  "keywords": "pasta | coffee | null",
  "price": "cheap | medium | expensive | null",
  "max_distance_km": number | null
}

规则：
- 必须JSON
- 不要解释
- 不要多余内容
`,
      },
      {
        role: "user",
        content: userInput,
      },
    ],
  });

  try {
    const raw = aiResponse.choices[0].message.content
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    parsed = JSON.parse(raw);
  } catch (e) {
    console.log("AI原始输出:", aiResponse.choices[0].message.content);
    throw serviceError("AI_PARSE_FAILED");
  }
  }

  console.log("结构化结果:", parsed);

  const query = `
      ${parsed.keywords || ""}
      ${parsed.cuisine || ""}
      ${parsed.type || ""}
    `;

  let radius = 5000;
  if (parsed.max_distance_km) {
    radius = parsed.max_distance_km * 1000;
  }
  if (radius > 50000) radius = 50000;
  if (radius < 500) radius = 500;

  const response = await axios.get(
    "https://maps.googleapis.com/maps/api/place/textsearch/json",
    {
      params: {
        query: query,
        key: GOOGLE_API_KEY,
        location: `${lat},${lng}`,
        radius: radius,
      },
    }
  );

  if (!response.data.results.length) {
    return [];
  }

  const places = response.data.results.slice(0, 10).map((place) => ({
    name: place.name,
    rating: place.rating,
    address: place.formatted_address,
    price_level: place.price_level ?? null,
    location: place.geometry.location,
    photo_reference: place.photos?.[0]?.photo_reference ?? null,
  }));

  const originLat = parseFloat(lat);
  const originLng = parseFloat(lng);

  const routeMatrixRes = await axios.post(
    "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
    {
      origins: [
        {
          waypoint: {
            location: {
              latLng: {
                latitude: originLat,
                longitude: originLng,
              },
            },
          },
        },
      ],
      destinations: places.map((p) => ({
        waypoint: {
          location: {
            latLng: {
              latitude: p.location.lat,
              longitude: p.location.lng,
            },
          },
        },
      })),
      travelMode: "DRIVE",
    },
    {
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": "originIndex,destinationIndex,distanceMeters,duration",
      },
    }
  );

  const matrix = routeMatrixRes.data;

  const placesWithDistance = places.map((place, index) => {
    const d = matrix.find((m) => m.destinationIndex === index);

    const distanceMeters = d?.distanceMeters ?? null;
    const durationSeconds = d?.duration
      ? parseInt(d.duration.replace("s", ""))
      : null;

    const photoUrl = place.photo_reference
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${place.photo_reference}&key=${GOOGLE_API_KEY}`
      : null;

    return {
      ...place,
      distance_value: distanceMeters,
      duration_value: durationSeconds,
      distance_text:
        distanceMeters != null
          ? distanceMeters < 1000
            ? `${distanceMeters} m`
            : `${(distanceMeters / 1000).toFixed(1)} km`
          : null,
      duration_text:
        durationSeconds != null ? `${Math.round(durationSeconds / 60)} min` : null,
      photo_url: photoUrl,
    };
  });

  let filtered = filterPlaces(placesWithDistance, parsed);

  filtered.sort((a, b) => {
    return (
      (a.distance_value ?? 999999) -
        (b.distance_value ?? 999999) ||
      (b.rating ?? 0) - (a.rating ?? 0)
    );
  });

  const results = filtered;

  console.log("最终结果:", results);

  return results;
}

async function reverseGeocode({ lat, lng }) {
  if (!lat || !lng) {
    throw serviceError("MISSING_LAT_LNG");
  }

  const response = await axios.get(
    "https://maps.googleapis.com/maps/api/geocode/json",
    {
      params: {
        latlng: `${lat},${lng}`,
        key: GOOGLE_API_KEY,
      },
    }
  );

  if (!response.data.results.length) {
    throw serviceError("NO_ADDRESS_FOUND");
  }

  return {
    address: response.data.results[0].formatted_address,
  };
}

module.exports = {
  searchPlaces,
  reverseGeocode,
};
