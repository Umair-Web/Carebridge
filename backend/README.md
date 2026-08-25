# CareBridge — Backend

REST + real-time API for **CareBridge**, a healthcare referral and settlement
platform. It connects four roles — **consultants** (create patient referrals),
**hospitals** (accept/admit), **laboratories** (lab referrals), and platform
**admins** — and manages the money flow between them (commissions, payouts,
weekly settlements).

## Tech stack

- **Node.js + Express 5** — HTTP API (mounted under `/v1`)
- **MongoDB + Mongoose 9** — data layer
- **Socket.IO** — real-time events (role/entity rooms)
- **node-cron** — scheduled referral SLA escalation (runs every minute)
- **JWT** — auth (1h access token + 30d refresh token)
- Integrations: **Resend** (email), **Cloudinary** (file uploads),
  **JazzCash** (payments), **Meta WhatsApp Cloud API** (phone OTP & alerts)

## Project structure

```
src/
├── server.js            App bootstrap: Express, Socket.IO, Mongo, cron
├── bootstrap/           One-time platform data seeding on startup
├── routes/              Express routers (thin) mounted under /v1/*
├── controllers/         Request handlers
├── services/            Business logic (billing, payments, scoring weights, stats…)
├── models/              Mongoose schemas (User, Referral, Hospital, Laboratory…)
├── middleware/          auth (protect/authorize), file upload
├── jobs/                referralEscalation cron job
├── utils/               crypto, email, scoring engine, otp, sla, logger…
└── scripts/             Seed / maintenance scripts (run manually)
```

### Key concepts

- **Referrals** are the central entity. Patient CNIC is encrypted at the field
  level (`utils/crypto.js`). Referral codes (`CB-YYYY-0001`) are generated
  atomically via a `Counter`.
- **Smart scoring** (`utils/scoringEngine.js`) ranks hospitals for a referral by
  weighted factors (specialty, bed availability, distance, cost-fit, SLA history,
  consultant preference). Weights are admin-configurable and sum to 100.
- **Money values are stored in paisa** (1 PKR = 100 paisa) throughout.
- **Real-time**: clients join personal/role rooms and entity rooms
  (`hospital:*`, `consultant:*`, `lab:*`); domain events trigger live UI refresh.

## Getting started

### Prerequisites
- Node.js 18+ and npm
- A MongoDB instance (local or Atlas)

### Setup

```bash
cd backend
npm install
cp .env.example .env      # then fill in real values (see comments in the file)
```

At minimum you must set `MONGO_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, and
`ENCRYPTION_KEY` (a 64-hex-char key — see `.env.example` for the generator
command). Email/Cloudinary/JazzCash/WhatsApp keys are only needed for those
features.

### Run

```bash
npm run dev     # start with nodemon (auto-reload)
npm start       # start once (production-style)
```

The API listens on `http://localhost:${PORT}` (default 5000) and responds to
`GET /` with `CareBridge API is running`.

### Seed an admin account

```bash
npm run seed:admin
```

Uses `ADMIN_*` values from `.env`.

## NPM scripts

| Script | Description |
| --- | --- |
| `npm start` | Start the server (`node src/server.js`) |
| `npm run dev` | Start with nodemon auto-reload |
| `npm test` | Run the test suite (Node's built-in test runner) |
| `npm run seed:admin` | Create/seed the platform admin user |
| `npm run cleanup:legacy-hospitals` | Remove legacy seed hospitals |

## Testing

Tests use Node's built-in `node:test` runner (no extra dependencies) and cover
pure logic that needs no database — e.g. field encryption round-trips and the
hospital scoring engine.

```bash
npm test
```

## Configuration reference

All environment variables are documented in [`.env.example`](./.env.example),
grouped by area (core, database, auth/security, CORS, email, file storage,
payments, WhatsApp).

> **CORS**: leave `CORS_ORIGINS` blank to allow all origins (dev default), or set
> a comma-separated allowlist in production. Applies to both HTTP and Socket.IO.

> **Encryption**: `ENCRYPTION_KEY` must remain stable once data is stored —
> changing it makes existing encrypted CNIC values unreadable.
