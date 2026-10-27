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
 * Read as text, like the other contract tests.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');

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
});
