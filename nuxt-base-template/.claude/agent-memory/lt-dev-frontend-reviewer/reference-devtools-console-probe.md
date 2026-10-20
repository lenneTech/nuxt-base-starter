---
name: devtools-console-probe
description: How to prove the Chrome DevTools MCP console capture works before trusting "no console messages" as evidence of no hydration mismatch
metadata:
  type: reference
---

An empty `list_console_messages` only counts as evidence (e.g. "no hydration mismatch") once the capture itself is shown to work.

Measured 2026-10-20 against the production build on :3001:

- `navigate_page` with `initScript: "console.error(...)"` produced NO captured message (tried twice, same and different URL). Do not use it as the probe.
- A main-document 404 (unknown Nuxt route) also logs nothing.
- Working probe: `navigate_page` to `data:text/html,<script>console.error('probe')</script>` — captured as `[error] probe`. Then navigate back to the page under test.

**How to apply:** run the data: URL probe once per review session before reporting a clean console. Leave the tab on `about:blank` at the end (no close_page tool is available to this agent).