---
"@crsiebler/mcp-jev-server": minor
---

Add the local `jev_evaluate` MCP tool for typed boolean, choice and score
questions through Vercel AI Gateway. Supply `AI_GATEWAY_API_KEY`; calls send
provided state externally and may incur charges. Requests/results are bounded,
privacy routing controls are requested, and automatic retries/fallback are disabled.
No live model access or quality claim is implied by the offline package checks.
