async function searchShopping({ userInput, lat, lng }) {
  console.time("shopping_total");

  // =========================
  // DeepSeek Shopping Parse
  // =========================
  console.time("deepseek_shopping_parse");

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

  console.timeEnd("deepseek_shopping_parse");

  const raw = response.choices[0].message.content;

  console.log("🧠 DeepSeek原始输出:", raw);

  const cleaned = raw
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  console.log("🧹 清洗后JSON:", cleaned);

  let parsed;

  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.log("❌ JSON解析失败:", cleaned);
    throw serviceError("AGENT_JSON_PARSE_FAILED");
  }

  // =========================
  // Nearby Stores
  // =========================
  console.time("nearby_stores");

  const stores = await searchNearbyStores(
    lat,
    lng,
    parsed.store_type
  );

  console.timeEnd("nearby_stores");

  console.log("🏪 Stores:", stores.length);

  // =========================
  // Parallel APIs
  // =========================
  console.time("parallel_external_apis");

  const [matrix, products] = await Promise.all([
    (async () => {
      console.time("distance_matrix");

      const result = await computeDistances(
        lat,
        lng,
        stores
      );

      console.timeEnd("distance_matrix");

      return result;
    })(),

    (async () => {
      console.time("google_shopping");

      const result = await searchGoogleShopping(
        parsed.shopping_query
      );

      console.timeEnd("google_shopping");

      return result;
    })(),
  ]);

  console.timeEnd("parallel_external_apis");

  const limitedProducts = products.slice(
    0,
    PRODUCT_RESULT_LIMIT
  );

  console.log("🛒 Products:", limitedProducts.length);

  // =========================
  // Format Results
  // =========================
  console.time("shopping_result_format");

  const finalResults = limitedProducts.map(
    (product, index) => {
      const store = stores[index % stores.length];

      const d = matrix[index % matrix.length];

      const distanceText = d?.distanceMeters
        ? `${(d.distanceMeters / 1000).toFixed(1)} km`
        : null;

      const durationText = d?.duration
        ? `${Math.round(
            parseInt(d.duration.replace("s", "")) / 60
          )} mins`
        : null;

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
        store_location: store?.location || null,

        merchant: {
          name: store?.name || null,
          address: store?.address || null,
          rating: store?.rating ?? null,
          photo_url: store?.photo_url || null,
          location: store?.location || null,
          distance_text: distanceText,
          duration_text: durationText,
        },

        distance_text: distanceText,
        duration_text: durationText,

        agent_reasoning: parsed.reasoning,
      };
    }
  );

  console.timeEnd("shopping_result_format");

  console.timeEnd("shopping_total");

  return finalResults;
}