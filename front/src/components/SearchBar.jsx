import React from "react";

function SearchBar({
  query,
  setQuery,
  searchPlaces,
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="输入，比如 cheap pasta nearby"
        style={{
          width: 320,
          padding: 10,
          borderRadius: 8,
          border: "1px solid #ddd",
          marginRight: 10,
        }}
      />

      <button
        onClick={searchPlaces}
        style={{
          padding: "10px 16px",
          borderRadius: 8,
          border: "none",
          background: "#1a73e8",
          color: "white",
          cursor: "pointer",
        }}
      >
        搜索
      </button>
    </div>
  );
}

export default SearchBar;