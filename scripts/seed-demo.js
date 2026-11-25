require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Task = require("../models/Task");
const { calculatePriority } = require("../app");

async function seedDemo() {
  const { MONGO_URI, DEMO_NAME, DEMO_EMAIL, DEMO_PASSWORD } = process.env;
  if (!MONGO_URI || !DEMO_NAME || !DEMO_EMAIL || !DEMO_PASSWORD) {
    throw new Error("Set MONGO_URI, DEMO_NAME, DEMO_EMAIL, and DEMO_PASSWORD in .env first.");
  }
  if (DEMO_PASSWORD.length < 8) throw new Error("DEMO_PASSWORD must be at least 8 characters.");
  await mongoose.connect(MONGO_URI);
  const email = DEMO_EMAIL.trim().toLowerCase();
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      name: DEMO_NAME.trim(),
      email,
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12)
    });
  }

  const count = await Task.countDocuments({ userId: user._id });
  if (count === 0) {
    const starterTasks = JSON.parse(fs.readFileSync(
      path.join(__dirname, "..", "data", "starter-tasks.json"),
      "utf8"
    ));
    await Task.insertMany(starterTasks.map((task) => ({
      ...task,
      userId: user._id,
      priority: calculatePriority(task)
    })));
    console.log(`Seeded ${starterTasks.length} illustrative tasks for ${email}.`);
  } else {
    console.log(`Account ${email} already has tasks; no sample data was added.`);
  }
  await mongoose.disconnect();
}

seedDemo().catch(async (error) => {
  console.error("Could not seed demo account:", error.message);
  await mongoose.disconnect();
  process.exitCode = 1;
});
