# Product Catalogue

A small, production-minded product catalogue built for the AI-Native Engineer code challenge.

React 19 + TypeScript client, Node.js + Express API, the Fake Store API behind a replaceable
repository adapter, and enquiry email behind a replaceable provider.

**Core rule: the browser never calls Fake Store directly.** Every product request goes
through our API, so caching, validation, reshaping and rate limiting stay under our control.

---

## What it does

| # | Capability | Route | Behaviour |
|---|---|---|---|
| 1 | Home | `/` | Exactly the five configured "top rated" products (`FEATURED_PRODUCT_IDS`) |
| 2 | Category | `/categories/:category` | Top-rated products first, then the rest of that category |
| 3 | Search | `/search?q=…` | Case-insensitive match on title, description and category |
| 4 | Detail | `/products/:id` | Full product information plus the enquiry form |
| 5 | Enquiry | form on the detail page | Validates contact details, emails the sales inbox, shows a thank-you state |

---

## Architecture

```
Browser
   │  http://localhost:8080   (Docker: nginx)
   │  http://localhost:5173   (dev: Vite proxies /api)
   ▼
┌─────────────────────────────────────────────────────────────────┐
│  Express API                                                    │
│                                                                 │
│  routes/            HTTP only: parse, validate, status codes    │
│    products  categories  enquiries                              │
│         │                                                       │
│  services/          business rules, no Express types            │
│    productService        enquiryService                         │
│         │                       │                               │
│  seams              ┌───────────┴────────────┐                  │
│         ▼           ▼                        ▼                  │
│  ProductRepository              EmailProvider                   │
│    ├─ FakeStoreAdapter (HTTP)     └─ SmtpEmailProvider          │
│    └─ FixtureAdapter  (tests)          (Nodemailer)             │
└─────────────────────────────────────────────────────────────────┘
         │                                │
         ▼                                ▼
   Fake Store API                    Mailpit :1025
```

Three layers with one rule each: **routes** know HTTP, **services** know the business,
**adapters** know the outside world. Swapping Fake Store for a database means writing one
new `ProductRepository`; swapping SMTP for SES or Resend means writing one new
`EmailProvider`. Neither change touches the service or the route.

Both apps import request and response schemas from `packages/shared`, so the contract
cannot drift between client and server.

---

## Quick start (Docker)

Requires Docker with Compose v2. Nothing else.

```bash
cp .env.example .env
docker compose up --build
```

| Service | URL |
|---|---|
| App | http://localhost:8080 |
| Mailpit (captured emails) | http://localhost:8025 |
| API health | http://localhost:4000/api/health |

Submit an enquiry from any product page and it appears in Mailpit within a second.
Compose starts `mailpit` first, then `api`, then `web` — each gated on the previous
service's healthcheck.

```bash
docker compose down      # stop
docker compose down -v   # stop and drop captured mail
```

---

## Quick start (local dev)

Requires Node.js 22.12+ and npm 10+.

```bash
cp .env.example .env
npm install

# Terminal 1 — SMTP only, so enquiries actually send
docker compose up mailpit

# Terminal 2 — API :4000 + web :5173
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:4000
- Health: http://localhost:4000/api/health

Without an SMTP server the rest of the app works normally, but submitting an enquiry
returns `502 EMAIL_UNAVAILABLE` and the form shows its retry state. That is intentional:
the API never reports success when delivery failed.

---

## API

| Method | Path | Query / body | Success |
|---|---|---|---|
| `GET` | `/api/health` | — | `200 { "status": "ok" }` |
| `GET` | `/api/products` | `?category=&q=&limit=` | `200 { products, total }` |
| `GET` | `/api/products/featured` | — | `200 { products, total }` |
| `GET` | `/api/products/:id` | — | `200 Product` |
| `GET` | `/api/categories` | — | `200 { categories }` |
| `GET` | `/api/categories/:category` | — | `200 { category, topRated, additional }` |
| `POST` | `/api/enquiries` | `{ productId, name, email, message? }` | `201 { id, message }` |

`Product` is `{ id, title, price, description, category, image, rating: { rate, count } }`.

### Errors

Every failure uses one envelope:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid enquiry", "details": { "email": ["Invalid email address"] } } }
```

| Code | Status | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid query, body, or path parameter |
| `NOT_FOUND` | 404 | Unknown route |
| `PRODUCT_NOT_FOUND` | 404 | Unknown product id |
| `CATEGORY_NOT_FOUND` | 404 | Unknown category |
| `UPSTREAM_UNAVAILABLE` | 502 | Fake Store network error, timeout, or non-2xx |
| `UPSTREAM_INVALID_RESPONSE` | 502 | Fake Store payload violates the contract |
| `EMAIL_UNAVAILABLE` | 502 | SMTP delivery failed |
| `INTERNAL_ERROR` | 500 | Unexpected failure (details are logged, never returned) |

---

## Structure

```
apps/
  api/                 Express + TypeScript
    src/
      routes/          HTTP surface
      services/        business rules
      repositories/    ProductRepository + Fake Store / fixture adapters
      email/           EmailProvider + SMTP implementation
      middleware/      async error forwarding, 404, error envelope
      config.ts        Zod-validated environment
    tests/             unit + route tests
  web/                 React + Vite + TypeScript
    src/
      api/             typed fetch client
      hooks/           TanStack Query hooks
      components/      layout, cards, grid, rating, price, states, enquiry form
      pages/           Home, Category, Search, Detail, 404
    nginx.conf         SPA fallback + /api proxy
packages/
  shared/              Zod schemas and types used by both apps
```

---

## Scripts

Run from the repository root.

| Command | Purpose |
|---|---|
| `npm run dev` | API on :4000 and web on :5173 together |
| `npm run dev:api` | API only |
| `npm run dev:web` | Web only |
| `npm run test` | All tests (API + web) |
| `npm run typecheck` | Type-check every workspace |
| `npm run build` | API bundle + web production build |

Workspace-specific commands exist too, for example
`npm run test --workspace @catalogue/api`.

---

## Configuration

Copy `.env.example` to `.env`. Every value has a safe default; the file documents intent
rather than being required. `.env` is gitignored and must never be committed.

| Variable | Default | Used by |
|---|---|---|
| `PORT` | `4000` | API |
| `NODE_ENV` | `development` | API |
| `FAKE_STORE_BASE_URL` | `https://fakestoreapi.com` | Fake Store adapter |
| `FAKE_STORE_TIMEOUT_MS` | `5000` | Fake Store adapter |
| `FEATURED_PRODUCT_IDS` | `1,2,3,4,5` | Home page selection |
| `FEATURED_PER_CATEGORY` | `3` | Category split threshold |
| `SMTP_HOST` | `localhost` | Email |
| `SMTP_PORT` | `1025` | Email |
| `SMTP_USER` / `SMTP_PASS` | empty | Email (auth is omitted when empty) |
| `EMAIL_FROM` | `sales@productcatalogue.local` | Email |
| `EMAIL_TO` | `sales-inbox@productcatalogue.local` | Email |
| `WEB_PORT` / `API_PORT` | `8080` / `4000` | Compose host ports |
| `MAILPIT_UI_PORT` / `MAILPIT_SMTP_PORT` | `8025` / `1025` | Compose host ports |

The API validates this configuration at boot with Zod and refuses to start on invalid
values, so misconfiguration fails loudly instead of at the first request.

---

## Testing

| Suite | Count | Covers |
|---|---|---|
| API | 62 | product service rules, Fake Store adapter (nock), all routes (Supertest + fixtures), enquiry service and route, email formatting/escaping |
| Web | 11 | pages, search, category split, detail, enquiry form states, 404 |

```bash
npm run typecheck && npm run test && npm run build
```

Route tests inject a fixture repository and a fake email provider through `createApp`, so
they run offline and never send mail. The web tests mock the typed API client, which keeps
them focused on UI behaviour.

---

## Continuous integration

`.github/workflows/ci.yml` runs on every pull request into `main`, on `main` after merge,
and on demand. One job, three checks:

| Step | Command |
|---|---|
| Typecheck | `npm run typecheck` |
| Test | `npm run test` |
| Build | `npm run build` |

It installs with `npm ci` on Node 22.12 — the minimum supported version — with the npm
cache enabled. Separate steps mean a failure names the check that broke.

The job is deterministic: no network calls to Fake Store, no secrets, no Docker build. The
Compose path is verified locally with the commands in the quick start above.

---

## Trade-offs and next steps

Full reasoning is in [`docs/DECISIONS.md`](docs/DECISIONS.md). The short version:

- **No persistence.** Enquiries are emailed, not stored; the API is stateless.
- **No caching yet.** Fake Store is called per request. A short-TTL cache is the first
  performance change, deliberately deferred so it cannot mask correctness bugs.
- **No rate limiting.** Needed before this is exposed publicly; see decisions.
- **No auth, cart, payments, admin, database or cloud deploy.** Explicitly out of scope
  for the challenge, listed here rather than half-built.
- **Mailpit captures mail locally.** Point `SMTP_*` at a real provider and nothing else
  changes.

---

## Documentation

| Document | Contents |
|---|---|
| [`docs/PLAN.md`](docs/PLAN.md) | Original plan: scope, contract, build order, risks |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Layer-by-layer walkthrough, file map, request flows |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Every notable decision, with alternatives and consequences |
| [`docs/IMPLEMENTATION_STEPS.md`](docs/IMPLEMENTATION_STEPS.md) | What was built in each step and how it was verified |
| [`docs/UI_DESIGN.md`](docs/UI_DESIGN.md) | Visual and interaction design |
| [`docs/AI_USAGE.md`](docs/AI_USAGE.md) | How AI was used, reviewed, and where it was wrong |
| [`docs/PULL_REQUEST.md`](docs/PULL_REQUEST.md) | PR description with the acceptance-criteria mapping |
