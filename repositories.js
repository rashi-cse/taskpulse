const mongoose = require("mongoose");

function normalizeTask(task) {
  if (!task) return null;
  const value = typeof task.toObject === "function" ? task.toObject() : task;
  return {
    id: String(value._id || value.id),
    title: value.title,
    category: value.category,
    estimatedHours: value.estimatedHours,
    daysToDeadline: value.daysToDeadline,
    dependencyCount: value.dependencyCount,
    assigneeRole: value.assigneeRole,
    status: value.status,
    priority: value.priority,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt
  };
}

function createMongoRepositories({ User, Task }) {
  return {
    userRepository: {
      async findByEmail(email) {
        const user = await User.findOne({ email }).select("+passwordHash").lean();
        if (!user) return null;
        return { id: String(user._id), name: user.name, email: user.email, passwordHash: user.passwordHash };
      },
      async findById(id) {
        const user = await User.findById(id).lean();
        return user ? { id: String(user._id), name: user.name, email: user.email } : null;
      },
      async create(user) {
        const created = await User.create(user);
        return { id: String(created._id), name: created.name, email: created.email };
      }
    },
    taskRepository: {
      async listForUser(userId) {
        const tasks = await Task.find({ userId }).sort({ createdAt: -1 }).lean();
        return tasks.map(normalizeTask);
      },
      async createForUser(userId, input) {
        const created = await Task.create({ ...input, userId });
        return normalizeTask(created);
      },
      async findForUser(userId, id) {
        if (!mongoose.isValidObjectId(id)) return null;
        const task = await Task.findOne({ _id: id, userId }).lean();
        return normalizeTask(task);
      },
      async updateForUser(userId, id, updates) {
        if (!mongoose.isValidObjectId(id)) return null;
        const updated = await Task.findOneAndUpdate(
          { _id: id, userId },
          { $set: updates },
          { new: true, runValidators: true }
        ).lean();
        return normalizeTask(updated);
      },
      async deleteForUser(userId, id) {
        if (!mongoose.isValidObjectId(id)) return false;
        return Boolean(await Task.findOneAndDelete({ _id: id, userId }));
      }
    }
  };
}

module.exports = { createMongoRepositories, normalizeTask };
