---
name: packagemanager-pin-via-corepack-up
description: pnpm-Version wird per packageManager+SHA gepinnt und mit `corepack up` automatisch gehoben — devEngines ist verboten, es bricht jedes npx
metadata:
  type: feedback
---

Die pnpm-Version wird in BEIDEN `package.json` (root + `nuxt-base-template/`) über das
`packageManager`-Feld mit Integrity-Hash gepinnt:

```json
"packageManager": "pnpm@11.13.1+sha512.b2fc7683b8a6525414e7d13e1ba28caadd…"
```

**Automatik bei jedem Maintenance-Lauf:** `corepack up` in beiden Verzeichnissen. Der Befehl
hebt das Feld auf die aktuelle Version UND schreibt den SHA-512-Hash mit (Corepack verifiziert
den Download dagegen — Supply-Chain-Schutz). `corepack up` braucht ein EXISTIERENDES Feld;
angelegt wird es mit `corepack use pnpm@latest`. Kurioses Detail: `corepack use` schreibt im
root, aber NICHT in `nuxt-base-template/` (läuft mit exit 0 durch, Feld bleibt aus) — dort
das Feld einmal von Hand setzen, danach greift `corepack up` normal.

**Why:** Ohne `packageManager` hat Corepack keinen Pin und zieht schlicht die neueste pnpm-
Version aus der Registry (mit isoliertem Cache verifiziert = frischer Container → 11.13.1).
Zusammen mit `engines.pnpm: "^11.0.0"` ist das eine Zeitbombe: Am Tag des pnpm-12-Releases
zieht Corepack pnpm 12, `^11.0.0` schließt es aus, und `pnpm install --frozen-lockfile` im
Docker-Build stirbt mit `ERR_PNPM_UNSUPPORTED_ENGINE` — ohne Repo-Änderung. (pnpm erzwingt
`engines.pnpm` hart, verifiziert: pnpm 11.13.1 gegen `^9.0.0` → sofortiger Abbruch, keine
Warnung.) Solange `engines.pnpm` auf `>=9` stand, war der fehlende Pin harmlos; die
Verschärfung auf `^11.0.0` hat ihn scharf gemacht. Der Pin gehört ZWINGEND auch ins
`nuxt-base-template/` — dort liegt der Dockerfile, der in zwei Stages `corepack enable` ruft;
die root-`package.json` ist am Docker-Build gar nicht beteiligt.

**devEngines.packageManager ist VERBOTEN** — auch wenn pnpm 11 `packageManager` "legacy" nennt
und `devEngines` Ranges + Lockfile-Persistenz (`packageManagerDependencies`) bietet. Zwei
Killer, beide verifiziert: (1) JEDES `npx` im Projekt bricht mit `EBADDEVENGINES` ("Invalid
name pnpm does not match npm") — das Template nutzt npx in `reinit`, `clean`,
`build:develop|test|prod`, `start:extern` und im **pre-commit-Hook** (`npx lint-staged`), also
wäre jeder Commit tot. (2) Corepack akzeptiert in `devEngines` KEINE Ranges: `pnpm@^11.0.0` →
"Invalid package manager specification … expected a semver version" (pnpm-Issue #11388). Nur
ein echtes pnpm-Binary (kein Corepack-Shim) kann den Range — lokal ist `pnpm` aber ein Shim
(`corepack/dist/pnpm.js`), und der Dockerfile ruft `corepack enable`.

**How to apply:** Bei Maintenance `corepack up` in root + template laufen lassen, danach
`pnpm run check` (2x, siehe [[oxfmt-oxlint-bump-needs-disable-nested-config]]). Nicht auf
`devEngines` migrieren — jedes npx stirbt an EBADDEVENGINES.

**Update 2026-07-17 — Architektur weiterentwickelt (stack-weit):** Die Dockerfiles nutzen
KEIN Corepack mehr (Node ≥25 liefert es nicht mehr aus). Sie provisionieren pnpm jetzt via
Derive-Line aus dem Feld: `RUN npm install -g "$(node -p "require('./package.json').packageManager.split('+')[0]")"`.
CI liest das Feld ebenfalls (pnpm/action-setup OHNE version-Input; lt-monorepo-CI mit
derselben Derive-Line). Corepack bleibt nur auf Dev-Maschinen relevant (Shim liest den Pin;
`corepack up` bleibt die Bump-Automatik). Die Monorepo-Drift ist gelöst: `hoistPackageManager`
in der lt CLI hebt Sub-Projekt-Pins an die Root, und lt-monorepo trägt selbst den Pin.
Contract-Tests erzwingen das alles pro Repo (hier:
nuxt-base-template/tests/unit/pnpm-pin-contract.test.ts — Pin-Format, engines-Kopplung,
Dockerfile-Pattern, CI-Invarianten + funktionaler Provisioning-Beweis, gated auf
CI/PIN_PROVISION_TEST). Ein Bump ist NUR konsistent, wenn Pin + Tests grün bleiben — die
Tests schlagen fehl, wenn irgendwo eine zweite Versionsangabe (version-Input, hardcodes
`pnpm@N`, corepack enable) wieder einschleicht.
Siehe [[project-prefers-latest-exact-versions]].
