---
name: AI behavior enforcement
description: Strict AI response requirements must be enforced in code, not just in prompts
---

Prompt instructions alone are not reliable for strict behavioral requirements in AI responses (e.g. "must include this exact sentence when confidence < 60", "never mention X").

**Why:** During widget estimate testing, the model ignored a MUST-include-exact-sentence prompt rule (confidence 30, sentence missing). Adding deterministic post-processing in the service layer (append sentence if missing, regex-replace forbidden words) made it reliable.

**How to apply:** Whenever the spec demands exact wording, forbidden words, or hard thresholds in AI output, add a code-level guard after the model call in the AI service, in addition to the prompt rule.

Related hardening for public AI-backed endpoints: they need permissive CORS (widget embeds on third-party sites — every public route must be in the CORS allowlist in the api-server app setup) and rate limiting (in-memory IP sliding window) to prevent LLM cost amplification and lead spam.
