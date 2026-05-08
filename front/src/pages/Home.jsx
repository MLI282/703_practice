import React, { useState, useEffect } from "react";
import { LoadScript } from "@react-google-maps/api";
import MapView from "../components/MapView";
import SearchBar from "../components/SearchBar";
import PlaceCard from "../components/PlaceCard";
import AgentSearchPanel from "../components/AgentSearchPanel";

function Home() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [routeQuery, setRouteQuery] = useState("");
  const [routeResult, setRouteResult] = useState(null);
  const [path, setPath] = useState([]);
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [expandedPlace, setExpandedPlace] = useState(null);
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

        setUserLocation(loc);
        setCenter(loc);
      },
      (error) => {
        console.log("Location failed:", error);
      }
    );
  }, []);

  const searchPlaces = async () => {
    const res = await fetch(
      `http://localhost:3001/search?q=${encodeURIComponent(query)}&lat=${
        center.lat
      }&lng=${center.lng}`
    );
    const data = await res.json();
    setResults(Array.isArray(data) ? data : []);
  };

  const applyRouteToMap = (data) => {
    setRouteResult(data);

    if (!window.google) {
      console.log("Google Maps is not loaded");
      return;
    }

    const decoded = window.google.maps.geometry.encoding.decodePath(
      data.polyline
    );

    const newPath = decoded.map((p) => ({
      lat: p.lat(),
      lng: p.lng(),
    }));

    setPath(newPath);
    setStart(newPath[0]);
    setEnd(newPath[newPath.length - 1]);

    if (newPath.length > 0) {
      setCenter(newPath[Math.floor(newPath.length / 2)]);
    }
  };

  const getRoute = async () => {
    try {
      setPath([]);
      setRouteResult(null);

      const res = await fetch(
        `http://localhost:3001/route?q=${encodeURIComponent(routeQuery)}`
      );
      const data = await res.json();

      applyRouteToMap(data);
    } catch (err) {
      console.error("Route failed:", err);
    }
  };

  const handleRouteToPlace = async (place) => {
    try {
      let fromAddress = `${center.lat},${center.lng}`;

      if (userLocation) {
        const geoRes = await fetch(
          `http://localhost:3001/reverse-geocode?lat=${userLocation.lat}&lng=${userLocation.lng}`
        );
        const geoData = await geoRes.json();

        if (geoData.address) {
          fromAddress = geoData.address;
        }
      }

      const nextRouteQuery = `${fromAddress} to ${place.address}`;
      setRouteQuery(nextRouteQuery);

      const res = await fetch(
        `http://localhost:3001/route?q=${encodeURIComponent(nextRouteQuery)}`
      );
      const data = await res.json();

      applyRouteToMap(data);
    } catch (err) {
      console.error("Auto route failed:", err);
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
          {results.map((place, index) => (
            <PlaceCard
              key={`${place.name}-${index}`}
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

        <div style={{ marginTop: 40 }}>
          <h2>Route Search</h2>

          <input
            value={routeQuery}
            onChange={(e) => setRouteQuery(e.target.value)}
            placeholder="Enter a route, for example: University of Auckland to Sky Tower"
            style={{
              width: 360,
              maxWidth: "100%",
              padding: 10,
              borderRadius: 8,
              border: "1px solid #ddd",
            }}
          />

          <button
            onClick={getRoute}
            style={{
              marginLeft: 10,
              padding: "10px 16px",
              borderRadius: 8,
              border: "none",
              background: "#1a73e8",
              color: "white",
              cursor: "pointer",
            }}
          >
            Search Route
          </button>

          {routeResult && (
            <div style={{ marginTop: 20 }}>
              <p>From: {routeResult.from}</p>
              <p>To: {routeResult.to}</p>
              <p>Distance: {routeResult.distance}</p>
              <p>Duration: {routeResult.duration}</p>
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

        <AgentSearchPanel center={center} />
      </div>
    </LoadScript>
  );
}

export default Home;
