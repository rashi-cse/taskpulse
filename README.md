# TaskPulse

TaskPulse is a responsive task-priority dashboard built with Node.js, Express,
MongoDB/Mongoose, and browser JavaScript. Accounts use bcrypt password hashes
and JWT bearer tokens; every task query and mutation is scoped to the signed-in
user.

## Setup

1. Install Node.js 18+ and have MongoDB running locally, or create a MongoDB
   Atlas database.
2. From this folder, install dependencies and create your environment file:

   ```sh
   npm install
   cp .env.example .env
   ```

3. Set `MONGO_URI` to your MongoDB connection string and replace `JWT_SECRET`
   with a private random secret of at least 32 characters. Keep `.env` private.
4. Start the server and open <http://localhost:3000>:

   ```sh
   npm start
   ```

5. Choose **Create account** in the app. Each account sees only its own tasks.

For an illustrative report/demo account with synthetic starter tasks, set
`DEMO_NAME`, `DEMO_EMAIL`, and `DEMO_PASSWORD` in `.env`, then run
`npm run seed:demo`. The script creates the account if needed and seeds the
sample tasks only if that account has no tasks. These examples are not real
user data.

To import an existing `data/tasks.json` into a registered MongoDB account, set
`MIGRATION_EMAIL` in `.env` and run `npm run migrate:json`. To select a backup
at another path, also set `LEGACY_TASKS_FILE`. Back up `data/tasks.json` before
pulling this MongoDB upgrade if it contains task changes; Git removes the
tracked JSON sample as part of the upgrade. The migration stops if the selected
account already has tasks and leaves the source JSON unchanged.

## Tests

Run the API/auth tests with Node's built-in test runner:

```sh
npm test
```

Tests use in-memory repositories and do not require a MongoDB server.

## API

All task endpoints require `Authorization: Bearer <JWT>`. Registration and
login are public.

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public | Create an account with a bcrypt-hashed password |
| POST | `/api/auth/login` | Public | Verify credentials and issue a JWT |
| GET | `/api/auth/me` | JWT | Return the authenticated account |
| GET | `/api/tasks` | JWT | List only the current user's tasks |
| POST | `/api/tasks` | JWT | Validate and create a task with recommended priority |
| PATCH | `/api/tasks/:id` | JWT | Edit task details or set status to Pending/Completed |
| DELETE | `/api/tasks/:id` | JWT | Delete a task owned by the current user |

Task fields: `title`, `category` (Development, Testing, Documentation, Meeting),
`estimatedHours` (0.5–40), `daysToDeadline` (0–365), `dependencyCount` (0–50),
`assigneeRole` (Developer, Tester, Analyst, Manager), and `status` (Pending or
Completed).

## Priority recommendation and scope

The current priority recommendation is a deterministic rule-based fallback:
High when due within one day or within three days with at least six estimated
hours; Medium when due within five days or for Development; Low otherwise. It is
not a trained ML model. No accuracy or confidence claim should be reported.
The dashboard frontend is plain browser JavaScript (not React); MongoDB,
Express, JWT authentication, bcrypt hashing, CRUD, and automated API tests are
implemented.
