import React, {
  useState,
} from "react";

import MapView
from "./MapView";

function ProductCard({
    

  product,

  handleRouteToProduct,

  expandedProduct,

  setExpandedProduct,

  path,

  center,

  userLocation,

  start,

  end,
}) {
    const hasLocation =
  product?.location?.lat &&
  product?.location?.lng;

  // ⏳ 地图加载状态
  const [loading,
    setLoading] =
    useState(false);

  return (

    <li

      onClick={async () => {

        // 已展开 → 收回
        if (
          expandedProduct ===
          product.product_title
        ) {

          setExpandedProduct(
            null
          );

          return;
        }

        // 展开卡片
        setExpandedProduct(
          product.product_title
        );

        // loading
        setLoading(true);

        // 请求路线
        await handleRouteToProduct(
          product
        );

        // 结束loading
        setLoading(false);
      }}

      style={{

        width: 320,

        background: "white",

        borderRadius: 18,

        overflow: "hidden",

        cursor: "pointer",

        transition:
          "all 0.25s ease",

        boxShadow:
          expandedProduct ===
          product.product_title
            ? "0 8px 24px rgba(0,0,0,0.12)"
            : "0 2px 6px rgba(0,0,0,0.05)",
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

        {/* 🏷️ 标题 */}
        <div
          style={{
            fontWeight:
              "bold",

            fontSize: 18,

            marginBottom: 10,

            lineHeight: 1.4,
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
            marginBottom: 10,
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

            marginBottom: 12,
          }}
        >
          ⭐ {
            product.store_rating
          }
        </div>

        {/* 🔗 Google Maps */}
        <div
          style={{
            marginTop: 8,
          }}
        >

          <a
            href={
  hasLocation
    ? `https://www.google.com/maps/dir/?api=1&destination=${product.location.lat},${product.location.lng}`
    : "#"
}
            target="_blank"

            rel="noreferrer"

            onClick={(e) =>
              e.stopPropagation()
            }

            style={{
              textDecoration:
                "none",

              color:
                "#1a73e8",

              fontWeight:
                "bold",
            }}
          >
            👉 在 Google Maps 打开
          </a>

        </div>

        {/* 🗺️ 地图展开区域 */}
        <div
          style={{

            marginTop: 16,

            maxHeight:
              expandedProduct ===
              product.product_title
                ? "340px"
                : "0px",

            opacity:
              expandedProduct ===
              product.product_title
                ? 1
                : 0,

            overflow:
              "hidden",

            transition:
              "all 0.35s ease",

            borderRadius: 12,
          }}
        >

          {/* ⏳ Loading */}
          {loading ? (

            <div
              style={{
                height: 260,

                borderRadius: 12,

                background:
                  "linear-gradient(90deg, #f3f3f3 25%, #e9e9e9 37%, #f3f3f3 63%)",

                backgroundSize:
                  "400% 100%",

                animation:
                  "loading 1.4s ease infinite",

                display: "flex",

                alignItems:
                  "center",

                justifyContent:
                  "center",

                color: "#666",

                fontWeight:
                  "bold",
              }}
            >
              Loading Route...
            </div>

          ) : (

             hasLocation && (

    <MapView

      path={path}

      center={center}

      userLocation={
        userLocation
      }

      start={start}

      end={end}

      height="260px"
    />

  )

)}
        </div>

        {/* 🌊 Skeleton动画 */}
        <style>
          {`
            @keyframes loading {

              0% {
                background-position: 100% 50%;
              }

              100% {
                background-position: 0 50%;
              }
            }
          `}
        </style>

      </div>
    </li>
  );
}

export default ProductCard;