const taskRows = document.getElementById("task-rows");
const emptyState = document.getElementById("empty-state");
const dialog = document.getElementById("task-dialog");
const taskForm = document.getElementById("task-form");
const toast = document.getElementById("toast");
const today = new Date();
const todayKey = formatDate(today);
let tasks = [];
let currentFilter = "all";
let searchTerm = "";
let toastTimer;

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
      <td><div class="task-name-cell"><button class="task-check ${task.status === "Completed" ? "checked" : ""}" data-action="toggle" data-id="${escapeHtml(task.id)}" aria-label="${task.status === "Completed" ? "Reopen" : "Complete"} ${escapeHtml(task.title)}">${task.status === "Completed" ? "✓" : ""}</button><div class="task-copy"><span class="task-title ${task.status === "Completed" ? "task-done" : ""}">${escapeHtml(task.title)}</span><span class="task-project"><i class="project-dot ${projectClass}"></i>${escapeHtml(task.category)} · ${task.estimatedHours}h · ${task.dependencyCount} deps</span></div></div></td>
      <td><span class="priority-pill ${priority}"><i></i>${task.priority}</span></td>
      <td><span class="due-date ${task.daysToDeadline === 0 && task.status !== "Completed" ? "overdue" : ""}">${readableDate(task.daysToDeadline)}</span></td>
      <td><span class="status-pill ${statusClass}">${task.status}</span></td>
      <td class="action-cell"><button class="row-menu" data-action="menu" data-id="${escapeHtml(task.id)}" aria-label="Task options">···</button></td>
    </tr>`;
  }).join("");
  emptyState.hidden = visibleTasks.length > 0;
  document.querySelector(".task-table").hidden = visibleTasks.length === 0;
  document.getElementById("table-count").textContent = `Showing ${visibleTasks.length} ${visibleTasks.length === 1 ? "task" : "tasks"}`;
  document.getElementById("all-count").textContent = tasks.length;
  document.getElementById("nav-count").textContent = tasks.filter((task) => task.status !== "Done").length;
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
  const response = await fetch("/api/tasks");
  if (!response.ok) throw new Error("Could not load tasks from the local server.");
  tasks = await response.json();
  renderTasks();
}

async function updateTask(id, changes) {
  const response = await fetch(`/api/tasks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not update task.");
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
    } else {
      const action = window.prompt(`Task options for “${task.title}”\nType "done" to complete or "delete" to remove it.`);
      if (action?.toLowerCase() === "done") {
        await updateTask(task.id, { status: "Done" });
        showToast("Task marked as complete.");
      } else if (action?.toLowerCase() === "delete") {
        const response = await fetch(`/api/tasks/${encodeURIComponent(task.id)}`, { method: "DELETE" });
        if (!response.ok) throw new Error("Could not delete task.");
        await loadTasks();
        showToast("Task deleted.");
      }
    }
  } catch (error) {
    showToast(error.message);
  }
});

document.getElementById("new-task-button").addEventListener("click", () => {
  taskForm.reset();
  taskForm.elements.daysToDeadline.value = 2;
  document.getElementById("form-error").textContent = "";
  dialog.showModal();
  taskForm.elements.title.focus();
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
  const response = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task)
  });
  const result = await response.json();
  if (!response.ok) {
    document.getElementById("form-error").textContent = result.error || "Could not create task.";
    return;
  }
  await loadTasks();
  closeDialog();
  showToast(`Task added · ${result.priority} priority recommendation`);
});

document.getElementById("view-all-button").addEventListener("click", () => {
  currentFilter = "all";
  document.querySelector('[data-filter="all"]').click();
});

loadTasks().catch((error) => {
  document.querySelector(".task-table-wrap").innerHTML =
    `<div class="load-error">${escapeHtml(error.message)} Refresh the page after starting the local server.</div>`;
});
