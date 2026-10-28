---
name: check-autofix-and-in-place-install-traps
description: The template `check` WRITES formatter output over the whole template (protect foreign uncommitted files first), and an in-place install after a @nuxt/test-utils or nuxt bump keeps stale duplicate copies — fresh-resolve instead.
metadata:
  type: feedback
---

**1. `pnpm run check` is not read-only.** `nuxt-base-template/scripts/check.mjs` rewrites
`format:check` → `format` (oxfmt WRITES) and `lint` → `lint:fix` unless `--no-fix` is passed.
The root `check` calls it without `--no-fix`. So when another session has an uncommitted file
in the template that must stay byte-identical, prove the auto-fix is a no-op on it BEFORE any
check run: `./node_modules/.bin/oxfmt --check <file>` — with the oxfmt version that will
actually run (after an oxfmt bump, test via `pnpm dlx oxfmt@<new> --check` first). For an
oxlint bump, run `pnpm dlx oxlint@<new> --fix app/ scripts/ server/` on a scratch COPY and
`diff -rq` against the real dirs. Verify `shasum` after every run.

**Why:** 2026-09-27, a foreign `tailwind.css` change (DEV-3297) had to survive maintenance +
two gate runs untouched; it did only because both checks were done up front.

**2. After bumping `@nuxt/test-utils`, do NOT trust the in-place `pnpm install`.**
`vitest-environment-nuxt@2.0.0` depends back on `@nuxt/test-utils`; the lockfile keeps the OLD
test-utils entry for that edge (it still satisfies the range), and that old copy drags the
previous `vue` family (10 `@vue/*` packages) along. Audit and peers stay green, so nothing flags
it. Fix: fresh resolve in scratch (package.json + pnpm-workspace.yaml + .npmrc, no lockfile, no
node_modules, `pnpm install --lockfile-only --ignore-scripts`), copy that lockfile in,
`pnpm install --frozen-lockfile`. Tell-tale: `grep -oE "^  '?vue@[0-9][^'(:]*" pnpm-lock.yaml | sort -u`
shows two versions.
Not specific to test-utils: on 2026-10-11 a plain `pnpm add -E nuxt@4.6.1` (+4 patches) kept
`@nuxt/kit@4.6.0`/`@nuxt/schema@4.6.0` next to 4.6.1 plus the old `@types/node` and
`@vitejs/plugin-vue`. After ANY framework bump, diff the package set against a fresh resolve
and adopt the fresh lockfile (that is what `lt fullstack init` produces anyway).
Seen again 2026-10-28: the orchestrator's in-place nuxt 4.6.2 -> 4.6.3 bump left `@nuxt/kit`/
`@nuxt/schema` 4.6.2 under @nuxt/fonts, @nuxt/icon, devtools-kit and the unplugin family, with
typecheck, build and audit all green. The fresh lockfile removed them (plus ~50 patch lifts).

**3. `nuxt-base-template/.nuxtrc` changes with the bump** (`setups.@nuxt/test-utils="<ver>"`,
written by `nuxt prepare`). It is a companion artifact — earlier dep-refresh commits carry it.

**How to apply:** 1 before every check run with foreign changes present; 2 and 3 whenever
`@nuxt/test-utils` moves. See [[override-necessity-fresh-resolve-test]] for the scratch method.
