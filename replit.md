# Business Development Agent (BDA)

Multi-tenant SaaS where local blue-collar service businesses create, train, test, and deploy their own AI "business development agent" — a digital employee that qualifies leads and produces price estimates via an embeddable website widget. Public brand is "BDA" / "Business Development Agent"; "Sean Pelillo Enterprises" appears only in footer/legal.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (binds `PORT`, defaults 8080)
- `pnpm --filter @workspace/bda run dev` — run the web frontend (Vite)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `npx tsc -b artifacts/api-server/tsconfig.json` — build API server + refresh composite project refs (run after DB schema changes)
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`. Optional: `ALLOWED_ORIGINS` (comma-separated extra origins for credentialed CORS).

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5, cookie-based Replit-managed Clerk auth (`@clerk/express`)
- Frontend: React + Vite, wouter routing, `@clerk/react`, TanStack Query, generated API client
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from `lib/api-spec/openapi.yaml`)

## Where things live

- DB schema (source of truth): `lib/db/src/schema/index.ts`
- API contract (source of truth): `lib/api-spec/openapi.yaml` → codegen into `lib/api-client-react` and `lib/api-zod`
- API routes: `artifacts/api-server/src/routes/*` wired in `routes/index.ts`; shared helpers in `src/lib/` (`auth.ts`, `business.ts`, `aiService.ts`, `defaults.ts`)
- CORS/app bootstrap: `artifacts/api-server/src/app.ts`
- Frontend pages: `artifacts/bda/src/pages/*`; shell + nav: `src/components/app-shell.tsx`; routing: `src/App.tsx`
- Embeddable widget: `artifacts/bda/public/widget.js` (self-contained; derives apiBase from its own script src origin)

## Architecture decisions

- Multi-tenant isolation: every authenticated query is scoped by `req.business!.id`; `:id` mutations include tenant predicates. New routes must follow this pattern.
- Auth wiring order in `routes/index.ts`: public routes (health, `widgetPublicRouter`) are mounted BEFORE `requireAuth + loadContext`; all business routes after.
- Frontend protected routing: each protected route passes its page component as `children` into `ProtectedApp` → `AppShell`. `AppShell` renders `children`; without children it shows a placeholder.
- CORS: credentialed (cookie) CORS is restricted to a first-party allowlist (`REPLIT_DEV_DOMAIN` / `REPLIT_DOMAINS` / `ALLOWED_ORIGINS`). Public widget endpoints (`/api/widget/config`, `/api/widget/interact`) allow any origin WITHOUT credentials and are mounted before the credentialed CORS middleware.
- Stripe checkout is a placeholder that sets `business.status = 'active'`.

## Product

- Onboarding creates a business (tenant) and marks onboarding complete.
- Owners manage business profile, services, pricing rules, lead requirements, and a knowledge base; test the agent in a sandbox; review a leads inbox; configure and embed the widget; manage billing.

## User preferences

- UI: white/navy, soft borders, rounded corners, spacious B2B SaaS "hiring a digital employee" feel. No emojis anywhere in the product UI.

## Gotchas

- Rerun `pnpm --filter @workspace/api-spec run codegen` after any `openapi.yaml` change; run `npx tsc -b artifacts/api-server/tsconfig.json` after DB schema changes (stale composite `@workspace/db` type decls otherwise).
- Drizzle timestamps use `timestamp({ mode: "string" })`; money/scores use `doublePrecision`.
- `clientId` format is `bda_` + hex.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
