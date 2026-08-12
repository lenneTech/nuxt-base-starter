/**
 * Guards the "check and dev never share a Nuxt build directory" contract.
 *
 * `nuxt dev`, `nuxt prepare` and `nuxt build` all write their generated types —
 * including `tsconfig.json` — into the build dir. With a single shared `.nuxt/`,
 * a parked dev server rewrote that file in place while the `check` chain's
 * type-check was reading it, and the run failed with a flood of TS2307 on every
 * `~`/`#` alias plus TS1378 — on code that was perfectly fine. It reads exactly
 * like a real type error, so it costs a debugging round every single time.
 *
 * The mechanism is a second build dir (`.nuxt-check/`) that only the gates write
 * to. This file is what keeps it wired: each assertion pins one link of that
 * chain, so a later edit that quietly re-points a gate at the dev `.nuxt/` fails
 * the unit suite instead of resurfacing months later as a phantom type error.
 *
 * Writing assertions here: assert the EFFECT, never the spelling. A guard that
 * cannot fail is worse than no guard, and every defect this contract has had so
 * far was of that shape — a regex whose interpolated `.` was a wildcard, a `-p`
 * pattern that silently exempted the equally valid `--project`, and a
 * `.dockerignore` check that compared a line instead of asking whether the
 * pattern matches (docker anchors slash-free patterns at the context root;
 * gitignore does not). Prefer a small explicit matcher over a regex, and escape
 * every interpolation.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Importing the runner is itself part of the contract: it must expose its pure
// helpers WITHOUT starting a check run. If check.mjs's `isCliEntry()` gate ever
// regresses, this import kicks off the full pipeline and the suite never
// returns — loud enough that it cannot be missed.
import { buildGroups } from '../../scripts/check.mjs';

const templateRoot = join(import.meta.dirname, '..', '..');

/** The isolated build directory the gates use. */
const CHECK_DIR = '.nuxt-check';
/** The shared build directory `nuxt dev` and the IDE use. */
const DEV_DIR = '.nuxt';
/**
 * The build directory `lt dev test`'s app process uses. Nothing in THIS repo
 * writes it — the `cli` exports `NUXT_BUILD_DIR=.nuxt-test` when it brings up the
 * isolated test stack, and `buildDir` below picks that up. That asymmetry is the
 * whole reason the entries need a guard: a grep for `.nuxt-test` inside this
 * template finds only ignore/clean lines, which reads like dead configuration
 * and invites deletion.
 */
const TEST_DIR = '.nuxt-test';
/**
 * Where the template ends up once `lt fullstack init` has run. The docker build
 * context is the MONOREPO root, so this — not the bare directory name — is the
 * path `/.dockerignore` has to exclude.
 */
const APP_REL = 'projects/app';

/**
 * The Nitro OUTPUT directory — a second axis entirely from the three build dirs
 * above (DEV-2724).
 *
 * `buildDir` and Nitro's `output.dir` are unrelated knobs, so isolating the
 * former did nothing for the latter and `.output/` stayed shared between
 * `build`, `build:check` and `lt dev test`. For that last one it is the normal
 * case rather than an edge case: it serves the production bundle, so it runs a
 * full build on every run and overwrites the tree a local `pnpm run build` is
 * using.
 */
const OUT_DIR = '.output';
/**
 * The output dir `lt dev test`'s app process builds into. Same asymmetry as
 * `TEST_DIR`: nothing in this template writes it — the `cli` exports
 * `NITRO_OUTPUT_DIR=.output-test` and the config below forwards it — so the
 * ignore/clean entries look like dead configuration without this guard.
 */
const OUT_TEST_DIR = '.output-test';

const read = (rel: string): string => readFileSync(join(templateRoot, rel), 'utf8');
const scripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts;

/** Escape a literal for safe interpolation into a RegExp. */
const rx = (literal: string): string => literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Commands that WRITE a Nuxt build directory — only these read NUXT_BUILD_DIR.
// `generate` is in here for the same reason `build` is: it runs a full build.
// `typecheck` is in here because `nuxt typecheck` PREPARES the build dir before
// handing off to vue-tsc — it appears in READS_BUILD_DIR below as well, and it is
// the only command in both lists. Leaving it out here would exempt the app-source
// gate from the pinning rule, which is exactly the collision this file exists to
// prevent.
const WRITES_BUILD_DIR = /\bnuxt\s+(?:build|prepare|generate|typecheck)\b/;
// Commands that READ the generated tsconfig. `tsc` / `vue-tsc` / `tsgo` ignore
// NUXT_BUILD_DIR entirely — they follow the `-p` config, so their half of the
// contract is "point at a .check tsconfig", asserted separately. `nuxt typecheck`
// is listed because it wraps vue-tsc and would otherwise be invisible here.
const READS_BUILD_DIR = /\b(?:(?:vue-)?tsc|tsgo|nuxt\s+typecheck)\b/;

/**
 * tsconfigs here are JSONC (they are heavily commented). Strip line and block
 * comments outside of strings, and the trailing commas TypeScript accepts but
 * JSON.parse does not, so they can be parsed.
 */
export function stripJsonComments(text: string): string {
  let out = '';
  let inString = false;
  let inLine = false;
  let inBlock = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (inLine) {
      if (c === '\n') {
        inLine = false;
        out += c;
      }
      continue;
    }
    if (inBlock) {
      if (c === '*' && next === '/') {
        inBlock = false;
        i++;
      }
      continue;
    }
    if (inString) {
      out += c;
      if (c === '\\') {
        out += next ?? '';
        i++;
      } else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
      continue;
    }
    if (c === '/' && next === '/') {
      inLine = true;
      i++;
      continue;
    }
    if (c === '/' && next === '*') {
      inBlock = true;
      i++;
      continue;
    }
    out += c;
  }
  return out.replace(/,(?=\s*[}\]])/g, '');
}

function readTsconfig(rel: string): Record<string, unknown> {
  try {
    return JSON.parse(stripJsonComments(read(rel))) as Record<string, unknown>;
  } catch (e) {
    // JSON.parse errors carry a character offset and no file name — useless
    // when six configs are compared in one run.
    throw new Error(`${rel}: ${(e as Error).message}`);
  }
}

const splitSteps = (chain: string): string[] =>
  chain
    .split('&&')
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Resolve a chain step down to the leaf commands that actually run. Returns a
 * LIST, not a joined string: the env var has to be checked per command, or one
 * isolated command vouches for an un-isolated neighbour.
 */
export function resolveSteps(cmd: string, table: Record<string, string>, seen = new Set<string>()): string[] {
  const m = /^pnpm\s+(?:run\s+)?([\w:-]+)$/.exec(cmd.trim());
  if (!m?.[1] || seen.has(m[1]) || !table[m[1]]) return [cmd.trim()];
  seen.add(m[1]);
  return splitSteps(table[m[1]]).flatMap((s) => resolveSteps(s, table, seen));
}

/**
 * A leaf command that STILL delegates to another script — i.e. `resolveSteps`
 * gave up. Such a step is invisible to the gate assertions below, so it is a
 * silent vacuous pass rather than a harmless miss. `pnpm install` / `pnpm audit`
 * are real commands, not indirections, and must not trip this.
 */
export const unresolved = (step: string): boolean => {
  // Anything between the package manager and `run` is tolerated rather than parsed.
  // Flags come in too many shapes to enumerate — `-s`, `--silent`, `-r`,
  // `--parallel`, and value-taking ones like `--filter app` / `-F app` — and an
  // enumeration that misses one does not fail loudly, it silently declares the step
  // "resolved" and every assertion about it passes vacuously. `pnpm -r run check` is
  // not hypothetical: check.mjs strips exactly that shape from a monorepo root
  // chain. The `[^&|;]*?` stops at a command separator so a later `run` in a
  // different command cannot be attributed to this one.
  if (!/\b(?:pnpm|npm|yarn|bun)\b[^&|;]*?\brun\s+[\w:-]+/.test(step)) return false;
  // Real commands, not indirections — these must not trip the guard even when a
  // flag precedes them.
  return !/\b(?:pnpm|npm|yarn|bun)\b[^&|;]*?\b(?:audit|ci|install|i|add|exec|dlx|why)\b/.test(step);
};

const leavesOf = (chain: string): string[] => splitSteps(chain).flatMap((s) => resolveSteps(s, scripts));

/**
 * The template's full check chains, derived rather than hardcoded so a later
 * `check:ci` cannot be added without inheriting the contract. A "chain" is a
 * `check*` script that actually reaches a build dir once resolved — excluding
 * the `check` wrapper (`node scripts/check.mjs`).
 */
const CHECK_CHAINS = Object.keys(scripts)
  .filter((k) => /^check(?::|$)/.test(k))
  .filter((k) => leavesOf(scripts[k] as string).some((s) => WRITES_BUILD_DIR.test(s) || READS_BUILD_DIR.test(s)));

// Does `.dockerignore` actually exclude `.nuxt-check`?
//
// Docker matches a pattern against the FULL context-relative path and anchors
// anything without a leading globstar at the context root — the opposite of
// gitignore, where a slash-free pattern matches at any depth. This implements
// the subset of the syntax the template uses; it is deliberately a matcher and
// not a string comparison, so it accepts every correct spelling and rejects the
// bare one. (Line comments on purpose: a literal leading globstar contains the
// block-comment terminator and would end a `/** … */` block early.)
// Supported spellings, and the ones deliberately NOT modelled:
//   `**/name`, `name`, `name/`, `**/prefix-*`  → understood
//   `!pattern`                                 → understood (re-include, last wins)
//   `/leading-slash`, `*/*/name`, `a/**/b`     → NOT understood; reported as
//                                                "not covered", i.e. a LOUD false
//                                                negative rather than a silent pass
// If an assertion using this fails against a `.dockerignore` that is in fact
// correct, extend the matcher — do not weaken the assertion.
export function dockerIgnoreCovers(patterns: string[], path: string): boolean {
  // Docker applies every pattern in order and the LAST match wins, so a later `!`
  // re-include cancels an earlier exclusion. Returning on the first hit (as a
  // `.some()` does) reports a re-included directory as excluded — a vacuous pass
  // for exactly the edit most likely to break the contract. Negation is already
  // used in this file (`!README.md`), so this is not a hypothetical shape.
  const lastSegment = path.slice(path.lastIndexOf('/') + 1);
  let covered = false;

  for (const raw of patterns) {
    const line = raw.trim().replace(/\/$/, '');
    if (!line || line.startsWith('#')) continue;

    const negated = line.startsWith('!');
    const pattern = negated ? line.slice(1) : line;
    const anyDepth = pattern.startsWith('**/');
    const bare = anyDepth ? pattern.slice(3) : pattern;

    // A single trailing `*` (e.g. `.nuxt-*`) is the one wildcard the ignore files
    // use; anything richer stays unmodelled on purpose (see the note above).
    const isPrefixGlob = bare.endsWith('*') && !bare.slice(0, -1).includes('*');
    const matches = (candidate: string): boolean => (isPrefixGlob ? candidate.startsWith(bare.slice(0, -1)) : candidate === bare);

    // Anchored (no globstar) matches the full context-relative path only; with the
    // globstar it may also match at any depth.
    const hit = anyDepth ? matches(path) || matches(lastSegment) : matches(path);
    if (hit) covered = !negated;
  }

  return covered;
}

describe('nuxt.config exposes an overridable buildDir', () => {
  it(`reads NUXT_BUILD_DIR and falls back to ${DEV_DIR}`, () => {
    // `||`, not `??`: an exported-but-empty `NUXT_BUILD_DIR=` is falsy but not
    // nullish, so `??` forwards `''`. Nuxt's schema happens to catch that, but
    // relying on it puts the safety in the framework — and without it
    // `resolve(rootDir, '')` is the rootDir, i.e. Nuxt would write its generated
    // tree straight over the checked-in sources.
    const match = /buildDir:\s*process\.env\.NUXT_BUILD_DIR\s*\|\|\s*'([^']+)'/.exec(read('nuxt.config.ts'));
    expect(match, `nuxt.config.ts must set buildDir: process.env.NUXT_BUILD_DIR || '${DEV_DIR}'`).toBeTruthy();
    expect(match?.[1]).toBe(DEV_DIR);
  });
});

describe(`the gates build into ${CHECK_DIR}, never into ${DEV_DIR}`, () => {
  it('the derived chain list still covers raw/fix/naf', () => {
    // CHECK_CHAINS is derived, so a renamed chain silently shrinks the matrix
    // below instead of failing. Pin the floor.
    for (const expected of ['check:raw', 'check:fix', 'check:naf']) expect(CHECK_CHAINS).toContain(expected);
  });

  it.each(['check:raw', 'check:fix', 'check:naf'])('%s: every build-dir writer pins NUXT_BUILD_DIR', (chain) => {
    expect(scripts[chain], `package.json must define ${chain}`).toBeTruthy();
    const leaves = leavesOf(scripts[chain] as string);

    for (const leaf of leaves) {
      expect(unresolved(leaf), `check step \`${leaf}\` delegates to a script this guard cannot resolve — every assertion about it would pass vacuously`).toBe(false);
    }

    const writers = leaves.filter((s) => WRITES_BUILD_DIR.test(s));
    expect(writers.length, `${chain} must still contain nuxt build/prepare commands`).toBeGreaterThan(0);
    for (const cmd of writers) {
      expect(cmd, `command \`${cmd}\` (in ${chain}) writes a Nuxt build dir but does not pin NUXT_BUILD_DIR=${CHECK_DIR}, so it collides with a parked dev server`).toMatch(
        new RegExp(`NUXT_BUILD_DIR=${rx(CHECK_DIR)}(?=\\s|$)`),
      );
    }
  });

  it.each(['check:raw', 'check:fix', 'check:naf'])('%s: still runs the build AND the type-check', (chain) => {
    // Isolation is worthless if the gate it isolates gets dropped: deleting the
    // typecheck step left the suite green, because the build alone satisfied the
    // "at least one build-dir writer" assertion.
    const joined = leavesOf(scripts[chain] as string).join(' && ');
    expect(joined, `${chain} lost its build step`).toMatch(/\bnuxt\s+build\b/);
    expect(joined, `${chain} no longer type-checks against tsconfig.tests.check.json`).toContain('tsconfig.tests.check.json');
    // `server/` is outside the app tsconfig's include, so without its own gate a
    // Nitro plugin or server route is type-checked by nothing at all.
    expect(joined, `${chain} no longer type-checks server/ (via ${CHECK_DIR}/tsconfig.server.json)`).toContain(`${CHECK_DIR}/tsconfig.server.json`);
  });

  it('lint covers server/, not just app/', () => {
    // Same gap as the type-check: `oxlint app/` silently skips every Nitro plugin
    // and server route in the template.
    expect(scripts.lint, '`lint` must exist').toBeTruthy();
    expect(scripts.lint, '`lint` no longer covers server/').toMatch(/\bserver\/?(?:\s|$)/);
    expect(scripts['lint:fix'], '`lint:fix` no longer covers server/').toMatch(/\bserver\/?(?:\s|$)/);
  });

  it('the standalone app-source typecheck isolates too (CI calls it directly)', () => {
    // `.github/workflows/test.yml` runs `pnpm run typecheck` in its own job, so
    // isolating only inside `check:raw` would leave that path on the shared dir.
    // `nuxt typecheck` both prepares AND reads the build dir, so one pinned
    // invocation has to cover both halves.
    expect(scripts.typecheck, '`typecheck` must exist — it is the app-source half of the gate').toBeTruthy();
    const steps = resolveSteps('pnpm run typecheck', scripts);
    const writers = steps.filter((s) => WRITES_BUILD_DIR.test(s));
    expect(writers.length, '`typecheck` must run through a Nuxt command that prepares the build dir').toBeGreaterThan(0);
    for (const cmd of writers) expect(cmd).toMatch(new RegExp(`NUXT_BUILD_DIR=${rx(CHECK_DIR)}(?=\\s|$)`));
  });

  it('the standalone typecheck script isolates too (CI calls it directly)', () => {
    // .github/workflows/test.yml runs `pnpm run typecheck:tests` outside any
    // check chain. Isolating only inside `check:raw` would leave that path on
    // the shared dir.
    const writers = resolveSteps('pnpm run typecheck:tests', scripts).filter((s) => WRITES_BUILD_DIR.test(s));
    expect(writers.length, '`typecheck:tests` must still prepare a build dir before type-checking').toBeGreaterThan(0);
    for (const cmd of writers) expect(cmd).toMatch(new RegExp(`NUXT_BUILD_DIR=${rx(CHECK_DIR)}(?=\\s|$)`));
  });

  it(`\`build\` itself stays on ${DEV_DIR} (Docker/CI image build)`, () => {
    // The image build runs in its own container — isolating it there would only
    // add a second intermediate dir to the layer.
    expect(scripts.build, '`build` must exist (a deleted script would pass the check below vacuously)').toBeTruthy();
    expect(scripts.build).not.toContain('NUXT_BUILD_DIR=');
  });

  it('every type-check gate points at a .check tsconfig', () => {
    // The env var alone is not enough: `tsc -p tsconfig.tests.json` would still
    // read the DEV chain no matter which dir `nuxt prepare` just wrote. Both
    // `-p` and `--project` spellings count — matching only `-p` let
    // `--project tsconfig.tests.json` through green, which IS the broken state.
    let seenProjectFlag = 0;
    for (const chain of CHECK_CHAINS) {
      for (const cmd of leavesOf(scripts[chain] as string)) {
        if (!READS_BUILD_DIR.test(cmd)) continue;
        for (const m of cmd.matchAll(/(?:^|\s)(?:-p|--project)(?:[=\s]+)(\S+)/g)) {
          seenProjectFlag++;
          // Two acceptable shapes, because the contract is "resolves through the
          // isolated build dir", not "is spelled .check.json":
          //   - a hand-written twin (`tsconfig.tests.check.json`), which extends
          //     into `.nuxt-check/`
          //   - a config Nuxt GENERATES inside `.nuxt-check/` (the server one),
          //     which needs no twin because it is already in the isolated dir
          expect(m[1], `\`${cmd}\` type-checks against ${m[1]} — gates must resolve through ${CHECK_DIR}`).toMatch(
            new RegExp(`(?:^|/)tsconfig(?:\\.[\\w-]+)*\\.check\\.json$|^${rx(CHECK_DIR)}/`),
          );
        }
      }
    }
    // Without this, a `tsc` invoked with no -p at all makes the loop body
    // unreachable and the test vacuous.
    expect(seenProjectFlag, 'expected at least one explicit -p/--project gate invocation').toBeGreaterThan(0);
  });
});

// A package-manager invocation the CHECK RUNNER makes on its own — as opposed to
// the `nuxt build` / `nuxt prepare` steps above, which the package.json scripts
// pin themselves. `pnpm install` fires `postinstall: nuxt prepare`, and that hook
// has no NUXT_BUILD_DIR of its own: whatever the process triggering the install
// passes down is what the hook writes. Left unpinned it writes `.nuxt/` — the dev
// server's directory — which is the same race as above, just moved from the
// type-check phase into the install phase.
const PM_INVOCATION = /\b(?:pnpm|npm|yarn|bun)\s+(?:audit|ci|install|i|add)\b/;
/**
 * How a package.json chain pins itself, for a chain STARTED DIRECTLY (which
 * bypasses the runner). Anchored, because a pin buried mid-command would not reach
 * the child's env.
 *
 * `cross-env` is required rather than merely tolerated: a bare `VAR=value cmd`
 * prefix is POSIX shell syntax, and `cmd.exe` reads it as the program name. These
 * scripts are invoked standalone (`typecheck:tests` is its own CI job), so the
 * portable spelling is the contract, not a preference.
 */
const PINNED = new RegExp(`^cross-env\\s+NUXT_BUILD_DIR=${rx(CHECK_DIR)}\\s`);

describe(`the check runner's own package-manager steps write ${CHECK_DIR} too`, () => {
  // Fed the REAL chain from package.json rather than a fixture, so this fails
  // both ways it can go wrong: the pin being dropped, and the chain quietly
  // losing the step the pin was for.
  const asProject = (check: string) => ({ check, dir: templateRoot, name: 'template', rel: '.' });

  it('the chain still runs a package-manager step at all', () => {
    // Without this, the assertions below pass vacuously the day the chain stops
    // installing — the vacuous-guard failure mode this file's header warns about.
    expect(scripts['check:raw'], 'check:raw no longer contains an install/audit — the pin below asserts nothing').toMatch(PM_INVOCATION);
  });

  it('the runner carries the chain’s own pin through to the step it will spawn', () => {
    // The runner used to ADD the pin itself, matching package-manager commands by
    // regex. It no longer does: the package.json chains declare it (asserted
    // below), and the runner only has to not lose it on the way through
    // `buildGroups`. That is what this checks — the pin survives the split into
    // steps, verbatim, so the spawned child really sees it.
    //
    // Why the chain is the better place for it: the old regex had to keep pace
    // with every spelling a lifecycle hook can hide behind (`pnpm i`, `pnpm add`,
    // `npm ci`, `bun install`, …) and silently missed the ones it did not know.
    // A declaration at the call site cannot miss anything.
    let seen = 0;
    const { groups } = buildGroups([asProject(scripts['check:raw'] as string)]);
    for (const step of groups.flatMap((g) => g.steps)) {
      if (!PM_INVOCATION.test(step.cmd)) continue;
      seen++;
      expect(step.cmd, `step \`${step.cmd}\` reaches the runner without its NUXT_BUILD_DIR=${CHECK_DIR} pin — the chain declared one, the split dropped it`).toMatch(PINNED);
    }
    expect(seen, 'no package-manager step surfaced — the loop body never ran and this test proved nothing').toBeGreaterThan(0);
  });

  it('the hoisted audit keeps its pin too', () => {
    // The audit is lifted out of the step list and spawned separately, so it takes
    // a different code path through the runner and needs its own assertion.
    const { auditCmd } = buildGroups([asProject(scripts['check:raw'] as string)]);
    expect(auditCmd, 'the chain no longer yields a hoisted audit').toBeTruthy();
    expect(auditCmd as string, `the hoisted audit \`${auditCmd}\` lost its NUXT_BUILD_DIR=${CHECK_DIR} pin during the hoist`).toMatch(PINNED);
  });

  it('the raw chains pin their package-manager steps themselves', () => {
    // The runner pin only helps when the runner runs. Starting `check:raw` /
    // `check:fix` / `check:naf` directly bypasses it, so the chains carry the
    // pin as well. Both layers are idempotent, so they compose rather than
    // collide.
    let seen = 0;
    for (const [name, chain] of Object.entries(scripts).filter(([k]) => /^check(?::|$)/.test(k))) {
      for (const step of splitSteps(chain)) {
        if (!PM_INVOCATION.test(step)) continue;
        seen++;
        expect(step, `\`${name}\`: step \`${step}\` runs the package manager unpinned — started directly it fires \`postinstall: nuxt prepare\` against ${DEV_DIR}`).toMatch(
          PINNED,
        );
      }
    }
    expect(seen, 'no check chain surfaced a package-manager step — this test no longer proves anything').toBeGreaterThan(0);
  });

  it('`init` / `reinit` stay unpinned (they are what supplies the IDE)', () => {
    let seen = 0;
    for (const script of ['init', 'reinit']) {
      const cmd = scripts[script];
      // assert, not `continue` — with a skip, renaming both scripts away leaves
      // this test green having checked nothing. That is the same vacuous-pass
      // trap this file's header warns about.
      expect(cmd, `\`${script}\` script is gone — it is what keeps the IDE's ${DEV_DIR} supplied`).toBeTruthy();
      seen++;
      expect(cmd, `\`${script}\` must stay unpinned — it is what keeps the IDE's ${DEV_DIR} supplied`).not.toMatch(/NUXT_BUILD_DIR=/);
    }
    expect(seen, 'expected both `init` and `reinit` to be present').toBe(2);
  });

  it.each([
    'pnpm install --frozen-lockfile',
    'pnpm i',
    'pnpm i --frozen-lockfile',
    'pnpm add some-package',
    'pnpm audit --fix',
    'npm install',
    'npm ci',
    'npm audit fix',
    'yarn install',
    'bun install',
    'bun audit',
  ])('PM_INVOCATION still recognises `%s` as a lifecycle-hook carrier', (cmd) => {
    // The pin now lives in package.json, but this pattern is what decides which
    // steps the assertions above demand a pin FOR. If it stopped matching a
    // spelling, those tests would skip that step and pass while it ran unpinned —
    // the vacuous pass this file's header warns about. `pnpm i` and `pnpm add`
    // matter as much as `install`: they fire the same `postinstall: nuxt prepare`.
    expect(PM_INVOCATION.test(cmd), `\`${cmd}\` runs a lifecycle hook but no longer matches PM_INVOCATION`).toBe(true);
  });

  it.each(['pnpm run test:unit', 'bash scripts/check-server-start.sh', 'oxlint app/', 'pnpm important-custom-script'])('PM_INVOCATION leaves `%s` alone', (cmd) => {
    // Over-matching is the other failure direction: it would demand a build-dir pin
    // on steps that write no build dir, so the chains would grow pins that mean
    // nothing and the real ones would be harder to spot.
    expect(PM_INVOCATION.test(cmd), `\`${cmd}\` writes no build dir but is treated as a package-manager step`).toBe(false);
  });
});

describe('the gate tsconfigs mirror the editor ones, only re-pointed', () => {
  const pairs = [
    { check: 'tsconfig.check.json', dev: 'tsconfig.json' },
    { check: 'tests/tsconfig.check.json', dev: 'tests/tsconfig.json' },
    { check: 'tsconfig.tests.check.json', dev: 'tsconfig.tests.json' },
  ];

  it.each(pairs)('$check is $dev with .nuxt → .nuxt-check', ({ check, dev }) => {
    // Structural equality after the substitution is what makes the twins safe to
    // keep: a compilerOption added to one but forgotten in the other would
    // silently weaken the gate.
    //
    // The substitution must be TOTAL. Rewriting only `./.nuxt/` left a bare
    // token — e.g. `"exclude": [".nuxt"]` — in the expectation, so the guard
    // demanded the WRONG edit: a correctly re-pointed twin failed, a wrongly
    // copied one passed.
    const substituted = JSON.stringify(readTsconfig(dev))
      .replaceAll(`${DEV_DIR}/`, `${CHECK_DIR}/`)
      .replaceAll(`"${DEV_DIR}"`, `"${CHECK_DIR}"`)
      // The chain's own links: tests/tsconfig.json → ../tsconfig.json, and
      // tsconfig.tests.json → ./tests/tsconfig.json.
      .replace(/"\.\.\/tsconfig\.json"/g, '"../tsconfig.check.json"')
      .replace(/"\.\/tests\/tsconfig\.json"/g, '"./tests/tsconfig.check.json"');
    expect(substituted, `the ${DEV_DIR} → ${CHECK_DIR} substitution did not cover every occurrence in ${dev} — the expectation would demand a wrong twin`).not.toMatch(
      new RegExp(`${rx(DEV_DIR)}(?!-)`),
    );
    expect(readTsconfig(check)).toEqual(JSON.parse(substituted));
  });

  it(`the editor tsconfigs still resolve through ${DEV_DIR}`, () => {
    // The IDE follows the dev server, not the gate — that is the whole point of
    // keeping two sets.
    expect(readTsconfig('tsconfig.json').extends).toBe(`./${DEV_DIR}/tsconfig.json`);
    expect(readTsconfig('tests/tsconfig.json').extends).toBe('../tsconfig.json');
    expect(readTsconfig('tsconfig.tests.json').extends).toBe('./tests/tsconfig.json');
  });

  it(`the gate tsconfigs resolve through ${CHECK_DIR}`, () => {
    expect(readTsconfig('tsconfig.check.json').extends).toBe(`./${CHECK_DIR}/tsconfig.json`);
    expect(readTsconfig('tests/tsconfig.check.json').extends).toBe('../tsconfig.check.json');
    expect(readTsconfig('tsconfig.tests.check.json').extends).toBe('./tests/tsconfig.check.json');
  });
});

describe(`${CHECK_DIR} is ignored and cleaned like ${DEV_DIR}`, () => {
  const lines = (rel: string): string[] => read(rel).split('\n');

  it('is gitignored (the bare `.nuxt` pattern does not cover it)', () => {
    // Unlike dockerignore, a slash-free gitignore pattern DOES match at any
    // depth, so a bare entry is correct here.
    expect(lines('.gitignore').map((l) => l.trim())).toContain(CHECK_DIR);
  });

  it('is excluded from the docker build context', () => {
    // Asserting the line's presence would prove nothing: docker anchors a
    // slash-free pattern at the context root. The target is deliberately the
    // POST-INIT path — against the bare directory name a root-anchored pattern
    // matches too, so the assertion would accept the very spelling that excludes
    // nothing once the template sits in a monorepo.
    expect(
      dockerIgnoreCovers(lines('.dockerignore'), `${APP_REL}/${CHECK_DIR}`),
      `.dockerignore does not actually exclude ${APP_REL}/${CHECK_DIR} — it needs the globstar form`,
    ).toBe(true);
  });

  it('`clean` and `reinit` both remove it alongside .nuxt', () => {
    // `reinit` needs it explicitly: it delegates to `nuxt cleanup`, which reads
    // `buildDir` from the config with no NUXT_BUILD_DIR in scope and therefore
    // only ever removes `.nuxt`.
    for (const script of ['clean', 'reinit']) {
      expect((scripts[script] ?? '').split(/\s+/), `\`${script}\` must also remove ${CHECK_DIR}`).toContain(CHECK_DIR);
    }
    expect((scripts.clean ?? '').split(/\s+/)).toContain(DEV_DIR);
  });

  it('`prepare:ide` exists — the gates no longer refresh the editor dir', () => {
    // Before the split, `typecheck:tests` was `nuxt prepare && tsc …` with no
    // env, so running the gate regenerated the editor's `.nuxt/` as a side
    // effect. That reflex is gone; this script is its named replacement.
    expect(scripts['prepare:ide']).toBe('nuxt prepare');
  });
});

// The gate dir (above) removed the `check` ⊥ `nuxt dev` collision. `lt dev test`
// was the pairing left over: it builds the app to run the suite against the
// production bundle, and `@nuxt/cli` locks ON the build dir
// (`acquireLock(nuxt.options.buildDir)`). Sharing `.nuxt` therefore did not
// interleave writes, it made the build ABORT — "Another Nuxt dev is already
// running" — so the test app never came up and every spec failed on a missing
// selector, which reads like broken specs while being pure infrastructure. The
// `cli` now exports `NUXT_BUILD_DIR=.nuxt-test` for that process; these entries
// are this repo's half of it.
describe(`${TEST_DIR} is ignored and cleaned like ${DEV_DIR} (the \`lt dev test\` stack)`, () => {
  const lines = (rel: string): string[] => read(rel).split('\n');

  it('the three build dirs are pairwise distinct', () => {
    // Isolation is only isolation while the names differ. Collapsing any two —
    // e.g. "reuse the gate dir for tests, it is throwaway anyway" — re-creates a
    // lock conflict, just between a different pair of commands.
    expect(new Set([DEV_DIR, CHECK_DIR, TEST_DIR]).size).toBe(3);
  });

  it('is gitignored (the bare `.nuxt` pattern does not cover it)', () => {
    // `.nuxt` matches that exact name only, so without its own entry the test
    // stack's build dir shows up as untracked after every suite run.
    expect(lines('.gitignore').map((l) => l.trim())).toContain(TEST_DIR);
  });

  it('is excluded from the docker build context', () => {
    expect(
      dockerIgnoreCovers(lines('.dockerignore'), `${APP_REL}/${TEST_DIR}`),
      `.dockerignore does not actually exclude ${APP_REL}/${TEST_DIR} — a slash-free pattern is anchored at the context root, so it needs the globstar form`,
    ).toBe(true);
  });

  it('`clean` and `reinit` both remove it', () => {
    // Same reason `reinit` needs the gate dir spelled out: it delegates to
    // `nuxt cleanup`, which reads `buildDir` from the config with no
    // NUXT_BUILD_DIR in scope and only ever removes `.nuxt`.
    for (const script of ['clean', 'reinit']) {
      expect((scripts[script] ?? '').split(/\s+/), `\`${script}\` must also remove ${TEST_DIR}`).toContain(TEST_DIR);
    }
  });

  it('no script in this repo pins the test dir — the `cli` owns that', () => {
    // Guards the division of labour. A `build:test`-style script pinning
    // NUXT_BUILD_DIR=.nuxt-test here would drift from what `lt dev test` actually
    // exports, and the dir the suite runs in would depend on which side won.
    const pinned = Object.entries(scripts).filter(([, body]) => body.includes(`NUXT_BUILD_DIR=${TEST_DIR}`));
    expect(pinned.map(([name]) => name)).toEqual([]);
  });
});

// The build-dir split (above) freed the Nuxt lock, which is what made
// `lt dev test` abort next to a parked dev server. It did NOT touch the output
// tree: Nitro's `output.dir` hangs off no `buildDir`, so `.output/` stayed
// shared and every test run kept overwriting it. Nitro also ships no env lever
// of its own for this — there is no `NITRO_OUTPUT_DIR` that works out of the box
// (checked against nitropack 2.13.x, whose defaults only carry
// `output.dir: "{{ rootDir }}/.output"`) — so the config has to open one.
describe(`nuxt.config exposes an overridable Nitro ${OUT_DIR} dir`, () => {
  const config = read('nuxt.config.ts');

  it('reads NITRO_OUTPUT_DIR and falls back to the shared dir', () => {
    // `||`, not `??`, exactly as for buildDir: an exported-but-empty value is
    // falsy but not nullish, and Nitro resolves `output.dir` against `rootDir`,
    // so `''` would resolve to the rootDir itself.
    const match = /dir:\s*process\.env\.NITRO_OUTPUT_DIR\s*\|\|\s*'([^']+)'/.exec(config);
    expect(match, `nuxt.config.ts must set nitro.output.dir: process.env.NITRO_OUTPUT_DIR || '${OUT_DIR}'`).toBeTruthy();
    expect(match?.[1]).toBe(OUT_DIR);
  });

  it('leaves publicDir / serverDir to Nitro so they follow output.dir', () => {
    // Nitro defaults them to `{{ output.dir }}/public` and `{{ output.dir }}/server`
    // and resolves `output.dir` first, so both follow a redirect on their own.
    // Pinning either would freeze it on the shared dir while output.dir moves —
    // the bundle would then be written to one tree and served from another,
    // surfacing as a confusing "entry not found" rather than a config error.
    //
    // Scoped to the whole file rather than to the `nitro` block: locating that
    // block means parsing TS with a regex, and a sloppy one would silently stop
    // matching. The trade-off is the opposite error — an unrelated
    // `vite.publicDir` fails here too — which is the safer direction, but only
    // if the message says so, or the next person deletes this instead of
    // narrowing it.
    expect(
      config,
      'nuxt.config.ts must not pin nitro publicDir/serverDir — they derive from output.dir, and pinning one freezes it on .output while output.dir moves. If this fired on an UNRELATED publicDir (e.g. a vite one), narrow this assertion to the nitro block rather than dropping it.',
    ).not.toMatch(/\b(?:publicDir|serverDir):/);
  });
});

describe(`${OUT_TEST_DIR} is ignored and cleaned like ${OUT_DIR} (the \`lt dev test\` stack)`, () => {
  const lines = (rel: string): string[] => read(rel).split('\n');

  it('output dirs and build dirs are five distinct directories', () => {
    // The axes are independent, so a collapse can happen within one (`.output`
    // reused for tests) or across them (`.output-test` colliding with a build
    // dir). Either re-creates the overwrite this separation removes.
    expect(new Set([DEV_DIR, CHECK_DIR, TEST_DIR, OUT_DIR, OUT_TEST_DIR]).size).toBe(5);
  });

  it('is gitignored (the bare `.output` pattern does not cover it)', () => {
    expect(lines('.gitignore').map((l) => l.trim())).toContain(OUT_TEST_DIR);
  });

  it('is excluded from the docker build context', () => {
    // Post-init path on purpose, same as the build dirs: against the bare
    // directory name a root-anchored pattern matches too, so the assertion would
    // accept the very spelling that excludes nothing inside a monorepo.
    expect(
      dockerIgnoreCovers(lines('.dockerignore'), `${APP_REL}/${OUT_TEST_DIR}`),
      `.dockerignore does not actually exclude ${APP_REL}/${OUT_TEST_DIR} — it needs the globstar form`,
    ).toBe(true);
  });

  it(`\`clean\` and \`reinit\` both remove it alongside ${OUT_DIR}`, () => {
    // BOTH output dirs, for BOTH scripts, as one pair. `reinit` delegates to
    // `nuxt cleanup`, which resolves `buildDir` from the config and so only ever
    // removes a BUILD dir — it never touches an output tree, whichever one. Both
    // therefore have to be spelled out, and asserting them together is what keeps
    // the pair from drifting: a `reinit` that wipes `.output-test` but keeps
    // `.output` reads as an oversight in either direction.
    for (const script of ['clean', 'reinit']) {
      const targets = (scripts[script] ?? '').split(/\s+/);
      expect(targets, `\`${script}\` must also remove ${OUT_TEST_DIR}`).toContain(OUT_TEST_DIR);
      expect(targets, `\`${script}\` must also remove ${OUT_DIR}`).toContain(OUT_DIR);
    }
  });

  it('no script in this repo pins the test output dir — the `cli` owns that', () => {
    // Same division of labour as NUXT_BUILD_DIR=.nuxt-test. A script pinning it
    // here would drift from what `lt dev test` actually exports, and which tree
    // the suite built into would depend on which side won.
    const pinned = Object.entries(scripts).filter(([, body]) => body.includes(`NITRO_OUTPUT_DIR=${OUT_TEST_DIR}`));
    expect(pinned.map(([name]) => name)).toEqual([]);
  });

  it(`\`build\` and \`build:check\` stay on ${OUT_DIR} (deliberate scope boundary)`, () => {
    // The image build runs in its own container and gains nothing from a second
    // output tree; `build:check` sharing `.output` with `build` is a separate
    // question this separation does not decide. Pin the boundary so a later
    // "isolate everything" sweep has to state its intent.
    for (const script of ['build', 'build:check']) {
      expect(scripts[script], `\`${script}\` must exist — a deleted script would pass this vacuously`).toBeTruthy();
      expect(scripts[script]).not.toMatch(/NITRO_OUTPUT_DIR=/);
    }
  });
});

describe('helpers', () => {
  it('stripJsonComments drops comments and trailing commas, keeps string content', () => {
    expect(JSON.parse(stripJsonComments('{\n  // lead\n  "a": "http://x//y", /* mid */\n  "b": [1, ],\n}'))).toEqual({ a: 'http://x//y', b: [1] });
    expect(JSON.parse(stripJsonComments('{"a": "x\\"// y"}'))).toEqual({ a: 'x"// y' });
    expect(JSON.parse(stripJsonComments('{"a": "x, "}'))).toEqual({ a: 'x, ' });
  });

  it('resolveSteps follows indirections and flags the ones it cannot', () => {
    const table = { a: 'pnpm run b && echo done', b: 'cross-env NUXT_BUILD_DIR=.nuxt-check nuxt prepare', loop: 'pnpm run loop' };
    expect(resolveSteps('pnpm run a', table)).toEqual(['cross-env NUXT_BUILD_DIR=.nuxt-check nuxt prepare', 'echo done']);
    expect(resolveSteps('bash scripts/check-server-start.sh', table)).toEqual(['bash scripts/check-server-start.sh']);
    expect(resolveSteps('pnpm run loop', table)).toEqual(['pnpm run loop']);
  });

  it.each([
    // Every shape that still delegates to a script. Each was previously invisible
    // to `unresolved`, so a chain containing one passed every assertion vacuously.
    ['trailing flag', 'pnpm run typecheck:tests --silent'],
    ['short flag before run', 'pnpm -s run build:check'],
    ['long flag before run', 'pnpm --silent run build:check'],
    ['recursive', 'pnpm -r run check'],
    ['recursive with parallel', 'pnpm -r --parallel run check'],
    ['filter', 'pnpm --filter app run check'],
    ['filter short form', 'pnpm -F app run check'],
    ['npm', 'npm run build:check'],
    ['yarn', 'yarn run build:check'],
    ['bun', 'bun run build:check'],
  ])('unresolved flags `%s`', (_label, step) => {
    expect(unresolved(step)).toBe(true);
  });

  it.each([
    // Real commands, not indirections — flagging these would make the guard cry
    // wolf on every chain.
    ['install', 'pnpm install --frozen-lockfile'],
    ['short install', 'pnpm i'],
    ['audit', 'pnpm audit --fix'],
    ['audit behind a flag', 'pnpm --silent audit'],
    ['add', 'pnpm add cross-env'],
    ['dlx', 'pnpm dlx some-tool'],
    ['plain binary', 'bash scripts/check-server-start.sh'],
    ['nuxt build', 'cross-env NUXT_BUILD_DIR=.nuxt-check nuxt build'],
  ])('unresolved leaves `%s` alone', (_label, step) => {
    expect(unresolved(step)).toBe(false);
  });

  it('dockerIgnoreCovers rejects the bare pattern and accepts the globstar form', () => {
    expect(dockerIgnoreCovers([CHECK_DIR], CHECK_DIR)).toBe(true); // root-level target
    expect(dockerIgnoreCovers([CHECK_DIR], `projects/app/${CHECK_DIR}`)).toBe(false); // anchored, misses nested
    expect(dockerIgnoreCovers([`**/${CHECK_DIR}`], `projects/app/${CHECK_DIR}`)).toBe(true);
    expect(dockerIgnoreCovers([`**/${CHECK_DIR}/`], CHECK_DIR)).toBe(true);
    expect(dockerIgnoreCovers(['', `# **/${CHECK_DIR}`], CHECK_DIR)).toBe(false);
    expect(dockerIgnoreCovers([`**/${DEV_DIR}`], CHECK_DIR)).toBe(false);
  });

  it('dockerIgnoreCovers honours `!` re-includes, last match winning', () => {
    // Docker applies patterns in order and the last match decides. Without this,
    // appending `!projects/app/.nuxt-check` to the real .dockerignore left the whole
    // suite green while the directory would in fact ship into the build context.
    const target = `projects/app/${CHECK_DIR}`;
    expect(dockerIgnoreCovers([`**/${CHECK_DIR}`, `!${target}`], target)).toBe(false);
    expect(dockerIgnoreCovers([`**/${CHECK_DIR}`, `!**/${CHECK_DIR}`], target)).toBe(false);
    // …and a re-include followed by another exclusion swings it back.
    expect(dockerIgnoreCovers([`**/${CHECK_DIR}`, `!${target}`, `**/${CHECK_DIR}`], target)).toBe(true);
    // A negation for a DIFFERENT path must not cancel the exclusion.
    expect(dockerIgnoreCovers([`**/${CHECK_DIR}`, `!projects/api/${CHECK_DIR}`], target)).toBe(true);
  });

  it('dockerIgnoreCovers understands a single trailing-* glob', () => {
    // This is what makes the `.nuxt-*` / `.output-*` catch-all entries assertable.
    expect(dockerIgnoreCovers(['**/.nuxt-*'], `projects/app/${CHECK_DIR}`)).toBe(true);
    expect(dockerIgnoreCovers(['**/.nuxt-*'], 'projects/app/.nuxt-anything')).toBe(true);
    // Must NOT over-match: `.nuxt` itself has no dash, `.outputs` is a different dir.
    expect(dockerIgnoreCovers(['**/.nuxt-*'], `projects/app/${DEV_DIR}`)).toBe(false);
    expect(dockerIgnoreCovers(['**/.output-*'], 'projects/app/.outputs')).toBe(false);
  });
});
