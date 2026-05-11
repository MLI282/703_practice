import React, { useState } from "react";

const PRODUCT_RESULT_LIMIT = 8;

function isProductResult(item) {
  return Boolean(item.product_title || item.type === "product");
}

function limitProductResults(data) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.some(isProductResult) ? data.slice(0, PRODUCT_RESULT_LIMIT) : data;
}

function getImageUrl(item) {
  return item.photo_url || item.product_image || item.store_photo || "";
}

function getTitle(item) {
  return item.name || item.product_title || item.nearby_store || "Result";
}

function getSubtitle(item) {
  if (item.product_title) {
    return item.merchant?.name || item.nearby_store || "";
  }

  return item.address || item.store_address || item.source || "";
}

function AgentResultCard({ item }) {
  const imageUrl = getImageUrl(item);
  const title = getTitle(item);
  const subtitle = getSubtitle(item);
  const isProduct = Boolean(item.product_title);
  const merchant = item.merchant || {};
  const merchantName = merchant.name || item.nearby_store;
  const merchantAddress = merchant.address || item.store_address;
  const merchantRating = merchant.rating ?? item.store_rating;
  const merchantDistance = merchant.distance_text || item.distance_text;
  const merchantDuration = merchant.duration_text || item.duration_text;
  const merchantLocation = merchant.location || item.store_location;
  const merchantMapsUrl = merchantLocation?.lat && merchantLocation?.lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${merchantLocation.lat},${merchantLocation.lng}`
    : merchantAddress || merchantName
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
          merchantAddress || merchantName
        )}`
      : "";

  return (
    <li
      style={{
        width: 340,
        background: "white",
        border: "1px solid #e6e8ef",
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
      }}
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt={title}
          style={{
            width: "100%",
            height: 190,
            objectFit: "cover",
            background: "#f1f3f6",
          }}
        />
      )}

      <div style={{ padding: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "flex-start",
            marginBottom: 8,
          }}
        >
          <div style={{ fontWeight: "bold", fontSize: 17, lineHeight: 1.35 }}>
            {title}
          </div>

          <div
            style={{
              flex: "0 0 auto",
              minWidth: 34,
              textAlign: "center",
              padding: "4px 8px",
              borderRadius: 8,
              background: "#e8f0fe",
              color: "#1a73e8",
              fontWeight: "bold",
              fontSize: 13,
            }}
          >
            #{item.compare_rank ?? "-"}
          </div>
        </div>

        {subtitle && (
          <div
            style={{
              color: "#5f6368",
              fontSize: 13,
              lineHeight: 1.45,
              marginBottom: 10,
            }}
          >
            {subtitle}
          </div>
        )}

        {isProduct && item.product_price && (
          <div
            style={{
              color: "#1a73e8",
              fontSize: 22,
              fontWeight: "bold",
              marginBottom: 8,
            }}
          >
            {item.product_price}
          </div>
        )}

        {isProduct && merchantName && (
          <div
            style={{
              display: "grid",
              gap: 8,
              padding: 12,
              borderRadius: 8,
              background: "#f8fafd",
              border: "1px solid #e6e8ef",
              marginBottom: 12,
              fontSize: 13,
              lineHeight: 1.4,
            }}
          >
            <div>
              <div
                style={{
                  color: "#5f6368",
                  fontSize: 11,
                  fontWeight: "bold",
                  textTransform: "uppercase",
                  marginBottom: 3,
                }}
              >
                Seller
              </div>
              <strong>{merchantName}</strong>
            </div>
            {merchantAddress && <div>Address: {merchantAddress}</div>}
            {merchantRating && <div>Rating: {merchantRating}</div>}
            {(merchantDistance || merchantDuration) && (
              <div>
                Nearby: {[merchantDistance, merchantDuration].filter(Boolean).join(" · ")}
              </div>
            )}
            {merchantMapsUrl && (
              <a
                href={merchantMapsUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  justifySelf: "start",
                  padding: "7px 10px",
                  borderRadius: 8,
                  border: "1px solid #d7dbe5",
                  background: "white",
                  color: "#3c4043",
                  textDecoration: "none",
                  fontWeight: "bold",
                }}
              >
                Open in Google Maps
              </a>
            )}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {!isProduct && (item.rating || item.store_rating) && (
            <div style={{ color: "#f5a623" }}>
              Rating: {item.rating ?? item.store_rating}
            </div>
          )}

          {!isProduct && item.distance_text && (
            <div style={{ color: "#3c4043" }}>
              Distance: {item.distance_text}
            </div>
          )}

          {!isProduct && item.duration_text && (
            <div style={{ color: "#3c4043" }}>
              Time: {item.duration_text}
            </div>
          )}

          {item.best_for && (
            <div style={{ color: "#188038" }}>Best for: {item.best_for}</div>
          )}
        </div>

        {item.compare_reason && (
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: "#f8fafd",
              color: "#3c4043",
              fontSize: 13,
              lineHeight: 1.45,
              marginBottom: 12,
            }}
          >
            {item.compare_reason}
          </div>
        )}

        {item.product_link && (
          <a
            href={item.product_link}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "block",
              textAlign: "center",
              padding: "11px 12px",
              borderRadius: 8,
              background: "#1a73e8",
              color: "white",
              textDecoration: "none",
              fontWeight: "bold",
            }}
          >
            View Product
          </a>
        )}

        {!item.product_link && item.location && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${item.location.lat},${item.location.lng}`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "block",
              textAlign: "center",
              padding: "11px 12px",
              borderRadius: 8,
              background: "#1a73e8",
              color: "white",
              textDecoration: "none",
              fontWeight: "bold",
            }}
          >
            Open in Google Maps
          </a>
        )}
      </div>
    </li>
  );
}

function AgentSearchPanel({ center }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const searchAgent = async () => {
    if (!query.trim()) {
      setResults([]);
      setError("");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await fetch(
        `http://localhost:3001/agent-search?q=${encodeURIComponent(
          query
        )}&lat=${center.lat}&lng=${center.lng}`
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Agent search failed");
      }

      setResults(limitProductResults(data));
    } catch (err) {
      console.error("Agent search failed:", err);
      setResults([]);
      setError(err.message || "Agent search failed");
    } finally {
      setLoading(false);
    }
  };

  const recommendation = results.find((item) => item.agent_recommendation)
    ?.agent_recommendation;

  return (
    <section
      style={{
        marginTop: 36,
        padding: 20,
        border: "1px solid #e6e8ef",
        borderRadius: 12,
        background: "#f8fafd",
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: 14 }}>Agent Workflow Search</h2>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 18,
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Try: compare nearby cheap cafes, or buy a laptop under 1500 NZD"
          style={{
            flex: "1 1 360px",
            minWidth: 240,
            padding: "11px 12px",
            borderRadius: 8,
            border: "1px solid #d7dbe5",
            fontSize: 14,
          }}
        />

        <button
          onClick={searchAgent}
          disabled={loading}
          style={{
            padding: "11px 18px",
            borderRadius: 8,
            border: "none",
            background: loading ? "#9bbcf4" : "#1a73e8",
            color: "white",
            fontWeight: "bold",
            cursor: loading ? "default" : "pointer",
          }}
        >
          {loading ? "Comparing..." : "Run Agent"}
        </button>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 14,
            padding: 12,
            borderRadius: 8,
            background: "#fce8e6",
            color: "#a50e0e",
          }}
        >
          {error}
        </div>
      )}

      {recommendation && (
        <div
          style={{
            marginBottom: 18,
            padding: 14,
            borderRadius: 10,
            background: "white",
            border: "1px solid #e6e8ef",
            lineHeight: 1.5,
          }}
        >
          <strong>Workflow recommendation: </strong>
          {recommendation}
        </div>
      )}

      {results.length > 0 && (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexWrap: "wrap",
            gap: 20,
            alignItems: "flex-start",
          }}
        >
          {results.map((item, index) => (
            <AgentResultCard key={`${getTitle(item)}-${index}`} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default AgentSearchPanel;
