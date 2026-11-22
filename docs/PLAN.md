# Product Catalogue — Complete Solution Plan

> Status: plan only. No implementation files have been created from this document yet.
> Source: reconciled from the approved challenge plan plus the decision history in the
> "Plan for AI-native engineer challenge" session.
> Last updated: 2026-11-21

---

## 1. Objective

Build a small but production-minded product catalogue PoC for the AI-Native Engineer code
challenge, within a 2–3 hour timebox.

The assessment is about engineering judgement, architectural boundaries, explicit
assumptions, and disciplined AI-assisted delivery — not about feature volume.

**Core rule:** the browser never calls Fake Store API directly. All product traffic goes
through our backend.

---

## 2. Scope

### In scope (five user-facing capabilities)

| # | Capability | Behaviour |
|---|---|---|
| 1 | Home | Shows exactly the 5 configured "top rated" products |
| 2 | Category | Shows top-rated products first, then the remaining products in that category |
| 3 | Search | Text search over title, description, and category |
| 4 | Product detail | Full product information plus an enquiry action |
| 5 | Enquiry | Validates contact details, emails the sales inbox, shows a thank-you confirmation |

### Explicitly out of scope

Authentication, shopping cart, checkout/payments, admin dashboard, database persistence,
multi-currency, i18n, real cloud deployment, and a real transactional email account.

These are listed as next steps in `README.md` / `DECISIONS.md`, not built.

---

## 3. Technology stack

| Layer | Choice |
|---|---|
| Monorepo | npm workspaces |
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS + React Router + TanStack Query |
| Backend | Node.js + Express + TypeScript |
| Validation | Zod (shared contract) |
| Product data | Fake Store API behind a repository adapter |
| Email | Nodemailer SMTP behind an email-provider interface (Mailpit locally) |
| Testing | Vitest, React Testing Library, Supertest, nock |
| Local infra | Docker Compose: `web`, `api`, `mailpit` |

No paid services and no accounts required for a reviewer.

---

## 4. Architecture

```
Browser
  │  (single origin)
  ▼
web container (nginx)
  ├── static React build
  └── /api/* ──────────────► api container (Express)
                                 │
                                 ├── routes → services → repositories
                                 │        ProductRepository
                                 │          └── FakeStoreAdapter → Fake Store API
                                 │
                                 └── EmailProvider
                                       └── SmtpEmailProvider → Mailpit (local)
                                                              → SES/Resend (future)
```

### Seams (the two replaceable dependencies)

1. **`ProductRepository`** — `getAll()`, `getById(id)`, `getCategories()`.
   `FakeStoreAdapter` implements it today; a Mongo/Postgres adapter can replace it without
   touching routes, services, or the client.
2. **`EmailProvider`** — `send(enquiry)`. `SmtpEmailProvider` (Nodemailer) implements it
   today; swapping to SES/Resend is a new class plus config, nothing else.

### Layering rules

- Routes: HTTP concerns only — parse/validate input, map to service calls, map errors.
- Services: business rules (featured selection, category split, search, enquiry checks).
- Adapters: external I/O and normalization to the shared `Product` shape.
- Shared package: one Zod contract imported by both apps; no duplicated types.

---

## 5. Repository structure

```
product-catalogue/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── app.ts                 # express app factory (testable)
│   │   │   ├── index.ts               # server bootstrap
│   │   │   ├── config.ts              # zod-validated env
│   │   │   ├── errors.ts              # HttpError
│   │   │   ├── routes/
│   │   │   │   ├── products.ts
│   │   │   │   ├── categories.ts
│   │   │   │   ├── enquiries.ts
│   │   │   │   └── health.ts
│   │   │   ├── services/
│   │   │   │   ├── productService.ts
│   │   │   │   └── enquiryService.ts
│   │   │   ├── repositories/
│   │   │   │   ├── productRepository.ts
│   │   │   │   ├── fakeStoreAdapter.ts
│   │   │   │   └── fixtureAdapter.ts  # deterministic tests/offline
│   │   │   ├── email/
│   │   │   │   ├── emailProvider.ts
│   │   │   │   └── smtpProvider.ts
│   │   │   └── middleware/
│   │   │       ├── validate.ts
│   │   │       └── errorHandler.ts
│   │   ├── tests/
│   │   ├── Dockerfile
│   │   └── package.json
│   └── web/
│       ├── src/
│       │   ├── pages/                 # Home, Category, Search, ProductDetail, NotFound
│       │   ├── components/            # Layout, ProductCard, ProductGrid, EnquiryForm, States
│       │   ├── api/client.ts
│       │   ├── hooks/                 # React Query hooks
│       │   ├── App.tsx                # router
│       │   └── main.tsx
│       ├── tests/
│       ├── nginx.conf
│       ├── Dockerfile
│       └── package.json
├── packages/
│   └── shared/src/index.ts            # zod schemas + types
├── docs/
│   ├── DECISIONS.md
│   └── AI_USAGE.md
├── docker-compose.yml
├── .env.example
├── AGENTS.md
├── README.md
└── package.json
```

---

## 6. API contract

All endpoints are JSON. Errors use one envelope:

```json
{ "error": { "code": "NOT_FOUND", "message": "Product not found", "details": null } }
```

| Method | Endpoint | Purpose | Success |
|---|---|---|---|
| GET | `/api/health` | Liveness | `200 { status: "ok" }` |
| GET | `/api/products/featured` | The 5 configured featured products | `200 { products, total }` |
| GET | `/api/products?category=&q=&limit=` | List/filter/search | `200 { products, total }` |
| GET | `/api/products/:id` | Product detail | `200 Product` / `404` |
| GET | `/api/categories` | Distinct category names | `200 { categories: string[] }` |
| POST | `/api/enquiries` | Validate, verify product, send email | `201 { id, message }` |

### Query parameters

| Param | Type | Rules |
|---|---|---|
| `category` | string | Exact, case-insensitive category match |
| `q` | string | 2–100 chars, case-insensitive substring on title/description/category |
| `limit` | int | 1–100, optional |

> **Decision:** use `q`, not `search`. The shared `productQuerySchema` already defines `q`;
> keeping one name avoids contract drift. Documented in `DECISIONS.md`.

### Enquiry payload

```json
{
  "productId": 3,
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "message": "Is this available in black?"
}
```

Rules: `name` 2–100 chars, valid email ≤254, `message` optional ≤2000, product must exist.
Response: `201 { "id": "enq_<uuid>", "message": "Thank you — we'll be in touch shortly." }`

### Featured selection

- Configured list `FEATURED_PRODUCT_IDS=1,2,3,4,5` (curated, not computed).
- Order follows config order; unknown IDs are skipped with a warning.
- This satisfies "GIVEN I have chosen 5 products" literally.

### Category split

- Sort the category's products by `rating.rate` desc, then `rating.count` desc, then `id` asc.
- First 3 → `topRated`; remainder → `additional`.
- `FEATURED_PER_CATEGORY = 3` is a single documented constant.

---

## 7. Data flow

### Browse
`React Query hook → GET /api/products* → productService → ProductRepository → FakeStoreAdapter
→ normalized Product[] → filtered/sorted → JSON → cards`.

### Enquiry
`EnquiryForm → POST /api/enquiries → zod validate → product exists? → EmailProvider.send()
→ Mailpit captures → 201 → thank-you view`.

Failure modes:

| Condition | Status |
|---|---|
| Invalid body | `400 VALIDATION_ERROR` with field details |
| Unknown product | `404 PRODUCT_NOT_FOUND` |
| Fake Store unreachable/timeout | `502 UPSTREAM_UNAVAILABLE` |
| SMTP failure | `502 EMAIL_UNAVAILABLE` (enquiry not silently swallowed) |
| Unknown route | `404 NOT_FOUND` |

---

## 8. Frontend design

| Route | Page | Content |
|---|---|---|
| `/` | Home | Hero + 5 featured products |
| `/categories/:category` | Category | "Top rated" section (3) + "More in …" grid |
| `/search?q=` | Search | Search field, results, empty state |
| `/products/:id` | Detail | Image, title, price, rating, description, enquiry form |
| `*` | NotFound | Friendly 404 with link home |

Components: `Layout` (header, search form, category nav), `ProductCard`, `ProductGrid`,
`EnquiryForm`, `LoadingState`, `ErrorState`, `EmptyState`.

Behaviour:
- Search submits on button click **or** Enter, updates `?q=`, minimum 2 characters.
- Loading skeletons; retry button on error; empty states with guidance.
- Enquiry form: inline validation, disabled while submitting, "Thank you" confirmation on
  success, readable error on failure.
- Responsive from 360px up; accessible labels, focus states, semantic landmarks.

---

## 9. Configuration

`.env.example` (no secrets committed):

```
PORT=4000
NODE_ENV=development
FAKE_STORE_BASE_URL=https://fakestoreapi.com
FEATURED_PRODUCT_IDS=1,2,3,4,5
FEATURED_PER_CATEGORY=3
PRODUCT_CACHE_TTL_MS=300000
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=sales@productcatalogue.local
EMAIL_TO=sales-inbox@productcatalogue.local
```

Config is parsed and validated once at startup with Zod; invalid config fails fast.

---

## 10. Testing strategy

Tests map directly to acceptance criteria.

### API (Vitest + Supertest + nock)

1. Featured returns exactly the 5 configured IDs, in order.
2. Category split returns 3 top-rated + correct remainder.
3. Search matches title/description/category case-insensitively; short query rejected.
4. Product detail returns the correct product; unknown ID → 404.
5. Invalid enquiry → 400 with field errors; unknown product → 404.
6. Valid enquiry → 201 and `EmailProvider.send` called with expected payload.
7. Adapter normalization, upstream failure → 502, timeout handling.
8. Health and unknown-route envelope regression tests.

### Web (Vitest + RTL)

> Implementation note: the typed API client is mocked with `vi.mock` instead of MSW. The
> deviation and its reasoning are recorded in `docs/DECISIONS.md` (decision 13).

1. Home renders exactly 5 featured cards.
2. Category page renders top-rated and additional sections.
3. Search submit updates results; empty state shown.
4. Product detail renders data; enquiry form validates and submits.
5. Thank-you message appears after a successful enquiry.
6. Error state and retry path.

### Quality gates

`npm run typecheck`, `npm run test`, `npm run build` must pass before a task is declared done.

---

## 11. Build order

| Step | Work | Output |
|---|---|---|
| 0 | Scaffold (done) | Workspaces, shared contract, app shells, health endpoint, tests |
| 1 | Backend adapter + product routes | Fake Store adapter, product service, `/api/products*`, tests |
| 2 | Categories + featured | `/api/products/featured`, `/api/categories`, split logic, tests |
| 3 | Enquiry + email | Validation, product check, `EmailProvider`, `/api/enquiries`, tests |
| 4 | Frontend | Router, pages, components, hooks, form, tests |
| 5 | Docker | Dockerfiles, nginx proxy, compose + Mailpit, clean-clone dry run |
| 6 | Docs & PR | README, DECISIONS, AI_USAGE, AC table, branch/PR |

Each step is a separate reviewable commit with tests.

---

## 12. Docker and reviewer path

Target: reviewer is running in under 2 minutes.

```bash
cp .env.example .env
docker compose up --build
```

- App: `http://localhost:8080`
- Mailpit UI: `http://localhost:8025`
- API health: `http://localhost:4000/api/health`

Compose services:

| Service | Notes |
|---|---|
| `api` | Multi-stage build, non-root, healthcheck on `/api/health` |
| `web` | Vite build served by nginx; `/api` proxied to `api:4000`; waits for api health |
| `mailpit` | SMTP `1025`, UI `8025`; API waits for it |

`npm run dev` remains the documented fallback when Docker is unavailable.

---

## 13. Decisions and trade-offs (for `DECISIONS.md`)

1. **Curated featured IDs** instead of computed top-5 — matches the challenge wording.
2. **Top 3 per category** as the featured threshold — documented assumption.
3. **No persistence** — enquiries are emailed; stateless by design.
4. **`q` over `search`** — single shared contract.
5. **Mailpit captures locally**, it does not deliver to a real inbox — real SMTP is a config swap.
6. **In-memory TTL cache** is optional; added only if it does not delay the critical path.
7. **No rate limiting initially**; honeypot field on the enquiry form; rate limiting if time permits.
8. **Single origin via nginx** — avoids CORS in the reviewer path.
9. **Shared workspace package** kept — ~30 lines, real front/back boundary.
10. **Explicit cuts** — auth, cart, payments, admin, DB, cloud deploy.

---

## 14. Documentation deliverables

| File | Contents |
|---|---|
| `README.md` | What it is, stack, architecture diagram, quick start (Docker + dev), endpoints, scripts, config, trade-offs |
| `docs/DECISIONS.md` | The 10 decisions above, with rationale and alternatives |
| `docs/AI_USAGE.md` | Tools/models used, prompt strategy, review process, at least one real AI mistake and how it was caught |
| PR description | AC → implementation table, screenshots, verification commands |

---

## 15. Timeline (2h 45m)

| Phase | Time | Work |
|---|---|---|
| Init & scaffold | 15m | Workspaces, AGENTS.md, env, shared contract ✅ |
| Backend | 40m | Adapter, services, routes, tests |
| Frontend | 50m | Pages, components, hooks, tests |
| Docker & integration | 25m | Images, compose, clean-clone run |
| Testing review | 20m | Fill gaps, fix regressions, typecheck/build |
| Docs & PR | 15m | README, DECISIONS, AI_USAGE, PR |

---

## 16. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Fake Store API is slow/down during review | TTL cache + `fixtureAdapter` fallback + clear 502 messaging |
| Upstream response shape changes | Zod validation at the adapter boundary |
| SMTP unavailable | Explicit `502` and logged failure; enquiry is not reported as sent |
| Scope creep (rate limiting, caching, logging) | Treat as optional; ship the critical path first |
| Node version mismatch (`engines >=22.12` vs README "Node 20+") | Resolved: final floor is `^22.22.2 \|\| >=24.15.0` (jsdom 31 / undici 8); CI exposed that 22.12 was still too low |
| Time overrun | Cut optional infra, not tests or docs |

---

## 17. Definition of done

- All six endpoints implemented, validated, and tested.
- All five UI capabilities work end to end against the real Fake Store API.
- Enquiry arrives in Mailpit and the UI shows the thank-you state.
- `npm run typecheck`, `npm run test`, `npm run build` pass.
- `docker compose up --build` works from a clean clone in under 2 minutes.
- README, DECISIONS, and AI_USAGE are complete.
- Work is on `feat/product-catalogue` with a PR-ready description and AC table.
