// @vitest-environment node
/**
 * The generated API client is not linted as project code.
 *
 * `pnpm run generate-types` writes `app/api-client/` from the API's OpenAPI document (openapi-ts.config.ts).
 * What the generator emits is its business: a finding there can only be fixed in the generator, and a hand
 * fix is gone after the next run. With @hey-api/openapi-ts 0.97 and `@hey-api/transformers` a project got
 * about 170 warnings and one `typescript/no-floating-promises` error from `lint` in generated files, so the
 * pre-commit hook and the CI lint job failed on code nobody in the project wrote (found in a project
 * comparing its config with this template, 2026-11-10). `.oxlintrc.json` therefore ignores `app/api-client/**`.
 * Type checking and formatting still cover it: `typecheck` reads the generated types the app imports, and the
 * generator's own `postProcess` runs oxfmt on the output.
 *
 * Checked by running oxlint, both ways a project runs it: over `app/` (`lint`, CI) and on single staged
 * files (`lint-staged` passes each path explicitly). This repository commits no generated client, so its own
 * lint would never show the difference.
 *
 * Ignoring the folder has two callers to keep in step, because oxlint exits 1 ("No files found to lint")
 * when every path it is given is ignored:
 * - the generator's `postProcess` must not run oxlint on its output any more, or every `generate-types` run
 *   fails and the oxfmt step after it never formats the client;
 * - the lint-staged command for `app/` needs `--no-error-on-unmatched-pattern`, or a commit that stages only
 *   a regenerated client is refused.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');

/** Findings of rules every project file is linted with: `eqeqeq` and `unicorn(no-useless-spread)`. */
const PROBE = 'export const same = (a: unknown, b: unknown): boolean => a == b;\nexport const copy = [...[1, 2]];\n';
const FILES = ['app/api-client/sdk.gen.ts', 'app/api-client/client/utils.gen.ts', 'app/utils/project.ts'];

/** Runs oxlint with this project's `.oxlintrc.json` on the probes: the files it reported, sorted, and its exit code. */
function lintRun(args: string[]): { reported: string[]; status: null | number } {
  const dir = mkdtempSync(join(tmpdir(), 'oxlint-api-client-'));
  try {
    copyFileSync(join(ROOT, '.oxlintrc.json'), join(dir, '.oxlintrc.json'));
    for (const file of FILES) {
      mkdirSync(join(dir, dirname(file)), { recursive: true });
      writeFileSync(join(dir, file), PROBE);
    }
    const oxlint = join(dirname(createRequire(import.meta.url).resolve('oxlint/package.json')), 'bin', 'oxlint');
    // TERMINAL_EMULATOR left out: in a JetBrains terminal oxlint prints `file:///` URLs instead of paths.
    const env = { ...process.env, TERMINAL_EMULATOR: undefined };
    const run = spawnSync(process.execPath, [oxlint, '-f', 'unix', ...args], { cwd: dir, encoding: 'utf8', env, timeout: 20_000 });
    expect(run.error).toBeUndefined();
    const reported = run.stdout
      .split('\n')
      .map((line) => /(app[/\\][\w./\\-]+?):\d+:\d+: /.exec(line)?.[1]?.replaceAll('\\', '/'))
      .filter((file): file is string => file !== undefined);
    return { reported: [...new Set(reported)].sort(), status: run.status };
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
}

const lint = (args: string[]): string[] => lintRun(args).reported;

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { 'lint-staged': Record<string, string[]> };

/** The oxlint arguments lint-staged runs for staged app files, without the type-aware pass (it needs a tsconfig). */
function lintStagedArgs(): string[] {
  const command = pkg['lint-staged']['app/**/*.{ts,vue}']?.find((step) => step.startsWith('oxlint'));
  expect(command, 'lint-staged runs oxlint on app/**/*.{ts,vue}').toBeDefined();
  return (command ?? '')
    .split(/\s+/)
    .slice(1)
    .filter((arg) => arg !== '--type-aware');
}

/** `defineConfig` returns a promise; the config refuses to load without `NUXT_API_URL` (DEV-2802), any URL will do. */
async function openApiOutput(): Promise<{ path?: string; postProcess?: unknown[] }> {
  process.env.NUXT_API_URL ||= 'http://127.0.0.1:1';
  const config = (await (await import('../../openapi-ts.config')).default) as { output: { path?: string; postProcess?: unknown[] } };
  return config.output;
}

describe('oxlint vs. the generated API client', () => {
  it('lints app/ without app/api-client/ (lint, CI)', () => {
    expect(lint(['app/'])).toEqual(['app/utils/project.ts']);
  });

  it('skips a generated file passed by name (lint-staged), and still lints project files passed the same way', () => {
    expect(lint(FILES)).toEqual(['app/utils/project.ts']);
  });

  it('lets a commit through that stages only the regenerated client (lint-staged command, exit 0)', () => {
    const run = lintRun([...lintStagedArgs(), 'app/api-client/sdk.gen.ts', 'app/api-client/client/utils.gen.ts']);
    expect(run.reported).toEqual([]);
    expect(run.status, 'oxlint exits 1 when every staged path is ignored: lint-staged needs --no-error-on-unmatched-pattern').toBe(0);
  });

  it('writes the client where oxlint ignores it, and does not run oxlint on it after generating', async () => {
    const output = await openApiOutput();
    expect(output.path).toBe('./app/api-client');
    // oxlint on an output path it ignores exits 1, which fails every generate-types run before oxfmt formats it.
    expect(output.postProcess).toEqual(['oxfmt']);
  });
});
