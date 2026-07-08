---
name: API server dev workflow rebuilds dist
description: Why code changes to the api-server require a workflow restart to take effect
---
The api-server dev workflow runs `pnpm run build` (esbuild → dist) and then serves the baked bundle — it does not hot-reload.

**Why:** Source edits under `artifacts/api-server/src` are invisible to the running server until the workflow restarts and rebuilds dist.

**How to apply:** After any api-server change, restart the `artifacts/api-server: API Server` workflow before curl-testing endpoints. Also: schema changes flow openapi.yaml → `cd lib/api-spec && pnpm run codegen` → drizzle push in lib/db; codegen briefly deletes generated api-client files, which can cause transient vite "Failed to load url .../generated/api.ts" errors in the web workflow (harmless once files regenerate).
