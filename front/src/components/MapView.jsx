import React from "react";

import {
  GoogleMap,
  
  Polyline,
  Marker,
} from "@react-google-maps/api";

function MapView({
  path,
  center,
  userLocation,
  start,
  end,
}) {
  return (
    //AIzaSyDmJYMiPEdbrS6_Nfn_QwfSPYdlWjieh50

      <div style={{ position: "relative" }}>
        {/* 🏷️ 图例 */}
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
          mapContainerStyle={{
            width: "100%",
            height: "400px",
          }}
          center={center}
          zoom={13}
        >
          {/* 👤 用户 */}
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
            />
          )}

          {/* 🔴 终点 */}
          {end && (
            <Marker
              position={end}
              icon={{
                url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
              }}
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
    
  );
}

export default MapView;