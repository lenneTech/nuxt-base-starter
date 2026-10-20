---
name: toast-capture-timing
description: Chrome DevTools MCP plain click blocks ~4s while a Nuxt UI toast animates, so a follow-up snapshot misses the 5s toast — use click with includeSnapshot before claiming "no feedback"
metadata:
  type: feedback
---

Before reporting "async action gives no feedback / toast missing", re-run the action with
`click(..., includeSnapshot: true)` and only trust that capture.

**Why:** Measured 2026-10-20 on /auth/register (duplicate e-mail, 400): a plain `click` returned
after ~4.1s (it waits for DOM stability, and the toast's progress bar keeps the DOM moving). The
default Nuxt UI toast lives 5s, so the separate `take_snapshot` afterwards showed an empty
Notifications list three times in a row. `includeSnapshot: true` caught the form mid-submit, and a
snapshot right after showed the toast at ~52% progress with the translated German message. The
"no feedback" result was a tool-timing artifact, nearly a false High finding.

**How to apply:** any toast/notification check in browser verification. Also applies to other
short-lived UI (progress overlays, transient banners).