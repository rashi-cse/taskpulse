# TaskPulse

A small, locally runnable task-prioritization dashboard. It includes a Node.js
API, a responsive browser UI, editable example tasks, and a transparent
rule-based priority recommendation. There are no external services or npm
dependencies.

## Run it

1. Install Node.js 18 or later.
2. From this folder, run `npm start`.
3. Open <http://localhost:3000>.

The first run creates `data/tasks.json` with example tasks. Changes to tasks are
saved there and remain available after restarting the app. Remove that file to
restore the original examples.

## How priority is recommended

The local API applies the same transparent fallback rule described in the
sample report:

- High when the deadline is within one day, or within three days for tasks of
  six or more estimated hours
- Medium when the deadline is within five days, or the category is Development
- Low otherwise

This is a deterministic rule-based fallback, not a trained machine-learning
model. The app currently uses a local JSON file rather than MongoDB, and does
not yet include React, user authentication, or the Python inference service.
The starter tasks are illustrative and synthetic; do not describe them as real
user data or claim model accuracy. Update the report to distinguish these
implemented features from planned extensions.

## Features

- Overview metrics and a priority-ranked task list
- Search and All / Pending / Completed filters
- Add tasks, mark tasks complete, and remove tasks
- Persistent local JSON storage and server-side validation
- Priority explanation and live counts by priority

## API

- `GET /api/tasks` — list tasks with score and priority
- `POST /api/tasks` — create a task
- `PATCH /api/tasks/:id` — update task fields
- `DELETE /api/tasks/:id` — remove a task

For report screenshots, run the app locally and capture the browser window. The
dashboard counts and task recommendations are calculated from the data returned
by the local API; update any report tables with values from that run.
