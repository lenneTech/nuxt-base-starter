---
name: oxfmt-oxlint-bump-needs-disable-nested-config
description: oxfmt/oxlint werden auf latest gehoben — aber der Root-oxfmt braucht seit 0.59 zwingend --disable-nested-config, sonst kämpft er mit der .editorconfig des Templates
metadata:
  type: feedback
---

`oxfmt` und `oxlint` werden wie jede andere Dependency exakt gepinnt und AKTUELL gehalten
(Stand 2026-07-16: `oxfmt` 0.59.0 root + template, `oxlint` 1.74.0 nur template).
Der Bump von oxfmt 0.28 → 0.59 ist NUR zusammen mit `--disable-nested-config` in den
root-Scripts gate-stabil:

```json
"format": "oxfmt --disable-nested-config",
"format:check": "oxfmt --check --disable-nested-config",
```

**Why:** Seit oxfmt 0.59 sucht der Formatter Configs in UNTERVERZEICHNISSEN. Er findet
`nuxt-base-template/.oxfmtrc.jsonc`, und diese nested config regiert dann das Template-
Verzeichnis — sie ignoriert sich naturgemäß nicht selbst. Damit wird
`ignorePatterns: [..., "nuxt-base-template"]` aus der Root-Config still ausgehebelt:
Der Root-Lauf zieht 85 statt 10 Dateien ein und kollidiert mit der `.editorconfig` des
Templates (`[*.md] insert_final_newline = false`). Folge ist ein PING-PONG: Der Root-
`oxfmt` schreibt die finale Newline in CLAUDE.md/README.md, der Template-`check` (auto-fix)
entfernt sie korrekt wieder → der nächste Root-`format:check` ist rot. Der Gate wirkt beim
ersten Lauf grün, weil der Root-Check VOR dem Template-Check läuft — erst der zweite Lauf
fällt um. Messwerte: `oxfmt@0.28 --check` = 10 files, alle korrekt; `oxfmt@0.59 --check`
= 85 files, 2 falsch. Mit `--disable-nested-config` wieder 10 files, 3 Läufe hintereinander
grün, Docs unverändert.

Kein Glob repariert das: `nuxt-base-template/**`, `./nuxt-base-template/**`,
`**/nuxt-base-template/**` und `nuxt-base-template/` ergeben alle weiterhin 85 files.
`ignorePatterns` ist NICHT abgeschafft (die oxc-Doku nennt es weiterhin "the recommended
way to ignore files") — es wird nur von der nested config überstimmt. Alternative, ebenfalls
verifiziert (10 files): `oxfmt --check . '!nuxt-base-template/**'`.

`oxlint` 1.43 → 1.74 ist unkritisch: nur der Default-Reporter änderte sich (kompakte
Einzeiler; bei null Findings gar keine Ausgabe). Mit einer Probe-Datei
(`no-const-assign` + `no-debugger`) verifiziert — beide Versionen melden beide Regeln.
Die fehlende `Found N warnings`-Summary ist für den Gate egal: `parseLint()` in
`scripts/check.mjs` fällt auf das Zählen von `\bwarning\b` zurück.

**How to apply:** Bump ruhig auf latest, aber (1) `--disable-nested-config` in den root-
Scripts belassen und (2) NACH dem Bump `pnpm run check` ZWEIMAL laufen lassen — ein
einzelner grüner Lauf beweist bei Formatter-Konflikten nichts. Docs dürfen dabei nicht im
`git diff` auftauchen. Frühere Fassung dieser Datei behauptete "~2200 Zeilen Churn, niemals
bumpen": Zahl war falsch (real: 2 Zeilen), die Warnung im Kern aber berechtigt — die
Ursache war nie der Churn, sondern die nested-config-Regression.
Siehe [[project-prefers-latest-exact-versions]].
