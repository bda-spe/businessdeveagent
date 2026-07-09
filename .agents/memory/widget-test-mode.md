---
name: Embedding a production widget for safe live testing
description: How to preview/test a customer-facing embeddable widget inside the dashboard without risking real side effects (leads, emails).
---

When a product ships an embeddable widget script (e.g. `widget.js`) and the dashboard needs a "live preview" or "test agent" experience, prefer embedding the real widget in an iframe over hand-building a mock chat UI.

**Why:** A parallel mock UI drifts from the real widget's behavior over time and doubles maintenance. Reusing the actual script guarantees the preview always matches production, and the safety boundary (never creating real leads/emails) can live entirely in the backend's test-mode routes rather than duplicated in two frontends.

**How to apply:**
- Add a `data-test-mode="true"` flag read by the widget script; when set, it should call a parallel set of "test" API routes (e.g. `/widget-test/*` instead of `/widget/*`) that never persist real leads or send real emails, but can reuse the same underlying tables (e.g. inserting into a "sandbox tests" table) so existing feedback/history features keep working.
- Serve a minimal static HTML shell (e.g. `widget-test.html`) that just loads the widget script with the test-mode flag, and embed that shell via `<iframe src={`${BASE_URL}widget-test.html`} />` from the dashboard page.
- Use `window.postMessage` for the two things an iframe can't do via shared state: (1) the widget notifies the parent when a conversation result is ready (so the dashboard can show feedback controls tied to the resulting record's id), and (2) the parent tells the widget to reset its conversation in place after feedback is saved, so the very next reply reflects the feedback without a full page/iframe reload.
- Same-origin dashboard + API means cookies/session work automatically inside the iframe — no CORS or auth bridging needed as long as the iframe is served from the same origin as the app.
