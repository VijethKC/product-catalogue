# Product Catalogue

A small, production-minded product catalogue built for the AI-Native Engineer code challenge.

React + TypeScript client, Node.js + Express API, Fake Store API behind a replaceable adapter, and email delivery behind a replaceable provider.

## Status

Scaffolding is in place. The catalogue features, API endpoints, tests and Docker setup land in the following steps.

## Requirements

- Node.js 20+
- npm 10+

## Local development

```bash
cp .env.example .env
npm install
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:4000
- Health check: http://localhost:4000/api/health

The Vite dev server proxies `/api` to the API, so the browser only ever talks to one origin and no CORS configuration is needed.

## Structure

```
apps/
  api/        Express + TypeScript backend
  web/        React + Vite + TypeScript frontend
packages/
  shared/     Zod schemas and types shared by both apps
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Run API and web together |
| `npm run dev:api` | Run the API only |
| `npm run dev:web` | Run the web app only |
| `npm run test` | Run all tests |
| `npm run typecheck` | Type-check every workspace |
| `npm run build` | Build every workspace |

## Configuration

All configuration lives in environment variables. Copy `.env.example` to `.env`; never commit `.env`.
