# Decisions

Every notable choice in this repository, why it was made, what was rejected, and what it
costs. The goal is that a reader can disagree with a decision without having to
reverse-engineer it from the code.

---

## 1. Two explicit seams: `ProductRepository` and `EmailProvider`

**Decision.** All product data goes through `ProductRepository` (`getAll`, `getById`), and
all email goes through `EmailProvider` (`send`). Routes and services depend only on those
interfaces.

**Why.** The two dependencies most likely to change are the data source and the mail
transport. An interface makes the change local: a new adapter, one line in the composition
root, and nothing else moves. It also makes tests trivial — fixtures and fakes instead of
network stubs for the domain logic.

**Rejected.** Calling `fetch` and `nodemailer` directly from services. It works today and
couples every business rule to a vendor forever.

**Cost.** Two extra files and one indirection. Worth it at this size because both seams are
exercised by tests, so they are not speculative.

---

## 2. A shared workspace package for the contract

**Decision.** `packages/shared` holds the Zod schemas and response types; both apps import
them as TypeScript source.

**Why.** The most common bug in a split frontend/backend is a contract that drifts. One
schema definition means a field rename is a compile error on both sides. Shipping TypeScript
source (no build step) keeps the package to about 60 lines with no publish or bundling
overhead: tsup bundles it into the API, Vite compiles it for the web.

**Rejected.** Duplicated types per app, or a published npm package. Both add work without
adding safety at this scale.

---

## 3. Curated featured IDs, not a computed top five

**Decision.** The home page shows the products listed in `FEATURED_PRODUCT_IDS`
(default `1,2,3,4,5`).

**Why.** The five products are curated rather than computed, so this is a business
decision, not a query. Keeping it in configuration means the
business can change the selection without a deploy of new logic, and the behaviour is
obvious to a reader.

**Rejected.** Sorting by `rating.rate` and taking five. It would usually return the same
products, but it silently changes whenever Fake Store's data changes, and it removes the
merchant's control.

**Cost.** Unknown ids are skipped rather than fatal; the API validates that at least one id
is configured at boot.

---

## 4. "Top rated" per category means the top three

**Decision.** On a category page, products are sorted by `rating.rate` (descending), then
`rating.count`, then `id`, and the first `FEATURED_PER_CATEGORY` (default 3) become
`topRated`; the rest are `additional`.

**Why.** The requirement is "top rated products first, then the rest" without defining how
many are "top". Three is enough to look curated on a category with five to six products and
is configurable, so the assumption is visible rather than buried.

**Rejected.** A rating threshold (fragile with Fake Store's data), or a percentage of the
category (unpredictable at small sizes).

**Cost.** The client renders two sections; the split is a server decision so both the web
app and any future client agree.

---

## 5. `q` as the search parameter

**Decision.** `GET /api/products?q=…`, and `/search?q=…` in the web app.

**Why.** One parameter, one meaning, shared by client and server through
`productQuerySchema`. Short names are conventional for text search and survive being
composed with `category` and `limit`.

**Rejected.** `search`, `query`, or a separate `/api/search` endpoint. A separate endpoint
would duplicate filtering that `GET /api/products` already performs.

**Cost.** `q` is less self-documenting than `search`; the schema and README carry that
weight.

---

## 6. Stateless by design: no database, no persistence

**Decision.** Enquiries are validated, emailed, and forgotten. Nothing is written to disk.

**Why.** The requirement is "email the sales inbox". A database would add migrations,
connection handling, backups and a second failure mode without changing the user-visible
behaviour. The email is the record, and the inbox is where a sales team already looks.

**Rejected.** Persisting enquiries "in case email fails". If delivery fails the API returns
`502` and the user retries — which is honest and needs no storage.

**Cost.** No audit trail and no retry queue. Both are listed as next steps, not hidden.

---

## 7. Mailpit for local email, real SMTP in production

**Decision.** `SmtpEmailProvider` talks plain SMTP to whatever `SMTP_*` points at. Locally
that is Mailpit in Docker; in production it is a provider's SMTP credentials.

**Why.** A developer needs to see the email without an account, an API key, or a real inbox.
Mailpit captures everything and exposes a web UI, so the enquiry flow is verifiable in one
command. Because the provider is an interface, nothing in the service or route mentions
Mailpit.

**Rejected.** A hosted transactional API for local use (requires credentials, breaks the
"works from a clean clone" goal), or logging emails to the console (does not prove the
message renders).

**Cost.** SMTP is slower than an HTTP API and needs a live socket; timeouts are set to 5s
connect/greet and 10s socket so a dead server cannot hold a request open.

---

## 8. A delivery failure is never reported as success

**Decision.** `enquiryService` only resolves after `emailProvider.send` resolves. Any throw
becomes `502 EMAIL_UNAVAILABLE`, the underlying error is logged, and the client shows a
retry state.

**Why.** The worst outcome for an enquiry form is telling a customer their message was sent
when it was not. Failing loudly costs one retry; failing silently loses a sale and the
trust that goes with it.

**Rejected.** Fire-and-forget sending with an optimistic `201`. It hides outages.

**Cost.** The request waits for SMTP. The timeouts bound that wait.

---

## 9. Escape HTML, and strip newlines from the subject

**Decision.** Every value rendered into the HTML part goes through `escapeHtml`; the
subject strips CR/LF.

**Why.** User input reaches an email body, and email clients render HTML. Escaping removes
injection into the message; stripping CR/LF removes header injection through the subject.
The product title is escaped too even though it comes from upstream — defence in depth
costs one function call.

**Rejected.** Relying on the mail client, or sending plain text only. Plain text would lose
the readable layout, and "the client will handle it" is not a control.

**Cost.** None. The escaping is covered by unit tests, including a `<script>` payload.

---

## 10. One origin: Vite proxy in development, nginx in production

**Decision.** The browser only ever calls `/api/…` on its own origin. In development Vite
proxies to `:4000`; in Docker nginx proxies to `api:4000`.

**Why.** No CORS configuration, no preflight requests, no permissive
`Access-Control-Allow-Origin: *` to get wrong. The same relative URLs work in both
environments, so there is no environment-specific client code.

**Rejected.** Enabling CORS on the API and calling it cross-origin. It adds a security
surface and a second configuration to keep in sync.

**Cost.** The API is only reachable through the proxy in production. That is the intended
deployment shape, and port `4000` is still published for health checks and debugging.

---

## 11. No caching yet

**Decision.** Every request fetches from Fake Store.

**Why.** Correctness first. A cache would hide slow paths and make the featured/category
logic harder to reason about while it was still being built. Fake Store is fast enough for
at this scale, and the adapter is the only place a cache would go.

**Rejected.** An in-memory TTL cache now. It is the obvious next step — one wrapper around
`ProductRepository`, no changes above it — but it was deliberately kept out of the critical
path.

**Cost.** More upstream traffic and higher latency than necessary. Documented rather than
disguised.

---

## 12. No rate limiting, and no honeypot field

**Decision.** The enquiry endpoint is unauthenticated and unthrottled. No honeypot field was
added.

**Why.** This is a local deployment with no public exposure, and the plan allowed the honeypot
only "if time permits". It did not. Building a half-configured limiter would imply a
protection that is not really there.

**Rejected.** A token-bucket limiter in process memory. It would not survive multiple
instances and would give false confidence.

**Cost.** A real deployment needs rate limiting at the edge (nginx `limit_req`) or a shared
store, plus a honeypot or captcha. Called out here so it is a known gap, not an oversight.

---

## 13. Web tests mock the API client instead of using MSW

**Decision.** `apps/web` tests use `vi.mock` on the typed `api` module. The plan originally
named MSW.

**Why.** The client is a thin, typed wrapper around `fetch`. Mocking it tests what the UI
actually depends on — loading, error, empty and success states — without a service worker,
a handler file per endpoint, and extra timing sensitivity in jsdom. One dependency less, and
the tests read as intent rather than HTTP plumbing.

**Rejected.** MSW. It is the better tool when tests need to exercise real request/response
serialisation or share handlers with a browser dev setup; neither applies here.

**Cost.** The client itself is not covered by these tests; it is covered indirectly by the
API route tests and by the live end-to-end checks. This deviation is recorded rather than
left as silent drift from the plan.

---

## 14. Node 22.22.2 as the baseline

**Decision.** `engines.node` is `^22.22.2 || >=24.15.0`, CI runs 22.22.2, the Docker images
use `node:22-alpine`, and the README states 22.22.2+ (or 24.15+).

**Why.** The binding constraint is not Vite (which accepts `^20.19 || >=22.12`) but the test
toolchain: jsdom 31 declares `^22.22.2 || ^24.15.0 || >=26.0.0`, and its transitive undici 8
calls `zlib.createZstdDecompress` at module load — an API that does not exist in Node 22.12.
An earlier README said "Node 20+"; aligning it to 22.12 in Step 6 was still wrong, and the
first CI run proved it. The floor is now the lowest version that actually runs the whole
suite.

**Rejected.** Widening `engines` to Vite's floor, or pinning jsdom to an older major just to
keep Node 20 working. Either would trade a tested baseline for an untested one.

**Cost.** Contributors on Node 22.12–22.21 must upgrade. npm prints a clear engine warning
and CI runs the exact documented floor.

---

## 15. Docker: root context, workspace-filtered installs, non-root

**Decision.** Both images build from the repository root with an explicit `dockerfile:`.
The API image installs only `@catalogue/api` production dependencies; the web image builds
the SPA and copies `dist` into nginx. The API runs as the `node` user.

**Why.** npm workspaces need the root lockfile and every workspace manifest, so a per-app
context cannot resolve `@catalogue/shared`. Filtering the install keeps React, Vite and the
test tooling out of the API image (256 MB instead of far more). Non-root is the default-safe
choice for anything that runs in a container.

**Rejected.** Separate lockfiles per app (duplicates resolution and drifts), or a single
image serving both apps (loses nginx's static-file handling and couples two deploy
artifacts).

**Cost.** The build context is the whole repository, which `.dockerignore` trims to sources.

---

## 16. Compose interpolates `.env` but does not inject it

**Decision.** `docker-compose.yml` reads `${VAR}` for ports and email addresses, and sets
the API's `SMTP_HOST` to `mailpit` explicitly. It does not use `env_file`.

**Why.** `.env` is written for local development, where SMTP is `localhost`. Injecting it
into the container would point the API at itself instead of the Mailpit service. Explicit
service-level values make the container's configuration readable in one place, and keep
`.env` as a convenience for ports and addresses.

**Rejected.** `env_file: .env`. Convenient, and wrong for exactly the variable that matters.

**Cost.** New variables must be added to both `.env.example` and the compose file. That
duplication is the price of an unambiguous container environment.

---

## 17. No route-level code splitting

**Decision.** The web app ships as one bundle (~121 KB gzipped).

**Why.** Five small routes share most of their code (layout, cards, query hooks). Splitting
would add suspense boundaries and extra requests for a first-load saving measured in tens of
kilobytes. Below the threshold where it helps, it is complexity without benefit.

**Rejected.** `React.lazy` per page. Revisit when the detail page grows heavier than the
rest, or when a route pulls in a large dependency.

**Cost.** A slightly larger initial download. Accepted deliberately.

---

## 18. Explicit cuts

**Decision.** No authentication, cart, checkout, payments, admin, database, i18n,
multi-currency, or cloud deployment.

**Why.** This project is about judgement and boundaries, not feature volume. Each of these
is a project of its own, and a half-built version would be worse than an honest gap: it
would consume review attention while proving nothing.

**Rejected.** Stubs that look implemented. They mislead.

**Cost.** The app is a catalogue, not a shop. That is the brief.

---

## 19. CI runs typecheck, tests and builds — nothing else

**Decision.** One job on pull requests into `main` and pushes to `main`: `npm ci`, then
typecheck, test and build as separate steps, on Node 22.22.2.

**Why.** These three checks catch what review misses — a type error in an untouched file, a
regression in a test nobody re-ran, a build that only works because of a stale `dist/`. They
are also fast, need no secrets, and make no network calls, so a red build always means
something in the repository is wrong. Pinning to the minimum supported Node version (rather
than the latest) catches accidental use of an API that a contributor on the documented
minimum does not have.

**Rejected for now.** A Compose smoke job (it duplicates a one-command check already
verified locally, roughly doubles CI time, and runner Docker differs from Docker Desktop in
ways that produce failures unrelated to the change), Playwright end-to-end tests, a Node
version matrix, and anything that calls Fake Store.

**Cost.** CI does not prove the Docker path or the browser behaviour; both remain manual
checks recorded in `docs/IMPLEMENTATION_STEPS.md`. If the stack later needs guarding, the
smoke job is a small, well-understood addition — it is a scope decision, not a technical
limitation.
