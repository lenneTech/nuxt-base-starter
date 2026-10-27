---
name: project-placeholder-contrast
description: Nuxt UI placeholders (text-dimmed) failed WCAG AA in both modes; fixed 2026-10-27 by an app.config.ts override for all ten placeholder components, guarded by a contract test
metadata:
  type: project
---

Nuxt UI draws every placeholder `text-dimmed`. With the template's slate neutrals that measured
2.56:1 in light mode (#94a3b8 on #fff) and 3.75:1 in dark mode (#64748b on #0f172a). Lighthouse
reported it only on `/app/admin/ai/preferences` (accessibility 96, audit `color-contrast` on the
USelectMenu `span[data-slot=placeholder]` "Verbindung wählen"), because axe does not check
`::placeholder`, so UInput and UTextarea placeholders never showed up although they had the same colour.

Fixed on 2026-10-27: `app/app.config.ts` lifts the placeholder of input, inputDate, inputMenu (slot and
`multiple: false` variant), inputNumber, inputTags, inputTime, pinInput, select, selectMenu and textarea
to `text-muted` (4.76:1 light, 6.96:1 dark). After the fix, Lighthouse 13.4.1 (snapshot, mobile) gave
accessibility 100 on that page in both modes. `tests/unit/placeholder-contrast-contract.test.ts` checks
every override and computes the ratio from `app/assets/css/tailwind.css` and the installed @nuxt/ui token map.

**Why:** the defect was inherited by every generated project and is invisible to Lighthouse on pages
that only have text inputs.

**How to apply:** if a review sees `color-contrast` on a placeholder again, check first whether the
override is still in `app.config.ts` and whether the contract test still runs. A new Nuxt UI component
that draws a placeholder has to be added to both. Placeholder contrast is a real defect here, not a
pre-existing one to classify away.