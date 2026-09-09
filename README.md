# OVRX — API Server

The REST API for **OVRX**, a football-development platform that turns
real-world training into coach-verified, measurable attribute progression,
with clubs and competitions layered on top. This repository is the
**backend only** — it returns JSON and never renders a view. The web client
lives in a separate repository.

> The product is **OVRX**. This repo is published on GitHub as `ORVX-Server`
> and the client as `ORVX-Client` — the slugs keep an older spelling.

---

## Table of contents

- [Description](#description)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [Database & migrations](#database--migrations)
- [Project structure](#project-structure)
- [Architecture & conventions](#architecture--conventions)
- [Authentication & roles](#authentication--roles)
- [Error format](#error-format)
- [API endpoints](#api-endpoints)
  - [Health](#health)
  - [Auth `/api/auth`](#auth-apiauth)
  - [Players `/api/players`](#players-apiplayers)
  - [Drills `/api/drills`](#drills-apidrills)
  - [Sessions `/api/sessions`](#sessions-apisessions)
  - [Review `/api/review`](#review-apireview)
  - [Coaches `/api/coaches`](#coaches-apicoaches)
  - [Clubs `/api/clubs`](#clubs-apiclubs)
  - [Competitions `/api/competitions`](#competitions-apicompetitions)
  - [Admin `/api/admin`](#admin-apiadmin)
- [License](#license)

---

## Description

OVRX models the full journey of a developing footballer:

1. **Assessment.** A player registers and completes a one-time
   self-assessment, producing a FIFA-style card: six position-aware
   attributes (outfield: pace, shooting, passing, dribbling, defending,
   physical — or the goalkeeper set), an **overall** (rounded mean of the
   six) and a **tier** (Gold ≥ 75, Silver ≥ 65, else Bronze). The overall
   and tier are always recomputed server-side, never trusted from the
   client.
2. **Training.** The player builds a training session from the drill
   catalogue, works through the sets, and submits video proof.
3. **Review.** The submission is routed to a reviewer **by the server**:
   the **Platform Evaluator** handles baseline sessions and any player not
   on a club roster; a signed player's proof always goes to their own
   club's head coach. Approving a submission credits its aggregated drill
   boosts to the player's attributes and recomputes overall/tier.
4. **Clubs.** A player with an approved submission and no active membership
   is a *released free agent* who can apply to one club at a time. Head
   coaches sign free agents into a fixed 16-player squad, set positions,
   and release players back to the pool.
5. **Competitions.** Admins run two fixed competitions — a league (round
   robin, up to 16 matchdays) and a knockout cup (semi-finals + final).
   Match results carry per-goal scorers picked from the two clubs' rosters;
   standings, brackets and top-scorer charts are always computed from
   played matches, never stored.

The player lifecycle (`unassessed → baseline_pending → released → signed`)
is **derived on every read**, not persisted as a column.

---

## Tech stack

| Concern | Choice |
| ------- | ------ |
| Runtime | **Node.js** (ES modules, `"type": "module"`) |
| Web framework | **Express 5** |
| Database | **PostgreSQL**, accessed through the **`pg`** driver with a shared `Pool` |
| Auth | **JSON Web Tokens** (`jsonwebtoken`), stateless — the signature is trusted, no session store |
| Password hashing | **bcryptjs** |
| CORS | **`cors`** (open by default; lock down for production) |
| Config | **`dotenv`** |
| Migrations | Hand-rolled forward-only SQL runner (`src/db/migrate.js`) |

No ORM, no query builder — services write SQL directly against `pg`.

---

## Getting started

### Prerequisites

- **Node.js** ≥ 20 and **npm** ≥ 10
- **PostgreSQL** ≥ 14 running locally (or a connection string to a remote instance)

### 1. Clone and install

```bash
git clone git@github.com:aboodysn05/ORVX-Server.git
cd ORVX-Server
npm install
```

### 2. Create the database

```bash
createdb orvx
```

### 3. Configure the environment

```bash
cp .env.example .env
```

Edit `.env` and set at least `DATABASE_URL` and `JWT_SECRET`:

```
PORT=5001
DATABASE_URL=postgresql://user:password@localhost:5432/orvx
JWT_SECRET=$(openssl rand -hex 32)
JWT_EXPIRES_IN=7d
```

### 4. Run migrations

```bash
npm run migrate
```

### 5. Seed the accounts you need

```bash
# Fresh-deploy state: wipes everything, no clubs, no demo data,
# creates one admin + one Platform Evaluator (prints their credentials).
npm run seed:clean
```

or, for local development with a full world of fake data (players, coaches,
clubs, a played league season):

```bash
npm run seed:demo
```

### 6. Start the server

```bash
npm run dev      # node --watch, restarts on change
# or
npm start
```

The API is now at `http://localhost:5001`. Verify:

```bash
curl http://localhost:5001/api/health
# { "status": "ok", "db": "connected", "dbTime": "..." }
```

---

## Environment variables

| Variable | Required | Default | Purpose |
| -------- | -------- | ------- | ------- |
| `PORT` | No | `5000` | HTTP port. `.env.example` uses `5001` because macOS AirPlay binds 5000. |
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string. |
| `JWT_SECRET` | **Yes** | — | Secret used to sign/verify JWTs. Generate with `openssl rand -hex 32`. |
| `JWT_EXPIRES_IN` | No | `7d` | Token lifetime (any `jsonwebtoken` duration string). |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | For seeding | see script | Read by `seed:admin` and `seed:clean`. Password ≥ 8 chars. |
| `EVALUATOR_NAME` / `EVALUATOR_EMAIL` / `EVALUATOR_PASSWORD` | For seeding | see script | Read by `seed:evaluator` and `seed:clean`. |

Only `PORT`, `DATABASE_URL`, `JWT_SECRET` and `JWT_EXPIRES_IN` are read by
the running server; the rest are consumed by seed scripts only.

---

## Scripts

| Command | Purpose |
| ------- | ------- |
| `npm run dev` | Start with `node --watch` (auto-restart). |
| `npm start` | Start once (production). |
| `npm run migrate` | Apply any pending SQL migrations, in order, each in a transaction. |
| `npm run seed:clean` | Reset to a clean deploy state: no users except one admin + one evaluator, **no clubs**, no matches, the 10 base drills, two empty competition shells. |
| `npm run seed:admin` | Upsert a single admin account from `ADMIN_*` env vars (idempotent). |
| `npm run seed:evaluator` | Upsert a single Platform Evaluator from `EVALUATOR_*` env vars. |
| `npm run seed:demo` | Wipe app data and load a rich demo dataset for local UI work. |

---

## Database & migrations

Migrations are **forward-only** SQL files in `src/db/migrations/`, named
`NNN_description.sql`. `src/db/migrate.js`:

1. ensures a `schema_migrations(name, applied_at)` bookkeeping table exists,
2. reads every `*.sql` file in sorted order,
3. for each one not already recorded, runs it inside `BEGIN … COMMIT`
   (rolling back on any error) and records its name.

Running `npm run migrate` against an empty database builds the entire
schema; against an existing one it applies only what is new. **Never edit
or delete a migration that has shipped** — add the next number instead.

A generated **`schema.sql`** (full `pg_dump --schema-only`) is kept at the
repo root as a readable snapshot of the current structure; it is not used
by the runner.

Core tables: `users`, `players`, `attributes`, `player_attributes`,
`drills`, `drill_attribute_boosts`, `drill_submissions`,
`drill_submission_drills`, `clubs`, `club_memberships`, `club_applications`,
`coaches`, `coach_applications`, `competitions`, `matches`, `match_goals`.

---

## Project structure

```
src/
├── server.js               # Express app: cors, json, /api/health, mounts /api, error handlers, listen
│
├── routes/                 # endpoint definitions only — no business logic
│   ├── index.js                # mounts every resource router under /api
│   ├── auth.routes.js          players.routes.js   drills.routes.js
│   ├── sessions.routes.js      review.routes.js    coaches.routes.js
│   ├── clubs.routes.js         competitions.routes.js
│   └── admin.routes.js         # the whole admin console, behind requireRole("admin")
│
├── controllers/            # req/res only: pull params, call a service, send JSON.
│                           #   Never try/catch — they throw AppError, the error
│                           #   middleware formats it.
│
├── services/               # ALL business logic and SQL lives here
│   ├── auth.service.js         players.service.js   drills.service.js
│   ├── sessions.service.js     review.service.js    coaches.service.js
│   ├── clubs.service.js        clubMemberships.service.js
│   ├── clubOverview.service.js competitions.service.js
│   ├── adminClubs.service.js   adminOverview.service.js
│
├── middleware/
│   ├── auth.js                 # requireAuth — verify Bearer JWT → req.user = { id, role }
│   ├── requireRole.js          # requireRole(...roles) gate
│   ├── loadUser.js             # attachCurrentUser — hydrate req.currentUser (+ coach identity)
│   ├── error.js                # errorHandler — the one place errors become JSON
│   └── notFound.js             # 404 for unmatched /api paths
│
├── utils/
│   ├── AppError.js             # new AppError(message, statusCode, code)
│   ├── roles.js                # isPlatformEvaluator(user), PLATFORM_EVALUATOR_ORG
│   ├── constants.js            # SQUAD_CAP = 16, CLUB_SLOTS = 8
│   ├── playerRating.js         # keysFor(position), tierFor(overall), computeOverall(...)
│   └── drillTiming.js          # estimateMinutes(...)
│
├── db/
│   ├── pool.js                 # shared pg Pool from DATABASE_URL
│   ├── migrate.js              # the migration runner
│   └── migrations/             # 001_*.sql … 017_*.sql
│
└── scripts/                # seedClean.js, seedAdmin.js, seedEvaluator.js, seedDemo.js
```

---

## Architecture & conventions

- **Layered flow:** `routes → controllers → services`. Only services touch
  SQL. Routes carry no logic beyond wiring middleware.
- **Errors by throwing.** Controllers and services never format their own
  error responses. They throw `new AppError(message, statusCode, code)` for
  expected failures, or let a real bug bubble up. `middleware/error.js` is
  the single place that turns anything thrown into
  `{ error: { message, code } }` with the right status (unknown errors →
  `500 INTERNAL_ERROR`, logged to the console).
- **Transactions.** Multi-statement writes use
  `pool.connect()` → `BEGIN` → … → `COMMIT` / `ROLLBACK` → `release()`.
- **Derived, not stored.** Player lifecycle, `overall`, `tier`, league
  standings, brackets and scorer charts are computed on read.
- **Frozen response keys.** Existing JSON keys and paths are stable;
  changes are additive.

---

## Authentication & roles

`POST /api/auth/register` and `/login` return `{ token, user }`. Send the
token on every protected request:

```
Authorization: Bearer <token>
```

`requireAuth` verifies the signature and sets `req.user = { id, role }`
(no DB hit). `requireRole("coach", "admin")` gates by role.
`attachCurrentUser` additionally loads `req.currentUser` with the coach
identity (`coachId`, `isPlatformEvaluator`, `organization`) for endpoints
that need it.

| Role | Notes |
| ---- | ----- |
| `player` | Default registration role. Owns the assessment + training + club-application endpoints. |
| `coach` | Registers, then applies via `/api/coaches/applications`. Inactive until an admin approves. |
| Platform Evaluator | A `coach` user with `organization = "Platform Evaluator"` / `coaches.is_platform_evaluator = true`. Reviews baseline and free-agent submissions. |
| `admin` | Everything under `/api/admin`. Seeded, never self-registered. |

`user` shape: `{ id, name, email, role, organization }`.

---

## Error format

Every non-2xx response body:

```json
{ "error": { "message": "Human-readable text.", "code": "MACHINE_CODE" } }
```

Common codes: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401),
`FORBIDDEN` / `NOT_YOUR_REVIEW` / `NOT_CLUB_COACH` (403),
`*_NOT_FOUND` (404), `EMAIL_TAKEN` / `APPLICATION_PENDING` / `SQUAD_FULL` /
`SESSION_IN_PROGRESS` / `NO_FREE_CLUB_SLOT` (409), `INTERNAL_ERROR` (500).

---

## API endpoints

Base path: **`/api`**. All bodies are JSON. "Auth" column: 🔓 public ·
🔒 any authenticated user · 🎽 player · 🧢 coach · 🧢✅ approved coach ·
🔬 evaluator/coach/admin · 🛡️ admin.

### Health

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| GET | `/api/health` | 🔓 | `{ status, db, dbTime }` — pings the database. |

---

### Auth `/api/auth`

| Method | Path | Auth | Body | Success |
| ------ | ---- | ---- | ---- | ------- |
| POST | `/register` | 🔓 | `{ name, email, password, role?, organization? }` — `password` ≥ 8; `role` defaults to `player` | `201 { token, user }` |
| POST | `/login` | 🔓 | `{ email, password }` | `200 { token, user }` |
| GET | `/me` | 🔒 | — | `200 { user }` |
| PATCH | `/me` | 🔒 | `{ name?, email?, currentPassword?, newPassword? }` — changing email or password requires a correct `currentPassword`; `newPassword` ≥ 8 | `200 { user }` |

Errors: `VALIDATION_ERROR` (400), `INVALID_CREDENTIALS` (401),
`INVALID_PASSWORD` (403), `EMAIL_TAKEN` (409).

---

### Players `/api/players`

| Method | Path | Auth | Body | Success |
| ------ | ---- | ---- | ---- | ------- |
| GET | `/featured` | 🔓 | — | `200 { player }` — one illustrative card for the landing page, or `null`. |
| POST | `/assessment` | 🎽 | `{ position, dominantFoot, heightCm, weightKg, attributes: { <key>: 0-100, … } }` | `201 { player }` — one-time; `overall`/`tier` computed server-side. |
| GET | `/me` | 🎽 | — | `200 { player }` — full profile incl. derived `lifecycleState`, `club`, attributes for the active position set. `404 PLAYER_NOT_FOUND` if not assessed. |
| GET | `/me/applications` | 🎽 | — | `200 { applications }` — this player's club applications. |
| DELETE | `/me/applications/:appId` | 🎽 | — | `200 { application }` — withdraw a pending application. |
| GET | `/scouting-pool` | 🧢/🛡️ | — | `200 { players }` — released free agents (approved submission, no active club). |
| PATCH | `/:playerId/registered-position` | 🧢/🛡️ | `{ position }` | `200 { player }` — head coach of the player's club (or admin) changes their registered position. Non-destructive: the other attribute set is preserved. `403 NOT_YOUR_PLAYER`. |

`position` ∈ `Attacker | Defender | Goalkeeper`.
`attributes` keys — outfield: `pace, shooting, passing, dribbling,
defending, physical`; goalkeeper: `diving, handling, kicking, reflexes,
speed, positioning`.

---

### Drills `/api/drills`

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| GET | `/` | 🔓 | `200 { drills }` — the **active** catalogue. Each drill: `id, name, category, positionGroup, unitKind ('reps'\|'secs'), minSets/maxSets, minReps/maxReps, level, boosts: { <attr>: 1-3 }, active`. |

Admin drill CRUD is under [`/api/admin/drills`](#admin-apiadmin).

---

### Sessions `/api/sessions`

All 🎽 (player only). The training lifecycle:
`create → save progress → complete → submit`. Only one session may be in
flight at a time.

| Method | Path | Body | Success |
| ------ | ---- | ---- | ------- |
| POST | `/` | `{ name, focus, drills: [{ drillId, sets, reps }] }` | `201 { session }` — `sets`/`reps` must fall within each drill's min/max; retired drills are rejected. `409 SESSION_IN_PROGRESS`. |
| GET | `/active` | — | `200 { session }` — the in-flight session, or `null`. |
| GET | `/` | `?status=active\|completed\|submitted` (optional) | `200 { sessions }`. |
| PATCH | `/:id/progress` | `{ progress: [...] }` | `200 { session }` — persist per-set ticks. |
| POST | `/:id/complete` | — | `200 { session }` — mark the workout done, ready to submit. |
| POST | `/:id/submit` | `{ videoUrl, notes? }` — `videoUrl` required | `200 { session }` — reviewer assigned automatically (club head coach if signed, else Platform Evaluator). No routing fields are accepted from the client. |
| DELETE | `/:id` | — | `204` — discard an in-flight session. |

---

### Review `/api/review`

Guarded by 🔬 (`requireRole("coach", "admin")` + `attachCurrentUser`).

| Method | Path | Body | Success |
| ------ | ---- | ---- | ------- |
| GET | `/queue` | — | `200 { queue }` — submissions this reviewer may action. Evaluator/admin: submissions from players with **no active club membership**. Club coach: submissions from their own roster. Each item carries the player, the drills, per-drill boosts and `projectedRewards`. |
| GET | `/stats` | — | `200 { stats }` — counts for the reviewer's console (pending, reviewed, etc.). |
| POST | `/submissions/:id` | `{ verdict: "approved" \| "rejected", feedback?, verifiedAttributes?: { <key>: 0-100 } }` | `200 { submission, player, credited }` |

**Approve** credits the submission's aggregated drill boosts to the
player's attributes (clamped 0–100) and recomputes overall/tier;
`credited` is the applied map. An evaluator may pass `verifiedAttributes`
to set the baseline card absolutely instead of stacking boosts.
**Reject** records `feedback` and leaves attributes untouched.
Errors: `NOT_YOUR_REVIEW` (403), `SUBMISSION_NOT_FOUND` (404),
`ALREADY_REVIEWED` / `SUBMISSION_NOT_SUBMITTED` (409).

---

### Coaches `/api/coaches`

| Method | Path | Auth | Body | Success |
| ------ | ---- | ---- | ---- | ------- |
| POST | `/applications` | 🧢 | `{ fullName, yearsExperience (int ≥ 0), licenseNumber?, clubName, squadCapacity? (1-16, default 16), credentialDocUrl?, clubLogoUrl? }` | `201 { application }` — `409 APPLICATION_PENDING` if one is already open. |
| GET | `/applications/me` | 🧢 | — | `200 { application }` — the caller's latest application, or `null`. |

Admin approval/decline is under
[`/api/admin/coach-applications`](#admin-apiadmin).

---

### Clubs `/api/clubs`

| Method | Path | Auth | Body | Success |
| ------ | ---- | ---- | ---- | ------- |
| GET | `/` | 🔓 | — | `200 { clubs }` — every club with `slot, division, archived, headCoachName, rosterCount, squadCap, isFull, leaguePosition`. |
| GET | `/:id/overview` | 🔒 | — | `200 { overview }` — aggregate for the coach club-profile page (roster composition, verified sessions, league, next fixture, recent results). |
| GET | `/:id/roster` | 🔒 | — | `200 { clubId, clubName, squadCap, count, players: [...] }`. |
| POST | `/:id/roster` | 🧢/🛡️ | `{ playerId, position? }` | `201 { membership }` — sign a released free agent. `409 PLAYER_NOT_RELEASED` / `SQUAD_FULL`; `403 NOT_CLUB_COACH`. |
| PATCH | `/:id/roster/:playerId` | 🧢/🛡️ | `{ position }` | `200 { membership }`. |
| DELETE | `/:id/roster/:playerId` | 🧢/🛡️ | — | `204` — release back to the pool. |
| GET | `/:id/applications` | 🧢/🛡️ | — | `200 { applications }` — pending applications to this club. |
| POST | `/:id/applications` | 🎽 | `{ message? }` | `201 { application }` — a player applies. One open application per player (`409 APPLICATION_PENDING`). |
| POST | `/:id/applications/:appId/accept` | 🧢/🛡️ | — | `200 { membership, application }` — accept (signs the player, withdraws their other pending applications). |
| POST | `/:id/applications/:appId/decline` | 🧢/🛡️ | — | `200 { application }`. |

---

### Competitions `/api/competitions`

All 🔓. Standings, brackets and scorer charts are computed from played
matches.

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/` | `200 { competitions }` — `[{ id, name, type: "league"\|"knockout", season }]`. |
| GET | `/:id/standings` | `200 { standings }` — all clubs, `position, played, won, drawn, lost, goalsFor, goalsAgainst, goalDiff, points`. |
| GET | `/:id/fixtures` | `200 { fixtures }` — scheduled + played, each with `homeClubId, awayClubId, round, leg, scores, status, goals`. |
| GET | `/:id/bracket` | `200 { rounds }` — knockout rounds (`Semi-Finals`, `Final`) with ties, aggregate scores and who went through. |
| GET | `/:id/scorers` | `200 { scorers }` — top goalscorers with `playerId, name, club, matches, goals, rank`. |

Match creation/editing is under
[`/api/admin/competitions`](#admin-apiadmin).

---

### Admin `/api/admin`

Every endpoint here is 🛡️ (`requireAuth` + `attachCurrentUser` +
`requireRole("admin")`).

**Console**

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/overview` | `200 { overview }` — `{ snapshot, season, activity }` dashboard aggregate. |

**Coach onboarding**

| Method | Path | Body | Success |
| ------ | ---- | ---- | ------- |
| GET | `/coach-applications` | `?status=pending\|approved\|declined` (optional) | `200 { applications }` |
| GET | `/coach-applications/:id` | — | `200 { application }` |
| POST | `/coach-applications/:id/approve` | — | `200 { application, club, coach }` — provisions a club into the lowest free slot (1–8) and links the coach as head coach. `409 NO_FREE_CLUB_SLOT`. |
| POST | `/coach-applications/:id/decline` | `{ note? }` | `200 { application }` |

**Drill catalogue**

| Method | Path | Body | Success |
| ------ | ---- | ---- | ------- |
| GET | `/drills` | — | `200 { drills }` — includes retired. |
| POST | `/drills` | `{ name, category, unitKind, level, minSets, maxSets, minReps, maxReps, positionGroup, demoVideoUrl?, boosts: [{ code, value: 1\|2\|3 }] }` | `201 { drill }` — 1–3 boosts, known attribute codes only (`UNKNOWN_ATTRIBUTE`). |
| PATCH | `/drills/:id` | partial of the above (`boosts` replaces all) | `200 { drill }` |
| POST | `/drills/:id/retire` | — | `200 { drill }` — drops from the public list; new sessions can't use it. |
| POST | `/drills/:id/reinstate` | — | `200 { drill }` |

**Competition engine**

| Method | Path | Body | Success |
| ------ | ---- | ---- | ------- |
| PATCH | `/competitions/:id` | `{ name?, season? }` — `type` is locked | `200 { competition }` |
| POST | `/competitions/:id/fixtures/generate` | `{ clubIds: [int], doubleRound?, startDate?, daysBetweenRounds? }` | `201 { created, matchdays, seasonMatchdays }` — league only; `TOO_MANY_MATCHDAYS` past 16. |
| POST | `/competitions/:id/bracket/generate` | `{ clubIds: [int, ×4], startDate?, daysBetweenLegs? }` | `201 { … }` — knockout only; exactly 4 clubs (`BAD_BRACKET_SIZE`). |
| POST | `/competitions/:id/bracket/advance` | `{ startDate?, daysBetweenLegs? }` | `201 { … }` — creates the next round from decided ties. `NO_BRACKET` / `ALREADY_COMPLETE`. |
| POST | `/competitions/:id/matches` | `{ homeClubId, awayClubId, roundLabel?, leg?, homeScore, awayScore, playedOn, goals?: [{ clubId, playerId, minute? }] }` | `201 { match }` — one scorer per goal, each `playerId` in that club's squad; per-club goal count must equal the score (`GOALS_REQUIRED`, `SCORER_NOT_IN_SQUAD`, `GOAL_COUNT_MISMATCH`). |
| PATCH | `/matches/:id` | partial of the above (`goals` replaces all) | `200 { match }` |
| DELETE | `/matches/:id` | — | `204` |

**Club allocation**

| Method | Path | Body | Success |
| ------ | ---- | ---- | ------- |
| GET | `/clubs` | — | `200 { clubs }` — includes archived. |
| POST | `/clubs` | `{ name, division? }` | `201 { club }` — lowest free slot 1–8. `409 NO_FREE_CLUB_SLOT` / `CLUB_NAME_TAKEN`. |
| POST | `/clubs/:id/archive` | — | `200 { club }` — frees the slot, releases the roster, clears the head coach. |
| POST | `/clubs/:id/restore` | — | `200 { club }` — into the lowest free slot; roster is not auto-restored. |

---

## License

MIT © 2026 Abdullah Yaseen. See [LICENSE](LICENSE).
