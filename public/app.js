const taskRows = document.getElementById("task-rows");
const emptyState = document.getElementById("empty-state");
const dialog = document.getElementById("task-dialog");
const taskForm = document.getElementById("task-form");
const toast = document.getElementById("toast");
const authForm = document.getElementById("auth-form");
const today = new Date();
const todayKey = formatDate(today);
let tasks = [];
let currentFilter = "all";
let searchTerm = "";
let toastTimer;
let authMode = "login";
let editingTaskId = null;
let token = localStorage.getItem("taskpulse-token");

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function readableDate(dateString) {
  const days = Number(dateString);
  if (days === 0) return "Today";
  if (days === 1) return "In 1 day";
  return `In ${days} days`;
}

function taskMatchesFilter(task) {
  if (currentFilter === "pending") return task.status === "Pending";
  if (currentFilter === "done") return task.status === "Completed";
  return true;
}

function filteredTasks() {
  return tasks.filter((task) => {
    const matchesQuery = `${task.title} ${task.category} ${task.assigneeRole}`.toLowerCase().includes(searchTerm);
    return matchesQuery && taskMatchesFilter(task);
  });
}

function renderTasks() {
  const visibleTasks = filteredTasks();
  taskRows.innerHTML = visibleTasks.map((task) => {
    const priority = task.priority.toLowerCase();
    const statusClass = task.status.toLowerCase().replace(" ", "-");
    const projectClass = task.category === "Testing"
      ? "orange"
      : task.category === "Meeting"
        ? "teal"
        : task.category === "Documentation"
          ? "blue"
          : "violet";
    return `<tr>
      <td><div class="task-name-cell"><button class="task-check ${task.status === "Completed" ? "checked" : ""}" data-action="toggle" data-id="${escapeHtml(task.id)}" aria-label="${task.status === "Completed" ? "Reopen" : "Complete"} ${escapeHtml(task.title)}">${task.status === "Completed" ? "✓" : ""}</button><div class="task-copy"><span class="task-title ${task.status === "Completed" ? "task-done" : ""}">${escapeHtml(task.title)}</span><span class="task-project"><i class="project-dot ${projectClass}"></i>${escapeHtml(task.category)} · ${task.estimatedHours}h · ${task.dependencyCount} ${task.dependencyCount === 1 ? "dep" : "deps"}</span></div></div></td>
      <td><span class="priority-pill ${priority}"><i></i>${task.priority}</span></td>
      <td><span class="due-date ${task.daysToDeadline === 0 && task.status !== "Completed" ? "overdue" : ""}">${readableDate(task.daysToDeadline)}</span></td>
      <td><span class="status-pill ${statusClass}">${task.status}</span></td>
      <td class="action-cell"><div class="row-actions"><button class="row-action" data-action="edit" data-id="${escapeHtml(task.id)}" aria-label="Edit ${escapeHtml(task.title)}">Edit</button><button class="row-action delete-action" data-action="delete" data-id="${escapeHtml(task.id)}" aria-label="Delete ${escapeHtml(task.title)}">Delete</button></div></td>
    </tr>`;
  }).join("");
  emptyState.hidden = visibleTasks.length > 0;
  document.querySelector(".task-table").hidden = visibleTasks.length === 0;
  document.getElementById("table-count").textContent = `Showing ${visibleTasks.length} ${visibleTasks.length === 1 ? "task" : "tasks"}`;
  document.getElementById("all-count").textContent = tasks.length;
  document.getElementById("nav-count").textContent = tasks.filter((task) => task.status !== "Completed").length;
  renderStats();
  renderRecommendation();
}

function renderStats() {
  const completed = tasks.filter((task) => task.status === "Completed").length;
  const active = tasks.filter((task) => task.status !== "Completed");
  const dueToday = active.filter((task) => task.daysToDeadline === 0);
  const completion = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  const priorityCounts = {
    High: active.filter((task) => task.priority === "High").length,
    Medium: active.filter((task) => task.priority === "Medium").length,
    Low: active.filter((task) => task.priority === "Low").length
  };
  document.getElementById("total-tasks").textContent = String(tasks.length).padStart(2, "0");
  document.getElementById("completed-tasks").textContent = String(completed).padStart(2, "0");
  document.getElementById("due-today").textContent = String(dueToday.length).padStart(2, "0");
  document.getElementById("completion-bar").style.width = `${completion}%`;
  document.getElementById("completion-copy").textContent = `${completion}% of all tasks`;
  document.getElementById("today-priority-copy").textContent =
    `${dueToday.filter((task) => task.priority === "High").length} high priority`;
  document.getElementById("high-priority").textContent = String(priorityCounts.High).padStart(2, "0");
  document.getElementById("active-task-count").textContent = active.length;
  for (const [priority, id] of [["High", "high"], ["Medium", "medium"], ["Low", "low"]]) {
    document.getElementById(`mix-${id}-count`).textContent = priorityCounts[priority];
    document.getElementById(`mix-${id}-bar`).style.width =
      `${active.length ? (priorityCounts[priority] / active.length) * 100 : 0}%`;
  }
  document.getElementById("today-label").textContent = new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(today);
  document.querySelector(".eyebrow").innerHTML =
    `<span class="pulse-dot"></span> ${new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(today).toUpperCase()}`;
}

function renderRecommendation() {
  const recommendation = tasks.find((task) => task.status !== "Completed");
  if (!recommendation) {
    document.getElementById("next-best-task").textContent = "You're all caught up!";
    document.getElementById("next-best-reason").textContent = "Add a task when you're ready for your next step.";
    document.getElementById("next-best-score").textContent = "—";
    return;
  }
  document.getElementById("next-best-task").textContent = recommendation.title;
  document.getElementById("next-best-score").textContent = recommendation.priority;
  const reasons = [];
  if (recommendation.daysToDeadline <= 1) reasons.push("deadline approaching");
  if (recommendation.estimatedHours >= 6) reasons.push("substantial effort");
  if (recommendation.dependencyCount > 0) reasons.push("has dependencies");
  document.getElementById("next-best-reason").textContent =
    reasons.length ? `${reasons[0][0].toUpperCase()}${reasons[0].slice(1)}${reasons[1] ? ` and ${reasons[1]}` : ""}` : "A balanced next step for your day";
}

async function loadTasks() {
  tasks = await apiRequest("/api/tasks");
  renderTasks();
}

async function apiRequest(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  const response = await fetch(url, { ...options, headers });
  if (response.status === 204) return null;
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && token) signOut();
    throw new Error(result.error || "The request could not be completed.");
  }
  return result;
}

async function updateTask(id, changes) {
  const result = await apiRequest(`/api/tasks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(changes)
  });
  await loadTasks();
  return result;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2600);
}

document.querySelectorAll(".filter-tab").forEach((button) => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;
    document.querySelectorAll(".filter-tab").forEach((tab) => {
      const selected = tab === button;
      tab.classList.toggle("selected", selected);
      tab.setAttribute("aria-selected", String(selected));
    });
    renderTasks();
  });
});

document.getElementById("task-search").addEventListener("input", (event) => {
  searchTerm = event.target.value.trim().toLowerCase();
  renderTasks();
});

taskRows.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const task = tasks.find((item) => item.id === button.dataset.id);
  if (!task) return;
  try {
    if (button.dataset.action === "toggle") {
      await updateTask(task.id, { status: task.status === "Completed" ? "Pending" : "Completed" });
      showToast(task.status === "Completed" ? "Task moved back to your list." : "Nice work — task completed.");
    } else if (button.dataset.action === "edit") {
      openTaskDialog(task);
    } else if (button.dataset.action === "delete" &&
        window.confirm(`Delete “${task.title}”? This cannot be undone.`)) {
      await apiRequest(`/api/tasks/${encodeURIComponent(task.id)}`, { method: "DELETE" });
      await loadTasks();
      showToast("Task deleted.");
    }
  } catch (error) {
    showToast(error.message);
  }
});

function openTaskDialog(task = null) {
  editingTaskId = task?.id || null;
  taskForm.reset();
  document.getElementById("form-error").textContent = "";
  document.getElementById("task-dialog-title").textContent = task ? "Edit task" : "Create a task";
  document.getElementById("task-submit").innerHTML = task ? "Save changes <span>→</span>" : "Create task <span>→</span>";
  if (task) {
    for (const field of ["title", "category", "estimatedHours", "daysToDeadline", "dependencyCount", "assigneeRole", "status"]) {
      taskForm.elements[field].value = task[field];
    }
  } else {
    taskForm.elements.daysToDeadline.value = 2;
  }
  dialog.showModal();
  taskForm.elements.title.focus();
}

document.getElementById("new-task-button").addEventListener("click", () => {
  openTaskDialog();
});

function closeDialog() {
  dialog.close();
}
document.getElementById("close-dialog").addEventListener("click", closeDialog);
document.getElementById("cancel-dialog").addEventListener("click", closeDialog);

taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(taskForm);
  const task = Object.fromEntries(formData.entries());
  for (const key of ["estimatedHours", "daysToDeadline", "dependencyCount"]) task[key] = Number(task[key]);
  try {
    const result = await apiRequest(
      editingTaskId ? `/api/tasks/${encodeURIComponent(editingTaskId)}` : "/api/tasks",
      { method: editingTaskId ? "PATCH" : "POST", body: JSON.stringify(task) }
    );
    await loadTasks();
    closeDialog();
    showToast(editingTaskId ? "Task updated." : `Task added · ${result.priority} priority recommendation`);
  } catch (error) {
    document.getElementById("form-error").textContent = error.message;
  }
});

document.getElementById("view-all-button").addEventListener("click", () => {
  currentFilter = "all";
  document.querySelector('[data-filter="all"]').click();
});

function setAuthMode(mode) {
  authMode = mode;
  const registering = mode === "register";
  document.querySelector(".auth-name-field").hidden = !registering;
  authForm.elements.name.required = registering;
  authForm.elements.password.autocomplete = registering ? "new-password" : "current-password";
  document.getElementById("auth-heading").textContent = registering ? "Create your account" : "Welcome back";
  document.querySelector(".auth-description").textContent = registering
    ? "Create an account to keep your tasks private and in sync."
    : "Sign in to see your tasks and keep your work in sync.";
  document.getElementById("auth-submit").innerHTML = registering ? "Create account <span>→</span>" : "Sign in <span>→</span>";
  document.querySelectorAll(".auth-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.mode === mode));
  document.getElementById("auth-error").textContent = "";
}

function showDashboard(user) {
  document.getElementById("auth-screen").hidden = true;
  document.getElementById("app-shell").hidden = false;
  document.getElementById("profile-name").textContent = user.name;
  const initials = user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  document.querySelector(".top-avatar").textContent = initials;
  document.querySelector(".avatar").textContent = initials;
}

function signOut() {
  token = null;
  localStorage.removeItem("taskpulse-token");
  tasks = [];
  document.getElementById("app-shell").hidden = true;
  document.getElementById("auth-screen").hidden = false;
  authForm.reset();
  taskRows.innerHTML = "";
}

document.querySelectorAll(".auth-tab").forEach((tab) => {
  tab.addEventListener("click", () => setAuthMode(tab.dataset.mode));
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = Object.fromEntries(new FormData(authForm).entries());
  document.getElementById("auth-error").textContent = "";
  try {
    const result = await apiRequest(`/api/auth/${authMode === "register" ? "register" : "login"}`, {
      method: "POST",
      body: JSON.stringify(form)
    });
    token = result.token;
    localStorage.setItem("taskpulse-token", token);
    showDashboard(result.user);
  } catch (error) {
    document.getElementById("auth-error").textContent = error.message;
    return;
  }
  try {
    await loadTasks();
  } catch (error) {
    showToast(error.message);
  }
});

document.getElementById("logout-button").addEventListener("click", signOut);

async function initialize() {
  if (!token) return;
  try {
    const user = await apiRequest("/api/auth/me");
    showDashboard(user);
    await loadTasks();
  } catch (error) {
    console.error("Could not restore the signed-in session:", error.message);
    signOut();
  }
}

initialize();
