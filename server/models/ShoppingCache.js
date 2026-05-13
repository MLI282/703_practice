const mongoose = require("mongoose");

const shoppingCacheSchema = new mongoose.Schema(
  {
    cacheKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    kind: {
      type: String,
      enum: ["intent", "products", "stores", "place_intent", "places"],
      required: true,
      index: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  {
    timestamps: true,
    collection: "shopping_caches",
  }
);

module.exports = mongoose.model("ShoppingCache", shoppingCacheSchema);
