const mongoose = require("mongoose");

const userHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["search", "route", "shopping", "agent_search"],
      default: "search",
      index: true,
    },
    query: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      lat: Number,
      lng: Number,
    },
    requestMeta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    resultSummary: {
      type: String,
      default: "",
    },
    results: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: "user_histories",
  }
);

userHistorySchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("UserHistory", userHistorySchema);
