// @vitest-environment node
/**
 * Type-aware lint must not fail on a vendored nuxt-extensions core.
 *
 * `lint` runs `oxlint --type-aware` with `typescript/no-floating-promises: error`. In vendor mode,
 * the default of `lt fullstack init`, `app/core/` holds @lenne.tech/nuxt-extensions copied from its
 * repository, and the core of nuxt-extensions 1.19.1 and older has eight un-awaited promises. Without
 * the `app/core/**` override, `lint` exited 1 in every freshly generated vendor-mode project: the
 * pre-commit hook blocked every commit and the CI lint job, which the test and deploy stages depend
 * on, went red. This repository's own CI runs in npm mode and never has an `app/core/`, so nothing
 * here would have noticed (measured 2026-10-26 against nuxt-extensions c57a008).
 *
 * The same holds for the plugins. Up to 1.24.0 nuxt-extensions linted its source with `typescript`
 * only, while the project adds `vue`, `unicorn` and `import`. Applied to the core, they reported three
 * `unicorn(no-useless-spread)` warnings in `sync-hints.ts` of every vendor-mode project, which
 * nuxt-extensions' own lint never saw (smoke test, nuxt-extensions 1.24.0, 2026-11-05). Since 1.24.1
 * it lints with all four. The core still gets `typescript` alone, a subset of those, never more, so a
 * core vendored before 1.24.1 stays clean as well.
 *
 * The rules are read as text, like the other contract tests. The plugins are checked by running
 * oxlint, because a config that reads right can still do nothing: `plugins` in an override only adds,
 * and `import` there does not run at all (both measured with oxlint 1.90.0).
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');

/** One finding per plugin: a spread copy (`unicorn`), an arrow function in `watch` (`vue`), a missing default export (`import`). */
const PROBES: Record<string, string> = {
  'default.ts': "import value from './value';\nexport const copy = value;\n",
  'spread.ts': 'export const copy = [...[1, 2]];\n',
  'value.ts': 'export const value = 1;\n',
  'watch.vue': '<script>\nexport default { watch: { a: () => {} } };\n</script>\n',
};

/**
 * Lints the probes in `app/core/` and in project code with this project's `.oxlintrc.json`, as `folder plugin(rule)`.
 *
 * `terminal` is passed on as `TERMINAL_EMULATOR`. In a JetBrains terminal oxlint prints `file:///<absolute path>`
 * instead of the relative path, so the folder is taken from the end of the path, whatever comes before it.
 */
function lintProbes(terminal?: string): string[] {
  const dir = mkdtempSync(join(tmpdir(), 'oxlint-core-'));
  try {
    copyFileSync(join(ROOT, '.oxlintrc.json'), join(dir, '.oxlintrc.json'));
    for (const folder of ['app/core', 'app/utils']) {
      mkdirSync(join(dir, folder), { recursive: true });
      for (const [file, source] of Object.entries(PROBES)) {
        writeFileSync(join(dir, folder, file), source);
      }
    }
    const oxlint = join(dirname(createRequire(import.meta.url).resolve('oxlint/package.json')), 'bin', 'oxlint');
    const env = { ...process.env, TERMINAL_EMULATOR: terminal };
    const run = spawnSync(process.execPath, [oxlint, '-f', 'unix', 'app/'], { cwd: dir, encoding: 'utf8', env, timeout: 20_000 });
    expect(run.error).toBeUndefined();
    return run.stdout
      .split('\n')
      .map((line) => /(app[/\\]\w+)[/\\][\w.-]+:\d+:\d+: .*\[\w+\/(\S+)\]$/.exec(line))
      .filter((match) => match !== null)
      .map(([, folder, rule]) => `${folder.replace('\\', '/')} ${rule}`)
      .sort();
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
}

interface OxlintConfig {
  overrides?: { files: string[]; rules?: Record<string, unknown> }[];
  rules?: Record<string, unknown>;
}

// .oxlintrc.json is JSONC: drop whole-line comments before parsing.
const config = JSON.parse(readFileSync(join(ROOT, '.oxlintrc.json'), 'utf8').replace(/^\s*\/\/.*$/gm, '')) as OxlintConfig;
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> };

describe('oxlint vs. a vendored core', () => {
  it('lints the project type-aware with no-floating-promises as an error', () => {
    expect(pkg.scripts.lint).toContain('--type-aware');
    expect(config.rules?.['typescript/no-floating-promises']).toBe('error');
  });

  it('switches the type-aware rules off for app/core/**', () => {
    const core = config.overrides?.find((o) => o.files.includes('app/core/**'));
    expect(core, '.oxlintrc.json needs an override for app/core/**').toBeDefined();
    for (const rule of ['typescript/no-floating-promises', 'typescript/no-base-to-string', 'typescript/unbound-method']) {
      expect(core?.rules?.[rule], `${rule} must be "off" for the vendored core`).toBe('off');
    }
  });

  // `undefined` is any other terminal, CI included: Node leaves an undefined variable out of the child's environment.
  it.each([undefined, 'JetBrains-JediTerm'])('lints app/core/** with `typescript` alone, and project code with all four plugins (TERMINAL_EMULATOR=%s)', (terminal) => {
    expect(lintProbes(terminal)).toEqual(['app/utils import(default)', 'app/utils unicorn(no-useless-spread)', 'app/utils vue(no-arrow-functions-in-watch)']);
  });
});
