// @vitest-environment node
/**
 * Every class of the `LtTransition*` components must be in Tailwind's sources.
 *
 * Tailwind 4 generates only the classes its scanner finds. The build scans the Vite root, which
 * Nuxt sets to `srcDir` (`app/`), plus every `@source` of `app/assets/css/tailwind.css` and of the
 * stylesheets it imports; it skips `node_modules`. The components of `@lenne.tech/nuxt-extensions`
 * style themselves with Tailwind classes, so in npm mode, where they sit in `node_modules`, their
 * slide and scale classes were never generated and the transitions ran without movement. The
 * stylesheet's `@source` line for the package's runtime fixes that. In vendor mode the components
 * sit in `app/core` and are scanned with the app; the `@source` path is missing there, and Tailwind
 * ignores it.
 *
 * This runs the compiler and the scanner `@tailwindcss/vite` imports, on the real stylesheet and the
 * way the plugin does. The expected classes are read from the components, so the test follows every
 * change to them. Nuxt UI's module also adds its generated theme (`.nuxt/ui`), which needs a build
 * dir; the test leaves it out, which can only make it stricter.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');
const SRC_DIR = join(ROOT, 'app');
const STYLESHEET = join(SRC_DIR, 'assets', 'css', 'tailwind.css');

/** Where the components live: vendored into `app/core`, or installed. */
const TRANSITION_DIRS = [
  join(SRC_DIR, 'core', 'runtime', 'components', 'transition'),
  join(ROOT, 'node_modules', '@lenne.tech', 'nuxt-extensions', 'dist', 'runtime', 'components', 'transition'),
];

interface Source {
  base: string;
  negated: boolean;
  pattern: string;
}

interface Compiler {
  root: 'none' | null | { base: string; pattern: string };
  sources: Source[];
}

type Compile = (css: string, options: { base: string; onDependency: (path: string) => void }) => Promise<Compiler>;
type ScannerClass = new (options: { sources: Source[] }) => { scan: () => string[] };

/** The candidates the build would generate CSS for, scanned as `@tailwindcss/vite` scans them. */
async function scanCandidates(): Promise<Set<string>> {
  // The compiler and scanner of the plugin the build runs, not whichever copy happens to resolve.
  const fromVitePlugin = createRequire(createRequire(join(ROOT, 'package.json')).resolve('@tailwindcss/vite'));
  const { compile } = (await import(pathToFileURL(fromVitePlugin.resolve('@tailwindcss/node')).href)) as { compile: Compile };
  const { Scanner } = fromVitePlugin('@tailwindcss/oxide') as { Scanner: ScannerClass };

  const compiler = await compile(readFileSync(STYLESHEET, 'utf8'), { base: dirname(STYLESHEET), onDependency: () => {} });
  // As the plugin: without `source(…)` on the Tailwind import, the Vite root is scanned.
  const root = compiler.root === 'none' ? [] : compiler.root === null ? [{ base: SRC_DIR, negated: false, pattern: '**/*' }] : [{ ...compiler.root, negated: false }];
  return new Set(new Scanner({ sources: [...root, ...compiler.sources] }).scan());
}

/** Every static class of the transition components: `class="…"` and `enter-active-class="…"` alike. */
function transitionClasses(): { classes: string[]; files: string[] } {
  const dir = TRANSITION_DIRS.find((candidate) => existsSync(candidate));
  if (!dir) {
    throw new Error(`No LtTransition components found, looked in:\n${TRANSITION_DIRS.join('\n')}`);
  }
  const files = readdirSync(dir).filter((name) => name.endsWith('.vue'));
  const classes = new Set<string>();
  for (const file of files) {
    for (const match of readFileSync(join(dir, file), 'utf8').matchAll(/(?<![\w:-])(?:[a-z]+-)*class="([^"]*)"/g)) {
      for (const name of (match[1] ?? '').split(/\s+/).filter(Boolean)) {
        classes.add(name);
      }
    }
  }
  return { classes: [...classes].sort(), files };
}

describe('Tailwind sources', () => {
  it('scan every class of the LtTransition components', async () => {
    const { classes, files } = transitionClasses();
    expect(files.length).toBeGreaterThan(0);
    expect(classes.length).toBeGreaterThan(0);

    const candidates = await scanCandidates();
    // Without the `@source` line in npm mode: translate-x-full, translate-y-full, scale-95, …
    expect(classes.filter((name) => !candidates.has(name))).toEqual([]);
  });
});
