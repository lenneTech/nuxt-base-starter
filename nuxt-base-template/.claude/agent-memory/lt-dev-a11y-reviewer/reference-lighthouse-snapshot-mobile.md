---
name: reference-lighthouse-snapshot-mobile
description: Chrome DevTools MCP lighthouse_audit in snapshot mode keeps the login session and still applies mobile emulation (412px); screenshots cannot be saved to the scratchpad
metadata:
  type: reference
---

- `lighthouse_audit` with `mode: snapshot, device: mobile` keeps the logged-in session AND applies
  Lighthouse's mobile screen emulation (`screenEmulation.width = 412`, DPR 1.75) — verified in
  `report.json` `configSettings` on 2026-10-26. No need to resize the window for narrow-width audits;
  `resize_page` below ~500px is clamped by Chrome's minimum window width anyway.
- `target-size` is a scored (binary) audit in Lighthouse 13.x, so it shows up in the failed list when it fails.
- `take_screenshot` with a `filePath` in the session scratchpad fails ("not within any of the configured
  workspace roots"); take inline screenshots instead.
- The MCP has no `press_key`/`evaluate_script` in this setup, so keyboard walks must be argued from DOM
  order plus the `tabindex` audit, or delegated.