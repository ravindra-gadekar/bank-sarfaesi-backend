# Bank SARFAESI — Backend

Express + Mongoose + TypeScript API for the Bank SARFAESI notice management system.

## Tech Stack

- Node.js + Express (TypeScript)
- MongoDB + Mongoose
- JWT-based two-stage authentication (identity → branch)
- Agenda.js for background jobs (document generation)
- Zod for request/response validation
- Jest for testing

## Quick Start

```bash
# Install dependencies
npm install

# Copy env template and fill in secrets
cp .env.example .env

# Start MongoDB locally (from the application/ root)
docker compose -f ../local-setup/mongo-compose.yml up -d

# Run dev server (nodemon + tsx)
npm run dev
```

The API runs on `http://localhost:5000`.

## Scripts

| Command         | Description                                  |
| --------------- | -------------------------------------------- |
| `npm run dev`   | Nodemon + tsx watching `src/`                |
| `npm run build` | TypeScript compile to `dist/`                |
| `npm start`     | Run compiled `dist/server.js`                |
| `npm test`      | Jest test suite (`ts-jest`)                  |
| `npm run lint`  | ESLint over `src/`                           |

## Required Environment Variables

Validated at startup by Zod (`src/config/env.ts`) — process exits if missing:

- `MONGODB_URI`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`

See `.env.example` for the full list.

## Architecture Notes

- **Branch-first multi-tenancy**: every domain document carries a `branchId`; every query filters by it. Use `BaseRepository` which auto-prepends `{ branchId }`.
- **Two-stage auth**: identity token (email only) → branch selection → full token (email + userId + branchId + role).
- **Maker-checker workflow**: notice state machine enforces `draft → submitted → approved → final` transitions.
- **Module shape**: each feature folder under `src/` has `routes/`, `services/`, `models/`, `dto/`.
