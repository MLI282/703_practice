require("dotenv").config();

const {
  connectMongo,
  disconnectMongo,
} = require("../config/mongoClient");
const { Advertisement } = require("../models");
const advertisements = require("./advertisements.data");

async function seedAdvertisements() {
  await connectMongo();

  for (const advertisement of advertisements) {
    await Advertisement.findOneAndUpdate(
      {
        $or: [
          { slug: advertisement.slug },
          { title: advertisement.title },
        ],
      },
      advertisement,
      {
        upsert: true,
        returnDocument: "after",
        setDefaultsOnInsert: true,
      }
    );
  }

  console.log(`Seeded ${advertisements.length} advertisements.`);
}

seedAdvertisements()
  .catch((err) => {
    console.error("Advertisement seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectMongo();
  });
