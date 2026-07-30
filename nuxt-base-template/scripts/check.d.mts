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

/**
 * The environment overrides a package-manager invocation (`install` / `i` / `add` /
 * `ci` / `audit`) needs so its lifecycle hooks — notably `postinstall: nuxt prepare`
 * — write the isolated `.nuxt-check` build dir instead of the `.nuxt/` a parked
 * `nuxt dev` reads.
 *
 * Returns an env OBJECT rather than a `VAR=value` command prefix: that prefix is
 * POSIX-only, and this runner spawns commands directly, so it cannot reach the
 * `cross-env` the package.json scripts use either. Returns `{}` for commands that
 * need no override, including ones that already carry their own pin.
 */
export function checkBuildDirEnv(cmd: string): Record<string, string>;

/**
 * Split a leading environment assignment off a command, in either spelling the
 * package.json scripts use (`cross-env VAR=value cmd` or a bare `VAR=value cmd`).
 *
 * The runner spawns commands directly, so `node_modules/.bin` — and with it
 * `cross-env` — is only on PATH when the runner itself was started through the
 * package manager. Lifting the assignment into the spawn env makes a bare
 * `node scripts/check.mjs` work too, and saves a process per step.
 *
 * Returns the command unchanged with an empty env when there is nothing to lift.
 */
export function splitEnvPrefix(raw: string): { cmd: string; env: Record<string, string> };
