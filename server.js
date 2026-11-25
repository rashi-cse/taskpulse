require("dotenv").config();

const mongoose = require("mongoose");
const { createApp } = require("./app");
const User = require("./models/User");
const Task = require("./models/Task");
const { createMongoRepositories } = require("./repositories");

const port = Number(process.env.PORT || 3000);
const jwtSecret = process.env.JWT_SECRET;
const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
  console.error("Missing MONGO_URI. Copy .env.example to .env and configure MongoDB.");
  process.exit(1);
}

if (!jwtSecret || jwtSecret.length < 32) {
  console.error("JWT_SECRET must be set to a random value of at least 32 characters.");
  process.exit(1);
}

async function start() {
  await mongoose.connect(mongoUri);
  const app = createApp({
    ...createMongoRepositories({ User, Task }),
    jwtSecret
  });
  const server = app.listen(port, "0.0.0.0");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  console.log(`TaskPulse is running at http://localhost:${port}`);
  console.log("MongoDB connected.");

  const shutdown = async () => {
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch(async (error) => {
  console.error("Could not start TaskPulse:", error.message);
  await mongoose.disconnect();
  process.exit(1);
});
