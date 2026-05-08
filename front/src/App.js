import React from "react";

import {
  Routes,
  Route,
} from "react-router-dom";

import Home from "./pages/Home";
import Shop from "./pages/Shop";

function App() {
  return (
    <Routes>

      {/* 🗺️ 地图页 */}
      <Route
        path="/"
        element={<Home />}
      />

      {/* 🛒 电商页 */}
      <Route
        path="/shop"
        element={<Shop />}
      />

    </Routes>
  );
}

export default App;