import React, { useState } from "react";
import MapView from "./MapView";

function PlaceCard({
  place,
  handleRouteToPlace,

  expandedPlace,
  setExpandedPlace,

  path,
  center,
  userLocation,
  start,
 end,
}) {

  // ✅ 地图加载状态
  const [loading, setLoading] = useState(false);

  return (
    <li
      onClick={async () => {

        // ✅ 已展开 → 收回
        if (expandedPlace === place.name) {
          setExpandedPlace(null);
          return;
        }

        // ✅ 展开卡片
        setExpandedPlace(place.name);

        // ✅ 显示 loading
        setLoading(true);

        // ✅ 请求路线
        await handleRouteToPlace(place);

        // ✅ 结束 loading
        setLoading(false);
      }}

      style={{
        border: "1px solid #eee",
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,

        boxShadow:
          expandedPlace === place.name
            ? "0 8px 24px rgba(0,0,0,0.12)"
            : "0 2px 6px rgba(0,0,0,0.05)",

        cursor: "pointer",
        background: "white",

        transition: "all 0.25s ease",

        width: 360,
      }}
    >
      {/* 📸 图片 */}
      {place.photo_url && (
        <img
          src={place.photo_url}
          alt={place.name}
          style={{
            width: "100%",
            height: 180,
            objectFit: "cover",
            borderRadius: 8,
            marginBottom: 8,
          }}
        />
      )}

      {/* 🏪 名字 */}
      <div
        style={{
          fontWeight: "bold",
          fontSize: 16,
        }}
      >
        {place.name}
      </div>

      {/* ⭐ 评分 */}
      <div style={{ color: "#f5a623" }}>
        ⭐ {place.rating ?? "N/A"}
      </div>

      {/* 📍 地址 */}
      <div
        style={{
          fontSize: 13,
          color: "#666",
          marginTop: 4,
        }}
      >
        {place.address}
      </div>

      {/* 📏 距离 */}
      {place.distance_text && (
        <div style={{ marginTop: 6 }}>
          📍 {place.distance_text}
        </div>
      )}

      {/* ⏱️ 时间 */}
      {place.duration_text && (
        <div>
          ⏱️ {place.duration_text}
        </div>
      )}

      {/* 🔗 Google Maps */}
      <div style={{ marginTop: 8 }}>
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${place.location.lat},${place.location.lng}`}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{
            textDecoration: "none",
            color: "#1a73e8",
            fontWeight: "bold",
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
            expandedPlace === place.name
              ? "340px"
              : "0px",

          opacity:
            expandedPlace === place.name
              ? 1
              : 0,

          overflow: "hidden",

          transition: "all 0.35s ease",

          borderRadius: 12,
        }}
      >

        {/* ⏳ Loading Skeleton */}
        {loading ? (
          <div
            style={{
              height: 260,

              borderRadius: 12,

              background:
                "linear-gradient(90deg, #f3f3f3 25%, #e9e9e9 37%, #f3f3f3 63%)",

              backgroundSize: "400% 100%",

              animation:
                "loading 1.4s ease infinite",

              display: "flex",
              alignItems: "center",
              justifyContent: "center",

              color: "#666",
              fontWeight: "bold",
            }}
          >
            Loading Route...
          </div>
        ) : (
          <MapView
            path={path}
            center={center}
            userLocation={userLocation}
            start={start}
            end={end}
            height="260px"
          />
        )}
      </div>

      {/* 🌊 Skeleton 动画 */}
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
    </li>
  );
}

export default PlaceCard;