/**
 * Public surface of `scripts/check.mjs` — the pure helpers its guard imports.
 *
 * The runner itself is plain JavaScript on purpose (it must run via bare
 * `node scripts/check.mjs`, before any install or build step exists). This file
 * exists so `tests/unit/nuxt-builddir-isolation.test.ts` can import those
 * helpers under `strict` without `allowJs` or a `@ts-expect-error` bypass — and
 * it doubles as the written-down contract of what the runner exposes.
 *
 * Only the exported helpers belong here. Everything else in check.mjs is
 * internal and must stay unimported, so the guard cannot start a check run as a
 * side effect (the module's `isCliEntry()` gate is what makes that safe).
 */

/** A workspace project as `discoverProjects()` yields it. */
export interface CheckProject {
  /** The project's real `check` chain, `&&`-separated. */
  check: string;
  /** Absolute directory the steps run in. */
  dir: string;
  /** package.json `name`, or the relative path when it has none. */
  name: string;
  /** Path relative to the workspace root; `.` for the root project. */
  rel: string;
}

/** One resolved step of a project's chain. */
export interface CheckStep {
  /** The command as it will be executed — already fix-mapped. */
  cmd: string;
  cwd: string;
  /**
   * Environment overrides for this step, spread over the inherited environment at
   * spawn time. Empty when the step needs none.
   */
  env: Record<string, string>;
  /** Whether a non-zero exit aborts the run. */
  fatal: boolean;
  /** Stable bucket used for the report and the gate (`test`, `build`, …). */
  kind: string;
  /** Human-readable name shown in the report. */
  label: string;
}

export interface CheckGroups {
  /** The single hoisted audit command, or null when no chain has one. */
  auditCmd: null | string;
  groups: { project: CheckProject; steps: CheckStep[] }[];
}

/**
 * Split each project's chain into ordered steps, hoisting the audit to one
 * workspace-level run. Pure — safe to call from a test.
 */
export function buildGroups(projects: CheckProject[]): CheckGroups;

/*
 * Removed: `checkBuildDirEnv()` and `splitEnvPrefix()`.
 *
 * The runner used to inject `NUXT_BUILD_DIR=.nuxt-check` into package-manager
 * steps itself, matching them by regex, so their lifecycle hooks (notably
 * `postinstall: nuxt prepare`) would not rewrite the `.nuxt/` a parked
 * `nuxt dev` reads. That responsibility now sits where it belongs: every
 * `check:*` script in package.json carries its own `cross-env NUXT_BUILD_DIR=`
 * prefix on the `install` and `audit` it starts with.
 *
 * Declaring the pin at the call site beats inferring it from a command string —
 * the regex had to keep pace with every spelling (`pnpm i`, `pnpm add`,
 * `npm ci`, `bun install`, …) and silently missed the ones it did not know.
 * `tests/unit/nuxt-builddir-isolation.test.ts` asserts the new arrangement:
 * that the scripts themselves declare it, for every entry point.
 */
