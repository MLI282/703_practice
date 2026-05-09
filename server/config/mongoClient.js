const mongoose = require("mongoose");
const { User, UserHistory, UserInfo } = require("../models");

const DEFAULT_MONGO_URI = "mongodb://127.0.0.1:27017/agent_search";

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
  ]);

  await Promise.all([
    User.syncIndexes(),
    UserHistory.syncIndexes(),
    UserInfo.syncIndexes(),
  ]);
}

module.exports = {
  connectMongo,
  disconnectMongo,
  ensureMongoCollections,
};
