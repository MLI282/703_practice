const mongoose = require("mongoose");

const searchUsageSchema = new mongoose.Schema(
  {
    subjectType: {
      type: String,
      enum: ["anonymous", "user"],
      required: true,
      index: true,
    },
    subjectKey: {
      type: String,
      required: true,
      index: true,
    },
    dateKey: {
      type: String,
      required: true,
      index: true,
    },
    count: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: "search_usages",
  }
);

searchUsageSchema.index(
  { subjectType: 1, subjectKey: 1, dateKey: 1 },
  { unique: true }
);

module.exports = mongoose.model("SearchUsage", searchUsageSchema);
