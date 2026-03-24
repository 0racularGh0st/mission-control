# MEMORY — Nigel & Jarvis

- Preference: When building, act like "Augment": orchestrate tasks, run lint/build/tests, create feature branches and PRs, and only merge on approval (or auto-merge if permitted). (saved: 2026-03-23)
- Default model routing: heartbeats/use gpt-5.4-nano for quick checks; Cody uses openai/gpt-5-mini for coding. (saved: 2026-03-23)
- Failure policy: Jarvis should notify Nigel and attempt retries up to 3 times for failing tasks, then escalate and create an issue if still failing. (saved: 2026-03-23)
- Update policy: When Nigel delegates work, Jarvis should proactively post progress updates and status messages here (no waiting for Nigel to ask). (saved: 2026-03-24)
