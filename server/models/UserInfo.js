const mongoose = require("mongoose");

const userInfoSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    displayName: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    avatarUrl: {
      type: String,
      trim: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    gender: {
      type: String,
      enum: ["male", "female", "other", "prefer_not_to_say", ""],
      default: "",
    },
    birthday: {
      type: Date,
      default: null,
    },
    address: {
      country: { type: String, default: "" },
      city: { type: String, default: "" },
      line1: { type: String, default: "" },
      line2: { type: String, default: "" },
      postcode: { type: String, default: "" },
    },
    preferences: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: "user_infos",
  }
);

module.exports = mongoose.model("UserInfo", userInfoSchema);
