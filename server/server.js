
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());

const GOOGLE_API_KEY = "AIzaSyCM52EWkjcrBhRpb4gpm4WS1298UL-KorU";

const OpenAI = require("openai");

const deepseek = new OpenAI({
  apiKey: "sk-fba43d9bd0e646df83cac342f3a07e9f",
  baseURL: "https://api.deepseek.com",
});

app.get("/", (req, res) => {
  res.send("Welcome to the Google Maps Search API");
});

app.get("/search", async (req, res) => {
  const lat = req.query.lat;
  const lng = req.query.lng;
  const userInput = req.query.q;

  try {
    // 🧠 Step 1：LLM解析
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

    // 🛠️ Step 2：解析 JSON
    let parsed;
    try {
      const raw = aiResponse.choices[0].message.content
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      parsed = JSON.parse(raw);
    } catch (e) {
      console.log("AI原始输出:", aiResponse.choices[0].message.content);
      return res.status(400).json({ error: "AI解析失败" });
    }

    console.log("结构化结果:", parsed);

    // 🧱 Step 3：构建 query
    const query = `
      ${parsed.keywords || ""}
      ${parsed.cuisine || ""}
      ${parsed.type || ""}
    `;

    // 🚀 Step 4：radius（粗筛）
    let radius = 5000;
    if (parsed.max_distance_km) {
      radius = parsed.max_distance_km * 1000;
    }
    if (radius > 50000) radius = 50000;
    if (radius < 500) radius = 500;

    // 🌍 Step 5：Places API
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
      return res.json([]);
    }

    // ⭐ 增加 photo_reference
    const places = response.data.results.slice(0, 10).map((place) => ({
      name: place.name,
      rating: place.rating,
      address: place.formatted_address,
      price_level: place.price_level ?? null,
      location: place.geometry.location,
      photo_reference: place.photos?.[0]?.photo_reference ?? null,
    }));

    // 🚗 Step 6：Routes API
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
          "X-Goog-FieldMask":
            "originIndex,destinationIndex,distanceMeters,duration",
        },
      }
    );

    const matrix = routeMatrixRes.data;

    // 🧠 Step 7：合并距离 + 图片
    const placesWithDistance = places.map((place, index) => {
      // ⭐ 更安全匹配（避免顺序错乱）
      const d = matrix.find((m) => m.destinationIndex === index);

      const distanceMeters = d?.distanceMeters ?? null;
      const durationSeconds = d?.duration
        ? parseInt(d.duration.replace("s", ""))
        : null;

      // ⭐ 图片URL
      const photoUrl = place.photo_reference
        ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${place.photo_reference}&key=${GOOGLE_API_KEY}`
        : null;

      return {
        ...place,

        // 原始数据
        distance_value: distanceMeters,
        duration_value: durationSeconds,

        // ⭐ 前端直接用
        distance_text:
          distanceMeters != null
            ? distanceMeters < 1000
              ? `${distanceMeters} m`
              : `${(distanceMeters / 1000).toFixed(1)} km`
            : null,

        duration_text:
          durationSeconds != null
            ? `${Math.round(durationSeconds / 60)} min`
            : null,

        // ⭐ 图片
        photo_url: photoUrl,
      };
    });

    // 🔍 Step 8：过滤
    function filterPlaces(places, cond) {
      return places.filter((p) => {
        if (
          cond.price === "cheap" &&
          p.price_level !== null &&
          p.price_level > 2
        ) {
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

    let filtered = filterPlaces(placesWithDistance, parsed);

    // ⭐ Step 9：排序
    filtered.sort((a, b) => {
      return (
        (a.distance_value ?? 999999) -
        (b.distance_value ?? 999999) ||
        (b.rating ?? 0) - (a.rating ?? 0)
      );
    });

    const results = filtered.slice(0, 3);

    console.log("最终结果:", results);

    res.json(results);
  } catch (err) {
    console.error("Search error:", err?.response?.data || err);
    res.status(500).json({ error: "Failed to fetch" });
  }
});


app.get("/reverse-geocode", async (req, res) => {
  const lat = req.query.lat;
  const lng = req.query.lng;

  try {
    // ⭐ 参数检查
    if (!lat || !lng) {
      return res.status(400).json({
        error: "Missing lat/lng",
      });
    }

    // 🌍 Google Reverse Geocode
    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/geocode/json",
      {
        params: {
          latlng: `${lat},${lng}`,
          key: GOOGLE_API_KEY,
        },
      }
    );

    // ❌ 无结果
    if (!response.data.results.length) {
      return res.status(404).json({
        error: "No address found",
      });
    }

    // ✅ 返回标准地址
    res.json({
      address:
        response.data.results[0].formatted_address,
    });
  } catch (err) {
    console.error(
      "Reverse Geocode error:",
      err?.response?.data || err
    );

    res.status(500).json({
      error: "Reverse geocode failed",
    });
  }
});

// 🚗 路线（重点优化）
app.get("/route", async (req, res) => {
  const userInput = req.query.q;

  try {
    // 🧠 解析起点终点
    const aiResponse = await deepseek.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content:
            '你是一个地图助手。\
从用户输入中提取起点(from)和终点(to)，\
并转换为 Google Maps 可识别的完整英文地址（必须包含城市和国家）。\
\
返回严格JSON：\
{"from":"...","to":"..."}\
\
规则：\
- 必须英文\
- 尽量具体（街道或知名地点）\
- 不要解释\
\
示例：\
Sky Tower → Sky Tower, Victoria Street West, Auckland Central, Auckland 1010, New Zealand\
University of Auckland → 34 Princes Street, Auckland, New Zealand',
        },
        { role: "user", content: userInput },
      ],
    });
    console.log("AI解析路线响应:", aiResponse.choices[0].message.content);
    let from, to;



    try {
      const parsed = JSON.parse(aiResponse.choices[0].message.content);
      from = parsed.from;
      to = parsed.to;
    } catch (e) {
      console.log("⚠️ JSON解析失败，使用fallback");

      const parts = userInput.split("到");
      from = parts[0] || userInput;
      to = parts[1] || userInput;
    }

    console.log("路线解析:", from, "→", to);

    // 🌍 Step 3：用 Google Geocoding 标准化地址（关键！）
    const geocode = async (place) => {
      try {
        const res = await axios.get(
          "https://maps.googleapis.com/maps/api/geocode/json",
          {
            params: {
              address: place,
              key: "AIzaSyDmJYMiPEdbrS6_Nfn_QwfSPYdlWjieh50",
            },
          }
        );

        if (!res.data.results.length) return place;

        return res.data.results[0].formatted_address;
      } catch (err) {
        console.log("Geocode失败:", place);
        return place;
      }
    };

    const fromAddr = await geocode(from);
    const toAddr = await geocode(to);
    console.log("标准地址:", fromAddr, "→", toAddr);



    // 🗺️ 调 Directions API
    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/directions/json",
      {
        params: {
          origin: from,
          destination: to,
          key: "AIzaSyDmJYMiPEdbrS6_Nfn_QwfSPYdlWjieh50",
        },
      }
    );
    // console.log("路线API响应:", response.data);
    if (!response.data.routes.length) {
      return res.status(400).json({ error: "No route found" });
    }

    const route = response.data.routes[0];
    const leg = route.legs[0];

    res.json({
      from: leg.start_address,
      to: leg.end_address,
      distance: leg.distance.text,
      duration: leg.duration.text,
      polyline: route.overview_polyline.points, // ⭐关键
    });
  } catch (err) {
    console.error("Route error:", err);
    res.status(500).json({ error: "Route failed" });
  }
});
app.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});

// ================================
// 🚀 AI Shopping Agent Backend
// Express + OpenAI Agent + SerpAPI + Google Maps
// ================================

require("dotenv").config();
const SerpApi = require("google-search-results-nodejs");
app.use(cors());
app.use(express.json());

// ================================
// 🔑 API KEYS
// ================================


const SERP_API_KEY = "2e74d878e7641ba34b43939d4ed14e9ba57afe748496f11e8c9973da74042553";


const serpSearch =
  new SerpApi.GoogleSearch(
    SERP_API_KEY
  );

// ================================
// 🛠️ TOOL 1
// 搜索 Google Shopping
// ================================

async function searchGoogleShopping(
  query
) {
  return new Promise(
    (resolve, reject) => {
      serpSearch.json(
        {
          engine: "google_shopping",
          q: query,
          google_domain:
            "google.com",
          gl: "nz",
          hl: "en",
          num: 8,
        },
        (data) => {
          if (data.error) {
            reject(data.error);
          }
          resolve(
            data.shopping_results || []
          );
        }
      );
    }
  );
}

// ================================
// 🛠️ TOOL 2
// 搜索附近电脑店
// ================================
async function searchNearbyStores(
  lat,
  lng,
  storeType
) {

  const response =
    await axios.get(
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

  return response.data.results
    .slice(0, 6)
    .map((place) => ({

      name: place.name,

      rating: place.rating,

      address:
        place.formatted_address,

      location:
        place.geometry.location,

      photo_url:
        place.photos?.[0]
          ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${place.photos[0].photo_reference}&key=${GOOGLE_API_KEY}`
          : null,
    }));
}

// ================================
// 🛠️ TOOL 3
// 计算距离
// ================================

async function computeDistances(
  lat,
  lng,
  stores
) {
  const response = await axios.post(
    "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
    {
      origins: [
        {
          waypoint: {
            location: {
              latLng: {
                latitude:
                  parseFloat(lat),

                longitude:
                  parseFloat(lng),
              },
            },
          },
        },
      ],
      destinations: stores.map(
        (s) => ({
          waypoint: {
            location: {
              latLng: {
                latitude:
                  s.location.lat,

                longitude:
                  s.location.lng,
              },
            },
          },
        })
      ),

      travelMode: "DRIVE",
    },
    {
      headers: {
        "Content-Type":
          "application/json",
        "X-Goog-Api-Key":
          GOOGLE_API_KEY,
        "X-Goog-FieldMask":
          "originIndex,destinationIndex,distanceMeters,duration",
      },
    }
  );
  return response.data;
}
// ================================
// 🤖 SHOPPING AGENT
// ================================
app.get(
  "/shop-search",
  async (req, res) => {
    const userInput = req.query.q;
    const lat = req.query.lat;
    const lng = req.query.lng;
    try {
      // ========================
      // 🧠 AGENT REASONING
      // ========================
      const response =
        await deepseek.chat.completions.create({
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

      const raw =
        response.choices[0].message.content;
      console.log(
        "🧠 DeepSeek原始输出:",
        raw
      );
      // ⭐ 清洗 markdown
      const cleaned = raw
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      console.log(
        "🧹 清洗后JSON:",
        cleaned
      );
      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch (e) {
        console.log(
          "❌ JSON解析失败:",
          cleaned
        );
        return res.status(400).json({
          error:
            "Agent JSON parse failed",
        });
      }
      // ========================
      // 🏪 STEP 2
      // 搜附近店铺
      // ========================
      const stores =
        await searchNearbyStores(
          lat,
          lng,
          parsed.store_type
        );
      console.log(
        "🏪 Stores:",
        stores.length
      );
      // ========================
      // 🚗 STEP 3
      // 距离矩阵
      // =======================
      const matrix =
        await computeDistances(
          lat,
          lng,
          stores
        );
      // ========================
      // ⭐ STEP 4
      // Agent融合结果
      // ========================
      const products =
        await searchGoogleShopping(
          parsed.shopping_query
        );
      console.log(
        "🛒 Products:",
        products.length
      );
      const finalResults =
        products.map(
          (product, index) => {
            const store =
              stores[
              index % stores.length
              ];
            const d =
              matrix[
              index % matrix.length
              ];
            return {
              product_title:
                product.title,
              product_price:
                product.price,
              product_image:
                product.thumbnail,
              product_link:
                product.link,
              source:
                product.source,
              nearby_store:
                store?.name,
              store_address:
                store?.address,
              store_rating:
                store?.rating,
              store_photo:
                store?.photo_url,
              distance_text:
                d?.distanceMeters
                  ? `${(
                    d.distanceMeters /
                    1000
                  ).toFixed(1)} km`
                  : null,
              duration_text:
                d?.duration
                  ? `${Math.round(
                    parseInt(
                      d.duration.replace(
                        "s",
                        ""
                      )
                    ) / 60
                  )} mins`
                  : null,
              agent_reasoning:
                parsed.reasoning,
            };
          }
        );
      // ========================
      // 🚀 返回
      // ========================
      res.json(finalResults);
    } catch (err) {
      console.error(
        "❌ Shopping Agent Error:",
        err?.response?.data || err
      );
      res.status(500).json({
        error:
          "Shopping agent failed",
      });
    }
  }
);
// ================================
// 🚀 SERVER
// ================================

app.listen(3001, () => {
  console.log(
    "🚀 Server running on http://localhost:3001"
  );
});

