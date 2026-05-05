import React, { useState,useEffect } from "react";
import {
  GoogleMap,
  LoadScript,
  Polyline,
  Marker
} from "@react-google-maps/api";

function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [routeQuery, setRouteQuery] = useState("");
  const [routeResult, setRouteResult] = useState(null);
  const [path, setPath] = useState([]);
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [center, setCenter] = useState({
  lat: 38.9182,
  lng: 121.6283,
});
const [userLocation, setUserLocation] = useState(null);
useEffect(() => {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const loc = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      setUserLocation(loc); // ⭐ 保存真实用户位置
      setCenter(loc);       // ⭐ 地图初始中心
    },
    (error) => {
      console.log("定位失败:", error);
    }
  );
}, []);








  const searchPlaces = async () => {
    const res = await fetch(
      `http://localhost:3001/search?q=${query}&lat=${center.lat}&lng=${center.lng}`
    );
    const data = await res.json();
    setResults(data);
  };

  
const getRoute = async () => {
  try {
    // ⭐ 1. 清空旧路线（关键）
    setPath([]);
    setRouteResult(null);

    const res = await fetch(
      `http://localhost:3001/route?q=${encodeURIComponent(routeQuery)}`
    );
    const data = await res.json();

    setRouteResult(data);

    // ⭐ 2. 确保 Google 已加载
    if (!window.google) {
      console.log("Google Maps 未加载");
      return;
    }

    // ⭐ 3. 解码 polyline
    const decoded = window.google.maps.geometry.encoding.decodePath(
      data.polyline
    );

    // ⭐ 4. 转换成“全新数组”（关键！！！）
    const newPath = decoded.map((p) => ({
      lat: p.lat(),
      lng: p.lng(),
    }));

    // ⭐ 5. 设置新路线
    setPath(newPath);
setStart(newPath[0]);
setEnd(newPath[newPath.length - 1]);
  } catch (err) {
    console.error("获取路线失败:", err);
  }
};


const handleRouteToPlace = async (place) => {
  try {
    // ⭐ 用“当前位置 → 餐厅”
    const query = `${center.lat},${center.lng} to ${place.name}`;

    setRouteQuery(query); // 可选（显示用）

    const res = await fetch(
      `http://localhost:3001/route?q=${encodeURIComponent(query)}`
    );

    const data = await res.json();

    setRouteResult(data);

    if (!window.google) return;

    const decoded = window.google.maps.geometry.encoding.decodePath(
      data.polyline
    );

    const newPath = decoded.map((p) => ({
      lat: p.lat(),
      lng: p.lng(),
    }));

    setPath(newPath);

    // ⭐ 自动设置起点终点
    setStart(newPath[0]);
    setEnd(newPath[newPath.length - 1]);

    // ⭐ 自动居中
    setCenter(newPath[Math.floor(newPath.length / 2)]);
  } catch (err) {
    console.error("自动路线失败:", err);
  }
};

  

  return (
    
    <div style={{ padding: 20 }}>
      <h2>Google Maps Search</h2>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="输入，比如 coffee in Auckland"
      />

      <button onClick={searchPlaces}>搜索</button>

    <ul style={{ listStyle: "none", padding: 0 }}>
  {Array.isArray(results) &&
    results.map((place, index) => (
      <li
        key={index}
        onClick={() => handleRouteToPlace(place)}
        style={{
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 12,
          marginBottom: 16,
          maxWidth: 400,
          boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
          cursor: "pointer",
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
        <div style={{ fontWeight: "bold", fontSize: 16 }}>
          {place.name}
        </div>

        {/* ⭐ 评分 */}
        <div style={{ color: "#f5a623" }}>
          ⭐ {place.rating ?? "N/A"}
        </div>

        {/* 📍 地址 */}
        <div style={{ fontSize: 13, color: "#666" }}>
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
        {/* 🔗 跳转 Google Maps */}
<div style={{ marginTop: 8 }}>
<a
  href={`https://www.google.com/maps/dir/?api=1&destination=${place.location.lat},${place.location.lng}`}
  target="_blank"
  rel="noreferrer"
  onClick={(e) => e.stopPropagation()} // ⭐ 防止触发路线
  style={{
    textDecoration: "none",
    color: "#1a73e8",
    fontWeight: "bold",
  }}
>
  👉 在 Google Maps 打开
</a>
</div>
      </li>
    ))}
</ul>
       {/* 🚗 新增路线对话框 */}
    <div style={{ marginTop: 40 }}>
      <h2>Map
路线查询
      </h2>

      <input
        value={routeQuery}
        onChange={(e) => setRouteQuery(e.target.value)}
        placeholder="输入：从A到B怎么走"
        style={{ width: 300 }}
      />

      <button onClick={getRoute} style={{ marginLeft: 10 }}>
        查询路线
      </button>

      {routeResult && (
        <div style={{ marginTop: 20 }}>
          <p>📍 起点: {routeResult.from}</p>
          <p>🏁 终点: {routeResult.to}</p>
          <p>📏 距离: {routeResult.distance}</p>
          <p>⏱️ 时间: {routeResult.duration}</p>
        </div>
      )}
    </div>

    <LoadScript
        googleMapsApiKey="AIzaSyDmJYMiPEdbrS6_Nfn_QwfSPYdlWjieh50"
        libraries={["geometry"]}
      >
     
  <div style={{ position: "relative" }}>
  <div
    style={{
      position: "absolute",
      top: 10,
      right: 10,
      background: "white",
      padding: "10px 12px",
      borderRadius: 8,
      boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
      fontSize: 12,
      zIndex: 10,
    }}
  >
    <div>🔵 Me</div>
    <div>🟢 Start</div>
    <div>🔴 End</div>
  </div>
        <GoogleMap
  key={JSON.stringify(path)}
  mapContainerStyle={{ width: "100%", height: "400px" }}
  center={center}
  zoom={13}
>
  {/* 👤 用户位置 */}
{userLocation && (
  <Marker
    position={userLocation}
    icon={{
      url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
    }}
  />
)}

  {/* 🟢 起点 */}
{start && (
  <Marker
    position={start}
    icon={{
      url: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
    }}
    title="起点"
  />
)}
{end && (
  <Marker
    position={end}
    icon={{
      url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
    }}
    title="终点"
  />
)}

  {/* 🛣️ 路线 */}
  {path.length > 0 && (
    <>
      <Polyline
        path={path}
        options={{
          strokeColor: "#6fa8ff",
          strokeOpacity: 0.4,
          strokeWeight: 12,
        }}
      />
      <Polyline
        path={path}
        options={{
          strokeColor: "#1a73e8",
          strokeOpacity: 1,
          strokeWeight: 6,
        }}
      />
    </>
  )}
</GoogleMap>
</div>

      </LoadScript>


    </div>
  );
}

export default App;