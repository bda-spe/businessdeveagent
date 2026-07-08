---
name: LLM endpoint safety conventions
description: Rules for any authenticated AI/LLM endpoint and client-side chat persistence in this project
---
- Every endpoint that calls OpenAI must have a rate limit, even when authenticated (cost abuse). Convention here: in-route sliding-window Map keyed by businessId (~15 req/min); widget endpoints use per-IP (20/min).
**Why:** LLM calls are paid; an authenticated user (or leaked session) can otherwise run up costs.
**How to apply:** when adding any new /api route that calls aiService, add the same bucket pattern before the LLM call.
- Client-side chat/history storage must be scoped per user+business (e.g. key `feature:${userId}:${businessId}`), never a global key — prevents cross-account leakage on shared browsers.
- API message schemas enforce content maxLength; the client must clip history entries to the same limit or long model replies poison subsequent requests with 400s.
