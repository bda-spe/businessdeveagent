---
name: api-server esbuild externals
description: Packages that must be externalized (not bundled) in the api-server esbuild build, and why.
---

The api-server dev workflow bundles with esbuild (`build.mjs`) before starting. Some packages break when bundled and must be added to the `external` list.

**Rule:** If the server crashes at startup with `Cannot find module ...` originating from inside `dist/index.mjs`, externalize the top-level dependency that pulls in the failing module instead of chasing the transitive dep.

**Why:** pdfkit → fontkit → brotli requires `@swc/helpers/cjs/_define_property.cjs` at runtime; with `@swc/*` already external and pnpm's isolated node_modules, the bundled require can't resolve it. Externalizing `pdfkit` (a direct dependency, so resolvable via pnpm symlinks) fixed it.

**How to apply:** Add the package name to the `external` array in `artifacts/api-server/build.mjs`, then restart the API Server workflow (the bundle only rebuilds on restart — vite HMR does not apply to the backend).

Also: the `installLanguagePackages` tool has failed for some npm packages here; `pnpm add <pkg> --filter @workspace/api-server` (run from repo root) works reliably.
