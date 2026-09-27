---
name: check-autofix-and-in-place-install-traps
description: The template `check` WRITES formatter output over the whole template (protect foreign uncommitted files first), and an in-place install after a @nuxt/test-utils bump keeps a stale circular copy — fresh-resolve instead.
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

**3. `nuxt-base-template/.nuxtrc` changes with the bump** (`setups.@nuxt/test-utils="<ver>"`,
written by `nuxt prepare`). It is a companion artifact — earlier dep-refresh commits carry it.

**How to apply:** 1 before every check run with foreign changes present; 2 and 3 whenever
`@nuxt/test-utils` moves. See [[override-necessity-fresh-resolve-test]] for the scratch method.
