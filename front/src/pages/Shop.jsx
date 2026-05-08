import React, {
  useState,
  useEffect,
} from "react";

function Shop() {

  // 🔍 搜索词
  const [query, setQuery] =
    useState("");

  // 🛒 商品结果
  const [results, setResults] =
    useState([]);

  // ⏳ loading
  const [loading, setLoading] =
    useState(false);

  // 📍 用户位置
  const [center, setCenter] =
    useState({
      lat: -36.8485,
      lng: 174.7633,
    });

  // ⭐ 获取用户位置
  useEffect(() => {

    navigator.geolocation.getCurrentPosition(
      (position) => {

        setCenter({
          lat:
            position.coords.latitude,

          lng:
            position.coords.longitude,
        });
      }
    );

  }, []);

  // 🚀 搜索商品
  const searchProducts =
    async () => {

      // 空输入直接返回
      if (!query.trim()) {
        setResults([]);
        return;
      }

      try {

        setLoading(true);

        const res = await fetch(
          `http://localhost:3001/shop-search?q=${encodeURIComponent(
            query
          )}&lat=${center.lat}&lng=${center.lng}`
        );

        const data =
          await res.json();

        console.log(data);

        // 防止不是数组
        if (Array.isArray(data)) {

          // ⭐ 只保留前10个
          setResults(
            data.slice(0, 10)
          );

        } else {

          setResults([]);
        }

      } catch (err) {

        console.error(
          "商品搜索失败:",
          err
        );

        setResults([]);

      } finally {

        setLoading(false);
      }
    };

  return (

    <div
      style={{
        padding: 24,
        background: "#f6f7fb",
        minHeight: "100vh",
      }}
    >

      {/* 🛒 标题 */}
      <h1
        style={{
          marginBottom: 24,
        }}
      >
        🛒 AI Shopping Agent
      </h1>

      {/* 🔍 搜索栏 */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 30,
        }}
      >

        <input
          value={query}

          onChange={(e) =>
            setQuery(
              e.target.value
            )
          }

          placeholder="输入：2000以内适合AI训练的电脑"

          style={{
            flex: 1,

            padding:
              "14px 18px",

            borderRadius: 12,

            border:
              "1px solid #ddd",

            fontSize: 16,

            outline: "none",
          }}
        />

        <button
          onClick={
            searchProducts
          }

          style={{
            padding:
              "14px 24px",

            border: "none",

            borderRadius: 12,

            background:
              "#1a73e8",

            color: "white",

            fontWeight: "bold",

            cursor: "pointer",

            fontSize: 15,
          }}
        >
          搜索
        </button>
      </div>

      {/* ⏳ Loading */}
      {loading && (

        <div
          style={{
            textAlign: "center",
            padding: 80,
            fontSize: 22,
            fontWeight: "bold",
            color: "#666",
          }}
        >
          🔍 搜索中...
        </div>
      )}

      {/* ❌ 无商品 */}
      {!loading &&
        results.length === 0 && (
          <div
            style={{
              background: "white",
              borderRadius: 20,
              padding: 60,
              textAlign: "center",
              boxShadow:
                "0 4px 14px rgba(0,0,0,0.08)",
            }}
          >

            <div
              style={{
                fontSize: 80,
                marginBottom: 20,
              }}
            >
              📦
            </div>

            <h2
              style={{
                marginBottom: 10,
              }}
            >
              无商品
            </h2>

            <p
              style={{
                color: "#777",
              }}
            >
              没有搜索到相关商品
            </p>
          </div>
        )}

      {/* 🛍️ 商品区域 */}
      {!loading &&
        results.length > 0 && (

          <ul
            style={{
              listStyle: "none",

              padding: 0,

              display: "flex",

              flexWrap: "wrap",

              gap: 20,

              alignItems:
                "flex-start",
            }}
          >

            {results.map(
              (
                product,
                index
              ) => (

                <li
                  key={index}

                  style={{
                    width: 320,

                    background:
                      "white",

                    borderRadius: 18,

                    overflow:
                      "hidden",

                    boxShadow:
                      "0 4px 14px rgba(0,0,0,0.08)",

                    transition:
                      "all 0.25s ease",

                    cursor:
                      "pointer",
                  }}

                  onMouseEnter={(
                    e
                  ) => {

                    e.currentTarget.style.transform =
                      "translateY(-4px)";

                    e.currentTarget.style.boxShadow =
                      "0 10px 24px rgba(0,0,0,0.14)";
                  }}

                  onMouseLeave={(
                    e
                  ) => {

                    e.currentTarget.style.transform =
                      "translateY(0px)";

                    e.currentTarget.style.boxShadow =
                      "0 4px 14px rgba(0,0,0,0.08)";
                  }}
                >

                  {/* 📸 商品图 */}
                  <img
                    src={
                      product.product_image
                    }

                    alt={
                      product.product_title
                    }

                    style={{
                      width: "100%",

                      height: 220,

                      objectFit:
                        "cover",
                    }}
                  />

                  {/* 🧾 内容 */}
                  <div
                    style={{
                      padding: 16,
                    }}
                  >

                    {/* 🏷️ 商品标题 */}
                    <div
                      style={{
                        fontWeight:
                          "bold",

                        fontSize: 18,

                        marginBottom: 10,

                        lineHeight:
                          1.4,
                      }}
                    >
                      {
                        product.product_title
                      }
                    </div>

                    {/* 💰 价格 */}
                    <div
                      style={{
                        fontSize: 24,

                        fontWeight:
                          "bold",

                        color:
                          "#1a73e8",

                        marginBottom: 12,
                      }}
                    >
                      {
                        product.product_price
                      }
                    </div>

                    {/* 🏪 商家 */}
                    <div
                      style={{
                        color:
                          "#666",

                        marginBottom: 6,
                      }}
                    >
                      🏪 {
                        product.source
                      }
                    </div>

                    {/* 📍 附近店铺 */}
                    <div
                      style={{
                        marginBottom: 6,
                      }}
                    >
                      📍 Nearby:
                      {" "}
                      {
                        product.nearby_store
                      }
                    </div>

                    {/* 🚗 距离 */}
                    <div
                      style={{
                        marginBottom: 12,
                      }}
                    >
                      🚗 {
                        product.distance_text
                      }
                      {" · "}
                      {
                        product.duration_text
                      }
                    </div>

                    {/* ⭐ 店铺评分 */}
                    <div
                      style={{
                        color:
                          "#f5a623",

                        marginBottom: 16,
                      }}
                    >
                      ⭐ {
                        product.store_rating
                      }
                    </div>

                    {/* 🔗 商品链接 */}
                    <a
                      href={
                        product.product_link
                      }

                      target="_blank"

                      rel="noreferrer"

                      style={{
                        display:
                          "inline-block",

                        width: "100%",

                        textAlign:
                          "center",

                        padding:
                          "12px 0",

                        background:
                          "#1a73e8",

                        color:
                          "white",

                        borderRadius: 10,

                        textDecoration:
                          "none",

                        fontWeight:
                          "bold",
                      }}
                    >
                      查看商品
                    </a>
                  </div>
                </li>
              )
            )}
          </ul>
        )}
    </div>
  );
}

export default Shop;