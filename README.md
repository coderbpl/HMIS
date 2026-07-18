# Arogya HMIS

Full-stack hospital management demo: React UI (OPD + IPD, role-based dashboards, patient
queue portal) + Node.js API with a swappable data-access layer (MSSQL stored procedures
or in-memory) and optional Redis caching.

## Run it

```bash
# 1. API (terminal 1) — runs with zero external dependencies by default
cd server && npm install && npm run dev        # http://localhost:4000

# 2. UI (terminal 2)
npm install && npm run dev                     # http://localhost:5173
```

The Vite dev server proxies `/api` to `:4000`. If the API is down the UI falls back to
built-in demo data and shows an "Offline demo" badge.

**Demo sign-ins** (password `Demo@1234`, seeded): `dr.asha`, `nurse.meena`,
`frontdesk.rahul`, `pharm.vikas`, `admin.sk`. The login screen is a real
username/password form — the role chips just prefill demo credentials. Patients need
no login — "I'm a patient" opens the public queue board, token tracking (try mobile
`9800000003` + token `A-15`), and **self-service token generation**:
- **With ABHA**: ABHA number + the registered mobile (both must match the record).
- **Without ABHA**: mobile number; first-time visitors add name/age/sex/department
  and are registered on the spot. One open token per patient per day — asking again
  returns the existing token instead of duplicating.

## Architecture

```
src/                      React UI (Vite)
  api.js                  fetch client — JWT kept in memory, offline fallback
  components/touch.jsx    touch-first controls (BigChips, DosePad, Stepper, QuickMeds)
  pages/                  role dashboards, OPD queue, consult workspace, IPD, patient portal

server/
  src/gateway/            THE API GATEWAY — single entry point for every request
    index.js              pipeline: correlation id → helmet → CORS → body cap →
                          sanitize → rate limit → access log → routes → error handler
    authz.js              JWT auth + RBAC + permission map (ROLE_PERMS)
    registry.js           declarative route registry: one definition wires the
                          handler, Zod validation, permissions AND the OpenAPI doc
    schemas.js            reusable Zod schemas (validation + components.schemas)
    openapi.js            OpenAPI 3.0 generator (docs derive from the registry)
    swagger.js            /api-docs + /openapi.json — admin JWT only
  src/events.js           in-process event bus → SSE (swap for Redis pub/sub when multi-node)
  src/routes/             auth (login/refresh/me) / patients / queue (incl. vitals) /
                          consults / public / medicines / templates / pharmacy / admin
  src/middleware/         JWT auth, RBAC authorize(), declarative validation, error handler
  src/dam/                Data Access Manager
    contract.js           the interface every adapter must implement
    memoryAdapter.js      in-process, seeded — default (DB_DRIVER=memory)
    mssqlAdapter.js       stored-procedure calls only (DB_DRIVER=mssql)
  src/cache.js            Redis when REDIS_URL is set, in-memory otherwise
  sql/01_schema.sql       tables, constraints, indexes
  sql/02_procs.sql        functions (fn_NextTokenNumber, fn_QueuePosition, fn_MaskName…)
                          + stored procedures (usp_Token_Issue, usp_Queue_PublicBoard…)
  sql/03_security.sql     EXECUTE-only app login — no table access
```

### Swapping the database

Services and routes depend only on `dam/contract.js`. To move off MSSQL, implement the
same ~13 methods in a new adapter (e.g. `postgresAdapter.js`), register it in
`dam/index.js`, and set `DB_DRIVER`. Nothing else changes.

### Switching to MSSQL

1. Run `sql/01_schema.sql`, `02_procs.sql`, `03_security.sql` (change the password).
2. Seed users — hashes via `node -e "import('bcryptjs').then(b=>console.log(b.hashSync('YourPassword',10)))"`.
3. In `server/.env`: `DB_DRIVER=mssql` + the `MSSQL_*` values (see `.env.example`).

### API documentation (Swagger)

`/api-docs` (UI) and `/openapi.json` (spec) require an **admin JWT** — Bearer header,
or `?token=` for browser navigation (the admin Analytics screen has an "API
documentation" button that opens it). The OpenAPI 3.0 document is generated from the
gateway's route registry: the same Zod schemas that validate requests produce the
documented schemas, so docs and enforcement cannot drift. Every operation carries its
tag, auth requirement (with the roles that hold the permission), validation rules,
status codes and examples. Public endpoints: `POST /api/auth/login`,
`POST /api/auth/refresh`, `GET /api/health`, and the masked patient-portal routes.

### Security practices in place

- bcrypt password hashing; constant-time compare path prevents user enumeration
- Short-lived JWT (30 min) with role claims; UI keeps it in memory, never localStorage
- RBAC middleware on every route; token status changes restricted to doctor/nurse
- All DB access via parameterized stored procedures; app DB account is EXECUTE-only
- Declarative input validation whitelist — unknown fields are stripped, not passed
- Rate limits: global 300/min, login 10/15 min, patient tracking 30/15 min
- Public queue board is privacy-masked (initials only) inside the DB (`fn_MaskName`);
  token tracking requires mobile + token together, sent in a POST body (never a URL)
- helmet security headers, explicit CORS allowlist, 64 kb body limit, generic 5xx
  messages (details go to structured logs), audit trail for every state change
- Queue status transitions validated server-side (no `done → in-consult`)

### Live updates (SSE)

`GET /api/public/queue/stream?dept=` pushes the masked board over Server-Sent Events —
the patient portal updates the instant a token is issued, called, or completed, and
derives "your position" client-side from board pushes (no extra tracking requests).
A slow poll (15 s) remains as a fallback. The event bus is in-process
(`server/src/events.js`); scale-out swaps it for Redis pub/sub.

### Redis

Optional. Set `REDIS_URL` and the public queue board is cached there (3 s TTL, absorbing
waiting-room polling); without it an in-process cache with the same contract is used.
