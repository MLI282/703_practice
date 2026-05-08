const fs = require("fs");
const path = require("path");

function readJsonIfExists(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function loadProducts() {
  return readJsonIfExists(
    path.join(__dirname, "../data/products.json"),
    []
  );
}

function loadPlaces() {
  return readJsonIfExists(
    path.join(__dirname, "../data/places.json"),
    []
  );
}

module.exports = {
  loadProducts,
  loadPlaces,
};
