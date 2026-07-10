---
name: Object storage router split (public read / authed write)
description: How the object-storage routes must be mounted so anonymous callers can read but not mint upload URLs.
---

Split the object-storage router into two: a public router for the object-serving
GET routes (`/storage/public-objects/*`, `/storage/objects/*`) and a separate
authed router for presigned upload URL minting (`POST /storage/uploads/request-url`).
Mount the public one before `requireAuth`; mount the authed one after
`requireAuth, loadContext` but before `requireActiveSubscription` (so it still
works during onboarding/trial).

**Why:** The Replit object-storage skill template ships a single router. Mounting
the whole thing publicly (needed for `<img>` logo previews, which cannot send an
auth header) also exposes upload-URL minting to anonymous callers — an arbitrary
bucket-write / cost-abuse vector. Public read of unguessable-UUID logo paths is
fine; public write is not.

**How to apply:** Whenever you make object-serving public for image previews,
keep the upload endpoint behind auth. bda's Clerk auth is cookie-based
(same-origin), so the generated upload hook authenticates like every other authed
hook — no bearer-token wiring needed.
