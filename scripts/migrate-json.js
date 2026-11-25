require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const mongoose = require("mongoose");
const User = require("../models/User");
const Task = require("../models/Task");
const { calculatePriority } = require("../app");

async function migrateJson() {
  const { MONGO_URI, MIGRATION_EMAIL } = process.env;
  const source = path.resolve(
    process.env.LEGACY_TASKS_FILE || path.join(__dirname, "..", "data", "tasks.json")
  );
  if (!MONGO_URI || !MIGRATION_EMAIL) {
    throw new Error("Set MONGO_URI and MIGRATION_EMAIL in .env before migrating.");
  }
  if (!fs.existsSync(source)) {
    throw new Error(`No legacy task file found at ${source}.`);
  }
  await mongoose.connect(MONGO_URI);
  const user = await User.findOne({ email: MIGRATION_EMAIL.trim().toLowerCase() });
  if (!user) throw new Error("Register the destination account in TaskPulse before migrating.");
  const existingCount = await Task.countDocuments({ userId: user._id });
  if (existingCount > 0) {
    throw new Error(`The destination account already has ${existingCount} tasks; migration stopped to avoid duplicates.`);
  }

  const legacyTasks = JSON.parse(fs.readFileSync(source, "utf8"));
  const migratedTasks = legacyTasks.map((task) => {
    const migrated = {
      userId: user._id,
      title: task.title,
      category: task.category,
      estimatedHours: Number(task.estimatedHours),
      daysToDeadline: Number(task.daysToDeadline),
      dependencyCount: Number(task.dependencyCount),
      assigneeRole: task.assigneeRole,
      status: ["Completed", "Done"].includes(task.status) ? "Completed" : "Pending"
    };
    migrated.priority = calculatePriority(migrated);
    return migrated;
  });
  await Task.insertMany(migratedTasks);
  console.log(`Migrated ${migratedTasks.length} tasks to ${user.email}. The JSON file was left unchanged.`);
}

migrateJson()
  .catch((error) => {
    console.error("Could not migrate tasks:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect());
