const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("node:path");

const PUBLIC_DIR = path.join(__dirname, "public");
const categories = ["Development", "Testing", "Documentation", "Meeting"];
const roles = ["Developer", "Tester", "Analyst", "Manager"];
const statuses = ["Pending", "Completed"];

function calculatePriority(task) {
  if (task.daysToDeadline <= 1 ||
      (task.daysToDeadline <= 3 && task.estimatedHours >= 6)) return "High";
  if (task.daysToDeadline <= 5 || task.category === "Development") return "Medium";
  return "Low";
}

function isValidTask(task) {
  return typeof task.title === "string" &&
    task.title.trim().length > 0 &&
    task.title.trim().length <= 120 &&
    categories.includes(task.category) &&
    typeof task.estimatedHours === "number" &&
    Number.isFinite(task.estimatedHours) &&
    task.estimatedHours >= 0.5 && task.estimatedHours <= 40 &&
    typeof task.daysToDeadline === "number" &&
    Number.isInteger(task.daysToDeadline) &&
    task.daysToDeadline >= 0 && task.daysToDeadline <= 365 &&
    Number.isInteger(task.dependencyCount) &&
    task.dependencyCount >= 0 && task.dependencyCount <= 50 &&
    roles.includes(task.assigneeRole) &&
    statuses.includes(task.status);
}

function taskInput(body) {
  return {
    title: typeof body.title === "string" ? body.title.trim() : body.title,
    category: body.category,
    estimatedHours: body.estimatedHours,
    daysToDeadline: body.daysToDeadline,
    dependencyCount: body.dependencyCount,
    assigneeRole: body.assigneeRole,
    status: body.status
  };
}

function createApp({ userRepository, taskRepository, jwtSecret }) {
  if (!userRepository || !taskRepository || !jwtSecret) {
    throw new Error("User repository, task repository, and JWT secret are required.");
  }

  const app = express();
  app.use(express.json({ limit: "32kb" }));

  function authenticate(request, response, next) {
    const header = request.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return response.status(401).json({ error: "Authentication token required." });
    try {
      const payload = jwt.verify(token, jwtSecret);
      request.userId = payload.sub;
      next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
        return response.status(401).json({ error: "Invalid or expired authentication token." });
      }
      return next(error);
    }
  }

  app.post("/api/auth/register", async (request, response, next) => {
    try {
      const body = request.body || {};
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const password = typeof body.password === "string" ? body.password : "";
      if (name.length < 2 || name.length > 60 ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
          password.length < 8 || password.length > 128) {
        return response.status(400).json({
          error: "Enter a name, valid email, and password between 8 and 128 characters."
        });
      }
      if (await userRepository.findByEmail(email)) {
        return response.status(409).json({ error: "An account with that email already exists." });
      }
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await userRepository.create({ name, email, passwordHash });
      const token = jwt.sign({ sub: user.id }, jwtSecret, { expiresIn: "7d" });
      return response.status(201).json({
        token,
        user: { id: user.id, name: user.name, email: user.email }
      });
    } catch (error) {
      if (error.code === 11000) {
        return response.status(409).json({ error: "An account with that email already exists." });
      }
      return next(error);
    }
  });

  app.post("/api/auth/login", async (request, response, next) => {
    try {
      const body = request.body || {};
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const password = typeof body.password === "string" ? body.password : "";
      const user = await userRepository.findByEmail(email);
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return response.status(401).json({ error: "Email or password is incorrect." });
      }
      const token = jwt.sign({ sub: user.id }, jwtSecret, { expiresIn: "7d" });
      return response.json({ token, user: { id: user.id, name: user.name, email: user.email } });
    } catch (error) {
      return next(error);
    }
  });

  app.get("/api/auth/me", authenticate, async (request, response, next) => {
    try {
      const user = await userRepository.findById(request.userId);
      if (!user) return response.status(401).json({ error: "Account no longer exists." });
      return response.json({ id: user.id, name: user.name, email: user.email });
    } catch (error) {
      return next(error);
    }
  });

  app.get("/api/tasks", authenticate, async (request, response, next) => {
    try {
      const tasks = await taskRepository.listForUser(request.userId);
      tasks.sort((a, b) => ["High", "Medium", "Low"].indexOf(calculatePriority(a)) -
        ["High", "Medium", "Low"].indexOf(calculatePriority(b)));
      return response.json(tasks.map((task) => ({ ...task, priority: calculatePriority(task) })));
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/tasks", authenticate, async (request, response, next) => {
    try {
      const input = taskInput(request.body || {});
      if (!isValidTask(input)) {
        return response.status(400).json({
          error: "Provide a title, valid category, effort (0.5–40 hours), deadline (0–365 days), dependency count (0–50), role, and Pending or Completed status."
        });
      }
      const task = await taskRepository.createForUser(request.userId, {
        ...input,
        priority: calculatePriority(input)
      });
      return response.status(201).json(task);
    } catch (error) {
      return next(error);
    }
  });

  app.patch("/api/tasks/:id", authenticate, async (request, response, next) => {
    try {
      const current = await taskRepository.findForUser(request.userId, request.params.id);
      if (!current) return response.status(404).json({ error: "Task not found." });
      const changes = taskInput({ ...current, ...(request.body || {}) });
      if (!isValidTask(changes)) {
        return response.status(400).json({
          error: "Task update is invalid. Check the title, category, effort, deadline, dependency count, role, and status."
        });
      }
      const updated = await taskRepository.updateForUser(request.userId, request.params.id, {
        ...changes,
        priority: calculatePriority(changes)
      });
      if (!updated) return response.status(404).json({ error: "Task not found." });
      return response.json(updated);
    } catch (error) {
      return next(error);
    }
  });

  app.delete("/api/tasks/:id", authenticate, async (request, response, next) => {
    try {
      const deleted = await taskRepository.deleteForUser(request.userId, request.params.id);
      if (!deleted) return response.status(404).json({ error: "Task not found." });
      return response.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  app.use("/api", (request, response) => response.status(404).json({ error: "API route not found." }));
  app.use(express.static(PUBLIC_DIR));
  app.get("*", (request, response) => response.sendFile(path.join(PUBLIC_DIR, "index.html")));
  app.use((error, request, response, next) => {
    if (response.headersSent) return next(error);
    if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
      return response.status(400).json({ error: "Request body must be valid JSON." });
    }
    console.error("Request failed:", error.message);
    return response.status(500).json({ error: "The server could not complete the request." });
  });

  return app;
}

module.exports = { calculatePriority, createApp, isValidTask };
