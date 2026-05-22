const mongoose = require("mongoose");
const {
  User,
  UserHistory,
  UserInfo,
  ShoppingCache,
  Advertisement,
} = require("../models");

const DEFAULT_MONGO_URI = "mongodb://127.0.0.1:27017/agent_search";
const DEFAULT_ADVERTISEMENTS = [
  {
    title: "Study gear deals",
    imageUrl:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
    websiteUrl: "https://www.pbtech.co.nz/",
    displayOrder: 1,
  },
  {
    title: "Campus coffee offers",
    imageUrl:
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80",
    websiteUrl: "https://www.starbucks.co.nz/",
    displayOrder: 2,
  },
  {
    title: "Travel around Auckland",
    imageUrl:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
    websiteUrl: "https://at.govt.nz/",
    displayOrder: 3,
  },
];

function getMongoUri() {
  return process.env.MONGODB_URI || DEFAULT_MONGO_URI;
}

function maskMongoUri(uri) {
  return uri.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@");
}

async function connectMongo() {
  const mongoUri = getMongoUri();
  const dbName = process.env.MONGODB_DB_NAME;

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  mongoose.connection.on("connected", () => {
    console.log("MongoDB connected");
  });

  mongoose.connection.on("error", (err) => {
    console.error("MongoDB connection error:", err);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected");
  });

  const connectOptions = {
    serverSelectionTimeoutMS: 5000,
  };

  if (dbName) {
    connectOptions.dbName = dbName;
  }

  await mongoose.connect(mongoUri, connectOptions);

  console.log(
    `MongoDB using ${mongoose.connection.name} at ${maskMongoUri(mongoUri)}`
  );

  return mongoose.connection;
}

async function disconnectMongo() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

async function ensureMongoCollections() {
  await Promise.all([
    User.createCollection(),
    UserHistory.createCollection(),
    UserInfo.createCollection(),
    ShoppingCache.createCollection(),
    Advertisement.createCollection(),
  ]);

  await Promise.all([
    User.syncIndexes(),
    UserHistory.syncIndexes(),
    UserInfo.syncIndexes(),
    ShoppingCache.syncIndexes(),
    Advertisement.syncIndexes(),
  ]);

  const advertisementCount = await Advertisement.estimatedDocumentCount();

  if (advertisementCount === 0) {
    await Advertisement.insertMany(DEFAULT_ADVERTISEMENTS);
  }
}

module.exports = {
  connectMongo,
  disconnectMongo,
  ensureMongoCollections,
};
