import React, { useState, useEffect } from "react";
import MapView from "../components/MapView";
import SearchBar from "../components/SearchBar";
import PlaceCard from "../components/PlaceCard";
import { LoadScript } from "@react-google-maps/api";



function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [routeQuery, setRouteQuery] = useState("");
  const [routeResult, setRouteResult] = useState(null);
  const [path, setPath] = useState([]);
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [expandedPlace, setExpandedPlace] =
  useState(null);
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
    // 🌍 Step 1：经纬度转地址
    const geoRes = await fetch(
      `http://localhost:3001/reverse-geocode?lat=${userLocation.lat}&lng=${userLocation.lng}`
    );

    const geoData = await geoRes.json();

    const fromAddress = geoData.address;

    console.log("我的地址:", fromAddress);

    // 🚗 Step 2：拼 route query
    const query = `${fromAddress} to ${place.address}`;

    setRouteQuery(query);

    // 🚀 Step 3：请求路线
    const res = await fetch(
      `http://localhost:3001/route?q=${encodeURIComponent(query)}`
    );

    const data = await res.json();

    setRouteResult(data);

    // 🗺️ Step 4：解析路线
    if (!window.google) return;

    const decoded =
      window.google.maps.geometry.encoding.decodePath(
        data.polyline
      );

    const newPath = decoded.map((p) => ({
      lat: p.lat(),
      lng: p.lng(),
    }));

    setPath(newPath);
    setStart(newPath[0]);
    // ⭐ 终点
    setEnd(newPath[newPath.length - 1]);

    // ⭐ 地图居中
    setCenter(
      newPath[Math.floor(newPath.length / 2)]
    );
  } catch (err) {
    console.error("自动路线失败:", err);
  }
};
  return (
    <LoadScript
  googleMapsApiKey="AIzaSyDmJYMiPEdbrS6_Nfn_QwfSPYdlWjieh50"
  libraries={["geometry"]}
>
    <div style={{ padding: 20 }}>
      <h2>Google Maps Search</h2>

      <SearchBar
  query={query}
  setQuery={setQuery}
  searchPlaces={searchPlaces}
/>

    <ul
      style={{
        listStyle: "none",
        padding: 0,

       display: "flex",
flexWrap: "wrap",
gap: 20,
alignItems: "flex-start",
      }}
    >
  
    {Array.isArray(results) &&
  results.map((place, index) => (
<PlaceCard
  key={index}
  place={place}

  handleRouteToPlace={handleRouteToPlace}

  expandedPlace={expandedPlace}
  setExpandedPlace={setExpandedPlace}

  path={path}
  center={center}
  userLocation={userLocation}
  start={start}
  end={end}
/>
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

    <MapView
  path={path}
  center={center}
  userLocation={userLocation}
  start={start}
  end={end}
/>


    </div>
    </LoadScript>
  );
}

export default App;