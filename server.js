const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, "data", "tasks.json");
const PUBLIC_DIR = path.join(ROOT, "public");

const starterTasks = [
  {
    id: "tp-001",
    title: "Finalize Q4 product roadmap",
    category: "Development",
    estimatedHours: 8,
    daysToDeadline: 1,
    dependencyCount: 2,
    assigneeRole: "Developer",
    status: "Pending"
  },
  {
    id: "tp-002",
    title: "Review customer interview notes",
    category: "Documentation",
    estimatedHours: 3,
    daysToDeadline: 1,
    dependencyCount: 0,
    assigneeRole: "Analyst",
    status: "Pending"
  },
  {
    id: "tp-003",
    title: "Prepare sprint planning agenda",
    category: "Meeting",
    estimatedHours: 2,
    daysToDeadline: 2,
    dependencyCount: 0,
    assigneeRole: "Manager",
    status: "Pending"
  },
  {
    id: "tp-004",
    title: "Update onboarding checklist",
    category: "Documentation",
    estimatedHours: 4,
    daysToDeadline: 3,
    dependencyCount: 1,
    assigneeRole: "Analyst",
    status: "Pending"
  },
  {
    id: "tp-005",
    title: "Share weekly progress with team",
    category: "Meeting",
    estimatedHours: 1,
    daysToDeadline: 0,
    dependencyCount: 0,
    assigneeRole: "Manager",
    status: "Completed"
  },
  {
    id: "tp-006",
    title: "Explore dashboard accessibility improvements",
    category: "Testing",
    estimatedHours: 6,
    daysToDeadline: 4,
    dependencyCount: 1,
    assigneeRole: "Tester",
    status: "Pending"
  },
  {
    id: "tp-007",
    title: "Send research follow-up questions",
    category: "Documentation",
    estimatedHours: 2,
    daysToDeadline: 0,
    dependencyCount: 0,
    assigneeRole: "Analyst",
    status: "Pending"
  },
  {
    id: "tp-008",
    title: "Document API integration decisions",
    category: "Documentation",
    estimatedHours: 5,
    daysToDeadline: 5,
    dependencyCount: 0,
    assigneeRole: "Developer",
    status: "Pending"
  }
];

function ensureDataFile() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, `${JSON.stringify(starterTasks, null, 2)}\n`);
  }
}

function readTasks() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeTasks(tasks) {
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(tasks, null, 2)}\n`);
}

function scoreTask(task) {
  const priority = task.daysToDeadline <= 1 ||
    (task.daysToDeadline <= 3 && task.estimatedHours >= 6)
    ? "High"
    : task.daysToDeadline <= 5 || task.category === "Development"
      ? "Medium"
      : "Low";
  return { priority };
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(value));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    request.on("error", reject);
  });
}

function validTask(task) {
  return (
    typeof task.title === "string" &&
    task.title.trim().length > 0 &&
    ["Development", "Testing", "Documentation", "Meeting"].includes(task.category) &&
    typeof task.estimatedHours === "number" &&
    task.estimatedHours >= 0.5 && task.estimatedHours <= 40 &&
    Number.isFinite(task.daysToDeadline) &&
    task.daysToDeadline >= 0 && task.daysToDeadline <= 365 &&
    Number.isInteger(task.dependencyCount) &&
    task.dependencyCount >= 0 && task.dependencyCount <= 50 &&
    ["Developer", "Tester", "Analyst", "Manager"].includes(task.assigneeRole) &&
    ["Pending", "Completed"].includes(task.status)
  );
}

async function handleApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/tasks") {
    const tasks = readTasks()
      .map((task) => ({ ...task, ...scoreTask(task) }))
      .sort((a, b) => ["High", "Medium", "Low"].indexOf(a.priority) -
        ["High", "Medium", "Low"].indexOf(b.priority));
    return sendJson(response, 200, tasks);
  }

  if (request.method === "POST" && url.pathname === "/api/tasks") {
    try {
      const input = await readBody(request);
      if (!validTask(input)) {
        return sendJson(response, 400, {
          error: "Provide a title, project, valid due date, status, and 1–5 ratings."
        });
      }
      const tasks = readTasks();
      const task = {
        id: randomUUID(),
        title: input.title.trim(),
        category: input.category,
        estimatedHours: input.estimatedHours,
        daysToDeadline: input.daysToDeadline,
        dependencyCount: input.dependencyCount,
        assigneeRole: input.assigneeRole,
        status: input.status
      };
      tasks.push(task);
      writeTasks(tasks);
      return sendJson(response, 201, { ...task, ...scoreTask(task) });
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  const taskRoute = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
  if (taskRoute && request.method === "PATCH") {
    try {
      const updates = await readBody(request);
      const tasks = readTasks();
      const index = tasks.findIndex((task) => task.id === taskRoute[1]);
      if (index === -1) return sendJson(response, 404, { error: "Task not found." });
      const candidate = { ...tasks[index], ...updates };
      if (!validTask(candidate)) {
        return sendJson(response, 400, { error: "The updated task is invalid." });
      }
      tasks[index] = candidate;
      writeTasks(tasks);
      return sendJson(response, 200, { ...candidate, ...scoreTask(candidate) });
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (taskRoute && request.method === "DELETE") {
    const tasks = readTasks();
    const remaining = tasks.filter((task) => task.id !== taskRoute[1]);
    if (remaining.length === tasks.length) {
      return sendJson(response, 404, { error: "Task not found." });
    }
    writeTasks(remaining);
    response.writeHead(204);
    return response.end();
  }

  return sendJson(response, 404, { error: "API route not found." });
}

function serveStatic(request, response, url) {
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.resolve(PUBLIC_DIR, `.${requestedPath}`);
  if (!filePath.startsWith(`${PUBLIC_DIR}${path.sep}`)) {
    response.writeHead(403);
    return response.end("Forbidden");
  }
  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      return response.end("Not found");
    }
    const extension = path.extname(filePath);
    const contentType = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".svg": "image/svg+xml"
    }[extension] || "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType });
    response.end(content);
  });
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) {
    handleApi(request, response, url).catch((error) => {
      console.error("API request failed:", error);
      sendJson(response, 500, { error: "The server could not complete the request." });
    });
    return;
  }
  serveStatic(request, response, url);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`TaskPulse is running at http://localhost:${PORT}`);
  console.log(`Task data is saved in ${path.relative(ROOT, DATA_FILE)}`);
});
