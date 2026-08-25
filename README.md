# ORVX-Server

Express + PostgreSQL backend for ORVX — a football development platform
where players track attribute progression through coach-approved drills,
join clubs, and compete in league and knockout competitions.

## Stack

Node.js, Express, PostgreSQL (`pg`)

## Structure

```
src/
├── routes/        # endpoint definitions, no business logic
├── controllers/    # req/res handling, calls services
├── services/       # business logic + database queries
├── middleware/      # auth, role guards, error handling
├── config/          # env/config loading
└── db/               # pool setup, schema.sql, migrations
```

See the root [CLAUDE.md](../CLAUDE.md) and `.claude/skills/node-backend`
for the layered-architecture and error-handling conventions this project
follows.

## Setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL
npm run dev
```

Server runs on `http://localhost:5000` by default. Health check:
`GET /api/health`.

## API Documentation

Endpoints are documented as they're added below.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Service health check |
