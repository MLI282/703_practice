const axios = require("axios");
const deepseek = require("../config/deepseekClient");
const serpSearch = require("../config/serpClient");
const { GOOGLE_API_KEY } = require("../config/apiKeys");

function serviceError(code) {
  const err = new Error(code);
  err.code = code;
  return err;
}

async function searchGoogleShopping(query) {
  return new Promise((resolve, reject) => {
    serpSearch.json(
      {
        engine: "google_shopping",
        q: query,
        google_domain: "google.com",
        gl: "nz",
        hl: "en",
        num: 8,
      },
      (data) => {
        if (data.error) {
          reject(data.error);
        }
        resolve(data.shopping_results || []);
      }
    );
  });
}

async function searchNearbyStores(lat, lng, storeType) {
  const response = await axios.get(
    "https://maps.googleapis.com/maps/api/place/textsearch/json",
    {
      params: {
        query: storeType,
        key: GOOGLE_API_KEY,
        location: `${lat},${lng}`,
        radius: 10000,
      },
    }
  );

  return response.data.results.slice(0, 6).map((place) => ({
    name: place.name,
    rating: place.rating,
    address: place.formatted_address,
    location: place.geometry.location,
    photo_url: place.photos?.[0]
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${place.photos[0].photo_reference}&key=${GOOGLE_API_KEY}`
      : null,
  }));
}

async function computeDistances(lat, lng, stores) {
  const response = await axios.post(
    "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
    {
      origins: [
        {
          waypoint: {
            location: {
              latLng: {
                latitude: parseFloat(lat),
                longitude: parseFloat(lng),
              },
            },
          },
        },
      ],
      destinations: stores.map((s) => ({
        waypoint: {
          location: {
            latLng: {
              latitude: s.location.lat,
              longitude: s.location.lng,
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

  return response.data;
}

async function searchShopping({ userInput, lat, lng }) {
  const response = await deepseek.chat.completions.create({
    model: "deepseek-chat",
    messages: [
      {
        role: "system",
        content: `
You are an AI shopping agent.
Understand user shopping intent.
Return JSON only.
Format:
{
  "shopping_query": "...",
  "category": "...",
  "store_type": "...",
  "reasoning": "..."
}
Rules:
- category can be anything:
  laptop, fruit, clothes,
  furniture, cosmetics,
  books, toys, shoes, food, etc.
- store_type should match
  the shopping category.
Examples:
Laptop -> electronics store
Fruit -> supermarket
Shoes -> shoe store
Furniture -> furniture store
Books -> book store
Clothes -> clothing store
`,
      },
      {
        role: "user",
        content: userInput,
      },
    ],
  });

  const raw = response.choices[0].message.content;
  console.log("🧠 DeepSeek原始输出:", raw);

  const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();
  console.log("🧹 清洗后JSON:", cleaned);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.log("❌ JSON解析失败:", cleaned);
    throw serviceError("AGENT_JSON_PARSE_FAILED");
  }

  const stores = await searchNearbyStores(lat, lng, parsed.store_type);
  console.log("🏪 Stores:", stores.length);

  const matrix = await computeDistances(lat, lng, stores);

  const products = await searchGoogleShopping(parsed.shopping_query);
  console.log("🛒 Products:", products.length);

  const finalResults = products.map((product, index) => {
    const store = stores[index % stores.length];
    const d = matrix[index % matrix.length];

    return {
      product_title: product.title,
      product_price: product.price,
      product_image: product.thumbnail,
      product_link: product.link,
      source: product.source,
      nearby_store: store?.name,
      store_address: store?.address,
      store_rating: store?.rating,
      store_photo: store?.photo_url,
      distance_text: d?.distanceMeters
        ? `${(d.distanceMeters / 1000).toFixed(1)} km`
        : null,
      duration_text: d?.duration
        ? `${Math.round(parseInt(d.duration.replace("s", "")) / 60)} mins`
        : null,
      agent_reasoning: parsed.reasoning,
    };
  });

  return finalResults;
}

module.exports = {
  searchShopping,
  searchGoogleShopping,
  searchNearbyStores,
  computeDistances,
};
