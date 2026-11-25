const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  category: {
    type: String,
    enum: ["Development", "Testing", "Documentation", "Meeting"],
    required: true
  },
  estimatedHours: { type: Number, required: true, min: 0.5, max: 40 },
  daysToDeadline: { type: Number, required: true, min: 0, max: 365 },
  dependencyCount: { type: Number, required: true, min: 0, max: 50 },
  assigneeRole: { type: String, enum: ["Developer", "Tester", "Analyst", "Manager"], required: true },
  priority: { type: String, enum: ["High", "Medium", "Low"], required: true },
  status: { type: String, enum: ["Pending", "Completed"], default: "Pending", required: true }
}, { timestamps: true });

module.exports = mongoose.models.Task || mongoose.model("Task", taskSchema);
