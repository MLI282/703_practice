import React, {
  useState,
  useEffect,
} from "react";

import MapView from "../components/MapView";

import {
  LoadScript,
} from "@react-google-maps/api";

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

  // 📍 地图中心
  const [center, setCenter] =
    useState({
      lat: -36.8485,
      lng: 174.7633,
    });

  // ⭐ 用户真实位置
  const [userLocation,
    setUserLocation] =
    useState(null);

  // ⭐ 底部大地图路线
  const [path, setPath] =
    useState([]);

  const [start, setStart] =
    useState(null);

  const [end, setEnd] =
    useState(null);

  // ⭐ popup
  const [popupIndex,
    setPopupIndex] =
    useState(null);

  // ⭐ 每个卡片自己的路线
  const [routeData,
    setRouteData] =
    useState({});

  // ⭐ 获取用户位置
  useEffect(() => {

    navigator.geolocation.getCurrentPosition(
      (position) => {

        const loc = {
          lat:
            position.coords.latitude,

          lng:
            position.coords.longitude,
        };

        setUserLocation(loc);

        setCenter(loc);
      },
      (err) => {

        console.log(
          "定位失败:",
          err
        );
      }
    );

  }, []);

  // 🚀 搜索商品
  const searchProducts =
    async () => {

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

        if (Array.isArray(data)) {

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

  // 🚗 导航
  const handleRouteToStore =
    async (
      product,
      index
    ) => {

      try {

        const query =
          `${center.lat},${center.lng} to ${product.nearby_store}`;

        const res = await fetch(
          `http://localhost:3001/route?q=${encodeURIComponent(
            query
          )}`
        );

        const data =
          await res.json();

        console.log(data);

        if (!window.google) {

          console.log(
            "Google 未加载"
          );

          return;
        }

        // ⭐ 解码路线
        const decoded =
          window.google.maps.geometry.encoding.decodePath(
            data.polyline
          );

        const newPath =
          decoded.map((p) => ({
            lat: p.lat(),
            lng: p.lng(),
          }));

        // ⭐ popup地图路线
        setRouteData((prev) => ({
          ...prev,

          [index]: {
            path: newPath,

            start:
              newPath[0],

            end:
              newPath[
                newPath.length - 1
              ],
          },
        }));

        // ⭐ 底部大地图同步
        setPath(newPath);

        setStart(newPath[0]);

        setEnd(
          newPath[
            newPath.length - 1
          ]
        );

        // ⭐ 打开 popup
        setPopupIndex((prev) =>
  prev === index
    ? null
    : index
);

      } catch (err) {

        console.error(
          "路线失败:",
          err
        );
      }
    };

  return (

    <LoadScript
      googleMapsApiKey="AIzaSyDmJYMiPEdbrS6_Nfn_QwfSPYdlWjieh50"
      libraries={["geometry"]}
    >

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

        {/* 🛍️ 商品区域 */}
        {!loading &&
          results.length > 0 && (

            <div
              style={{
                columnCount: 3,
                columnGap: 20,
              }}
            >

              {results.map(
                (
                  product,
                  index
                ) => (

                  <div
  key={index}

  onClick={() =>
    handleRouteToStore(
      product,
      index
    )
  }

  style={{
    position:
      "relative",

    breakInside:
      "avoid",

    marginBottom: 20,

    background:
      "white",

    borderRadius: 18,

    overflow:
      "visible",

    boxShadow:
      "0 4px 14px rgba(0,0,0,0.08)",

    transition:
      "all 0.25s ease",

    cursor:
      "pointer",
  }}

  onMouseEnter={(e) => {

    e.currentTarget.style.transform =
      "translateY(-4px) scale(1.01)";

    e.currentTarget.style.boxShadow =
      "0 10px 24px rgba(0,0,0,0.14)";
  }}

  onMouseLeave={(e) => {

    e.currentTarget.style.transform =
      "translateY(0px)";

    e.currentTarget.style.boxShadow =
      "0 4px 14px rgba(0,0,0,0.08)";
  }}
>

                    {/* 📸 图片 */}
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

                        borderTopLeftRadius: 18,
                        borderTopRightRadius: 18,
                      }}
                    />

                    {/* 🧾 内容 */}
                    <div
                      style={{
                        padding: 16,
                      }}
                    >

                      {/* 🏷️ 标题 */}
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

                      {/* 📍 店铺 */}
                      <div
                        style={{
                          marginBottom: 6,
                        }}
                      >
                        📍 {
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

                      {/* ⭐ 评分 */}
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
{/* 🌍 Google Maps */}
<a
  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    product.nearby_store
  )}`}

  target="_blank"

  rel="noreferrer"

  onClick={(e) =>
    e.stopPropagation()
  }

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
  🌍 Open in Google Maps
</a>
                     

                    </div>

                    {/* 🗺️ popup地图 */}
                    {popupIndex ===
  index &&
  routeData[index] && (

  <div
    style={{

      // ❌ 不再 absolute
      position:
        "relative",

      // ⭐ 和卡片留间距
      marginTop: 12,

      width: "100%",

      height: 320,

      background:
        "white",

      borderRadius: 18,

      overflow:
        "hidden",

      // ❌ 不需要了
      // zIndex: 999,

      boxShadow:
        "0 12px 28px rgba(0,0,0,0.2)",

      // ⭐ 动画（推荐）
      transition:
        "all 0.25s ease",
    }}
  >

                        {/* ❌ 关闭 */}
                        <button
                          onClick={() =>
                            setPopupIndex(
                              null
                            )
                          }

                          style={{
                            position:
                              "absolute",

                            top: 10,

                            right: 10,

                            zIndex: 1000,

                            width: 32,

                            height: 32,

                            border:
                              "none",

                            borderRadius:
                              "50%",

                            background:
                              "white",

                            cursor:
                              "pointer",

                            fontWeight:
                              "bold",

                            boxShadow:
                              "0 2px 8px rgba(0,0,0,0.2)",
                          }}
                        >
                          ✕
                        </button>

                        {/* ⭐ 路线信息 */}
                        <div
                          style={{
                            position:
                              "absolute",

                            top: 10,

                            left: 10,

                            zIndex: 1000,

                            background:
                              "white",

                            padding:
                              "8px 12px",

                            borderRadius: 12,

                            boxShadow:
                              "0 2px 8px rgba(0,0,0,0.15)",

                            fontSize: 14,

                            fontWeight:
                              "bold",
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

                        {/* ⭐ 小地图 */}
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                          }}
                        >
                          <MapView
                            path={
                              routeData[
                                index
                              ]?.path || []
                            }

                            center={
                              routeData[
                                index
                              ]?.path?.[
                                Math.floor(
                                  routeData[
                                    index
                                  ]?.path
                                    ?.length / 2
                                )
                              ] || center
                            }

                            userLocation={
                              userLocation
                            }

                            start={
                              routeData[
                                index
                              ]?.start
                            }

                            end={
                              routeData[
                                index
                              ]?.end
                            }
                          />
                        </div>

                      </div>
                    )}

                  </div>
                )
              )}

            </div>
          )}

        {/* 🗺️ 底部大地图 */}
        <div
          style={{
            marginTop: 60,
          }}
        >

          <h2
            style={{
              marginBottom: 20,
            }}
          >
            🗺️ Global Route Map
          </h2>

          <MapView
            path={path}
            center={center}
            userLocation={
              userLocation
            }
            start={start}
            end={end}
          />

        </div>

      </div>

    </LoadScript>
  );
}

export default Shop;