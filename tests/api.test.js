const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const bcrypt = require("bcryptjs");
const { createApp } = require("../app");

const users = new Map();
const tasks = new Map();
let nextId = 1;
let baseUrl;
let server;
const jwtSecret = "test-only-secret-with-at-least-thirty-two-characters";

const userRepository = {
  async findByEmail(email) {
    return [...users.values()].find((user) => user.email === email) || null;
  },
  async findById(id) {
    return users.get(id) || null;
  },
  async create(user) {
    const created = { ...user, id: `user-${nextId++}` };
    users.set(created.id, created);
    return created;
  }
};

const taskRepository = {
  async listForUser(userId) {
    return [...tasks.values()].filter((task) => task.userId === userId);
  },
  async createForUser(userId, input) {
    const task = { ...input, id: `task-${nextId++}`, userId };
    tasks.set(task.id, task);
    return task;
  },
  async findForUser(userId, id) {
    const task = tasks.get(id);
    return task?.userId === userId ? task : null;
  },
  async updateForUser(userId, id, updates) {
    const task = await this.findForUser(userId, id);
    if (!task) return null;
    const updated = { ...task, ...updates };
    tasks.set(id, updated);
    return updated;
  },
  async deleteForUser(userId, id) {
    if (!(await this.findForUser(userId, id))) return false;
    tasks.delete(id);
    return true;
  }
};

async function request(path, { token, ...options } = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const body = response.status === 204 ? null : await response.json();
  return { response, body };
}

const validTask = {
  title: "Test API authentication",
  category: "Testing",
  estimatedHours: 2,
  daysToDeadline: 3,
  dependencyCount: 1,
  assigneeRole: "Tester",
  status: "Pending"
};

let alice;
let bob;
let createdTask;

before(async () => {
  server = createApp({ userRepository, taskRepository, jwtSecret }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("protected task API rejects unauthenticated requests", async () => {
  const { response, body } = await request("/api/tasks");
  assert.equal(response.status, 401);
  assert.match(body.error, /token required/i);
});

test("register hashes passwords and login issues a bearer token", async () => {
  const registered = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name: "Rashi", email: "Rashi@example.com", password: "example-pass-123" })
  });
  assert.equal(registered.response.status, 201);
  assert.equal(registered.body.user.email, "rashi@example.com");
  alice = registered.body;
  const storedAlice = await userRepository.findByEmail("rashi@example.com");
  assert.notEqual(storedAlice.passwordHash, "example-pass-123");
  assert.equal(await bcrypt.compare("example-pass-123", storedAlice.passwordHash), true);

  const duplicate = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name: "Rashi", email: "RASHI@example.com", password: "example-pass-123" })
  });
  assert.equal(duplicate.response.status, 409);

  const login = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "RASHI@example.com", password: "example-pass-123" })
  });
  assert.equal(login.response.status, 200);
  assert.ok(login.body.token);
  const invalidLogin = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "rashi@example.com", password: "wrong-password" })
  });
  assert.equal(invalidLogin.response.status, 401);
});

test("task creation uses canonical statuses and returns clear validation errors", async () => {
  const created = await request("/api/tasks", {
    method: "POST",
    token: alice.token,
    body: JSON.stringify(validTask)
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.priority, "Medium");
  createdTask = created.body;

  const rejectedDone = await request("/api/tasks", {
    method: "POST",
    token: alice.token,
    body: JSON.stringify({ ...validTask, status: "Done" })
  });
  assert.equal(rejectedDone.response.status, 400);
  assert.match(rejectedDone.body.error, /Pending or Completed/);
  assert.doesNotMatch(rejectedDone.body.error, /1.?5 ratings/i);

  const invalidRatings = await request("/api/tasks", {
    method: "POST",
    token: alice.token,
    body: JSON.stringify({ ...validTask, estimatedHours: 0 })
  });
  assert.equal(invalidRatings.response.status, 400);
  assert.match(invalidRatings.body.error, /effort/i);
});

test("task list, edit, completion, and delete are scoped to the authenticated user", async () => {
  const bobRegistration = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name: "Bob", email: "bob@example.com", password: "another-pass-123" })
  });
  bob = bobRegistration.body;

  const aliceList = await request("/api/tasks", { token: alice.token });
  assert.equal(aliceList.response.status, 200);
  assert.equal(aliceList.body.length, 1);
  const bobList = await request("/api/tasks", { token: bob.token });
  assert.equal(bobList.body.length, 0);

  const forbiddenEdit = await request(`/api/tasks/${createdTask.id}`, {
    method: "PATCH",
    token: bob.token,
    body: JSON.stringify({ title: "Not Alice's task" })
  });
  assert.equal(forbiddenEdit.response.status, 404);
  const forbiddenDelete = await request(`/api/tasks/${createdTask.id}`, {
    method: "DELETE",
    token: bob.token
  });
  assert.equal(forbiddenDelete.response.status, 404);

  const edited = await request(`/api/tasks/${createdTask.id}`, {
    method: "PATCH",
    token: alice.token,
    body: JSON.stringify({ title: "Edited task title" })
  });
  assert.equal(edited.response.status, 200);
  assert.equal(edited.body.title, "Edited task title");

  const completed = await request(`/api/tasks/${createdTask.id}`, {
    method: "PATCH",
    token: alice.token,
    body: JSON.stringify({ status: "Completed" })
  });
  assert.equal(completed.response.status, 200);
  assert.equal(completed.body.status, "Completed");

  const deleted = await request(`/api/tasks/${createdTask.id}`, {
    method: "DELETE",
    token: alice.token
  });
  assert.equal(deleted.response.status, 204);
  const missing = await request(`/api/tasks/${createdTask.id}`, {
    method: "DELETE",
    token: alice.token
  });
  assert.equal(missing.response.status, 404);
});
