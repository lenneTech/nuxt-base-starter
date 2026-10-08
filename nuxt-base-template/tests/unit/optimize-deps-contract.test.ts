/**
 * Every package the client code imports must be pre-bundled when the dev server starts.
 *
 * A cold `nuxt dev` (every CI run, and locally after each lockfile change) finds a dependency
 * that only a lazily loaded page imports at the moment that page is first opened. Vite then
 * re-bundles, and when that changes chunks the browser already holds it reloads the WHOLE page:
 * in-flight requests for the old chunk URLs fail ("Failed to fetch dynamically imported module")
 * and everything the page held is gone — typed text, a running save, the scroll position. Nuxt
 * hides Vite's "optimized dependencies changed. reloading", so the only trace in the dev log is
 * `dependency optimized: <name>`.
 *
 * In an E2E run that reload lands inside whichever step happens to be running, and a retry
 * passes because the second run finds the dependencies already bundled. Observed downstream
 * (lt-crm, DEV-2899): an annotation lost between the click on "save" and the request, which the
 * failure snapshot made look like a lost `fill()`.
 *
 * `vite.optimizeDeps.include` in `nuxt.config.ts` bundles them up front. This test keeps that
 * list complete: a new import without an entry fails here, at the commit, instead of surfacing
 * weeks later as a flake in a spec that has nothing to do with it. It also covers a project
 * converted to vendor mode, where the nuxt-extensions runtime (`better-auth/vue`, …) moves into
 * `app/core/` and its imports become the project's own.
 *
 * What it cannot see: imports inside a Nuxt module's runtime in `node_modules`. Those are found
 * the way the comment in `nuxt.config.ts` describes.
 *
 * Read as text, like the other contract tests: the question is structural.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const APP_DIR = join(ROOT, 'app');

/**
 * The installed nuxt-extensions runtime. Vendor mode copies its source to `app/core/runtime/`,
 * where the scan of `app/` starts to see its imports — so they have to be covered before a
 * project is converted, not after its first `check` turns red.
 */
const EXTENSIONS_RUNTIME = join(ROOT, 'node_modules', '@lenne.tech', 'nuxt-extensions', 'dist', 'runtime');

/** Imports this project certainly has — proof that the scanner finds anything at all. */
const KNOWN_IMPORTS: string[] = ['valibot'];

/** Files under `app/` that run in Node, never in the browser (vendor mode only). */
const NODE_ONLY_FILES: RegExp[] = [
  // The vendored nuxt-extensions module definition — executed by Nuxt at build time.
  /^core\/module\.ts$/,
  // Playwright helpers shipped with the vendored core — executed by the test runner.
  /^core\/runtime\/testing\//,
];

/** `relative()` separates with `\` on Windows, while the patterns above are written with `/`. */
function isNodeOnly(appPath: string): boolean {
  const posixPath = appPath.replace(/\\/g, '/');
  return NODE_ONLY_FILES.some((pattern) => pattern.test(posixPath));
}

/**
 * Packages a Nuxt module keeps OUT of pre-bundling on purpose. Listing them in `include` would
 * fight the module, so they are covered here instead. Each pattern is exactly as wide as the
 * module's own list — a wider one would wave through a package nobody excludes, which then
 * re-bundles on first visit.
 */
const MODULE_MANAGED: { pattern: RegExp; reason: string }[] = [
  {
    pattern:
      /^(vue|vue-router|vue-demi|nuxt|nuxt\/app|consola|defu|devalue|get-port-please|h3|hookable|klona|ofetch|pathe|ufo|unctx|unenv|@unhead\/vue|@vue\/(runtime-core|runtime-dom|reactivity|shared|devtools-api))(\/|$)/,
    reason: 'Nuxt excludes these from pre-bundling itself (@nuxt/vite-builder client environment)',
  },
  { pattern: /^@nuxt\/ui(\/|$)/, reason: 'Nuxt UI opts out — its runtime needs `#imports`' },
  {
    pattern: /^@vueuse\/(core|shared|components|motion|firebase|rxjs|sound|math|router)(\/|$)/,
    reason: '@vueuse/nuxt excludes and transpiles these — NOT @vueuse/integrations',
  },
  {
    pattern: /^tus-js-client(\/|$)/,
    reason: 'nuxt-extensions puts it into `build.transpile`, which Nuxt turns into an exclude (vendor mode too)',
  },
];

function isModuleManaged(specifier: string): boolean {
  return MODULE_MANAGED.some(({ pattern }) => pattern.test(specifier));
}

// `import x from 'pkg'`, `import { a } from 'pkg'`, `import 'pkg'` — group 1 is set for
// `import type`, which TypeScript erases. `[^;'"]` keeps one statement from reaching into the
// next one's `from`.
const STATIC_IMPORT = /^\s*import\s+(type\s+)?(?:[^;'"]*?\s+from\s+)?['"]([^'"]+)['"]/gm;
const EXPORT_FROM = /^\s*export\s+(type\s+)?[^;'"]*?\s+from\s+['"]([^'"]+)['"]/gm;
const DYNAMIC_IMPORT = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

function sourceFiles(dir: string, extensions = /\.(ts|vue)$/): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path, extensions);
    return extensions.test(entry.name) && !entry.name.endsWith('.d.ts') ? [path] : [];
  });
}

/** A specifier that names an npm package, not a file, an alias or a builtin. */
function isPackage(specifier: string): boolean {
  if (/^[./~#]|^virtual:|^node:/.test(specifier)) return false;
  // A stylesheet or asset from a package goes through Vite's CSS/asset pipeline; the dependency
  // optimizer only bundles JavaScript.
  if (/\.(css|scss|sass|less|styl|svg|png|jpe?g|gif|webp|woff2?)$/.test(specifier)) return false;
  return !builtinModules.includes(specifier);
}

function runtimeImports(code: string): string[] {
  const found: string[] = [];
  for (const pattern of [STATIC_IMPORT, EXPORT_FROM]) {
    for (const match of code.matchAll(pattern)) {
      if (!match[1]) found.push(match[2] as string);
    }
  }
  for (const match of code.matchAll(DYNAMIC_IMPORT)) {
    const before = code.slice(Math.max(0, (match.index ?? 0) - 7), match.index);
    const after = code.slice((match.index ?? 0) + match[0].length);
    // `typeof import('x')` and `import('x').Type` are type positions, not loads — but
    // `import('x').then(…)` is the usual way to lazy-load a named export.
    if (!/typeof\s*$/.test(before) && !/^\s*\.(?!\s*(?:then|catch|finally)\b)/.test(after)) found.push(match[1] as string);
  }
  return found.filter(isPackage);
}

/** Every package the client code imports, with the files that import it. */
function clientImports(): Map<string, string[]> {
  const imports = new Map<string, string[]>();
  for (const file of sourceFiles(APP_DIR)) {
    const path = relative(APP_DIR, file);
    if (isNodeOnly(path)) continue;
    for (const specifier of runtimeImports(readFileSync(file, 'utf8'))) {
      imports.set(specifier, [...(imports.get(specifier) ?? []), path]);
    }
  }
  return imports;
}

/** `vite.optimizeDeps.<key>` from `nuxt.config.ts`. */
function optimizeDeps(key: 'exclude' | 'include'): string[] {
  const config = readFileSync(join(ROOT, 'nuxt.config.ts'), 'utf8');
  const start = config.indexOf('optimizeDeps: {');
  expect(start, 'optimizeDeps block not found in nuxt.config.ts').toBeGreaterThan(-1);
  const list = config.slice(start).match(new RegExp(`\\b${key}:\\s*\\[([^\\]]*)\\]`));
  expect(list, `optimizeDeps.${key} not found in nuxt.config.ts`).not.toBeNull();
  return [...(list?.[1] ?? '').matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1] as string);
}

describe('the import scanner', () => {
  // A gap here does not fail anything — it lets an import through and the guard stays green.
  // So the shapes are pinned, in both directions.
  it.each([
    ["import { a } from 'pkg'", ['pkg']],
    ["import x, {\n  a,\n  b,\n} from 'pkg'", ['pkg']],
    ["import { type A, b } from 'pkg'", ['pkg']],
    ["import 'pkg'", ['pkg']],
    ["export { a } from 'pkg'", ['pkg']],
    ["const m = await import('pkg')", ['pkg']],
    ["const C = defineAsyncComponent(() => import('pkg').then((m) => m.default))", ['pkg']],
    ["import('pkg').catch(() => null)", ['pkg']],
    ["import type { A } from 'pkg'", []],
    ["export type { A } from 'pkg'", []],
    ["type Upload = import('pkg').Upload", []],
    ["let m: typeof import('pkg') | null = null", []],
    ["import 'pkg/dist/style.css'", []],
    ["import { a } from '~/utils/a'", []],
    ["import { randomUUID } from 'node:crypto'", []],
  ])('%j → %j', (code, expected) => {
    expect(runtimeImports(code)).toEqual(expected);
  });

  it.each(['vue', 'vue-router', 'ufo', '@nuxt/ui/locale', '@vueuse/core', 'tus-js-client'])('leaves %s to the module that excludes it', (specifier) => {
    expect(isModuleManaged(specifier)).toBe(true);
  });

  it.each(['@vueuse/integrations/useSortable', 'valibot'])('requires an entry for %s', (specifier) => {
    expect(isModuleManaged(specifier)).toBe(false);
  });

  // On Windows `relative()` returns `core\module.ts`. Matched as is, the vendored module
  // definition was scanned as client code and failed the guard with `@nuxt/kit`.
  it.each(['core/module.ts', 'core\\module.ts', 'core/runtime/testing/index.ts', 'core\\runtime\\testing\\index.ts'])('skips the Node-only file %s', (appPath) => {
    expect(isNodeOnly(appPath)).toBe(true);
  });
});

describe('optimizeDeps.include covers the client code', () => {
  it('finds the imports it is meant to guard', () => {
    // Without this a broken pattern would find nothing and pass every check below.
    const imports = clientImports();
    for (const specifier of KNOWN_IMPORTS) {
      expect(imports.has(specifier), specifier).toBe(true);
    }
  });

  it('pre-bundles every package the client code imports', () => {
    const covered = new Set([...optimizeDeps('include'), ...optimizeDeps('exclude')]);
    const missing = [...clientImports()]
      .filter(([specifier]) => !covered.has(specifier) && !isModuleManaged(specifier))
      .map(([specifier, files]) => `${specifier} (imported by ${files.join(', ')})`);

    expect(missing, 'add these to vite.optimizeDeps.include in nuxt.config.ts — see the comment there').toEqual([]);
  });

  // In npm mode the scan above cannot see the nuxt-extensions runtime, which sits in
  // `node_modules`. Vendor mode moves it into `app/core/`, and without this every converted
  // project failed the guard on its first `check` (`better-auth/vue` and two more).
  // Skipped in vendor mode itself: there the package is gone and the scan above covers it.
  it.skipIf(!existsSync(EXTENSIONS_RUNTIME))('pre-bundles what the nuxt-extensions runtime imports (vendor mode)', () => {
    const covered = new Set([...optimizeDeps('include'), ...optimizeDeps('exclude')]);
    const missing = sourceFiles(EXTENSIONS_RUNTIME, /\.(m?js|vue)$/)
      // Placed as vendor mode places it, so NODE_ONLY_FILES applies unchanged.
      .map((file) => ({ appPath: join('core', 'runtime', relative(EXTENSIONS_RUNTIME, file)), file }))
      .filter(({ appPath }) => !isNodeOnly(appPath))
      .flatMap(({ appPath, file }) => runtimeImports(readFileSync(file, 'utf8')).map((specifier) => ({ appPath, specifier })))
      .filter(({ specifier }) => !covered.has(specifier) && !isModuleManaged(specifier))
      .map(({ appPath, specifier }) => `${specifier} (imported by ${appPath})`);

    expect(missing, 'add these to vite.optimizeDeps.include in nuxt.config.ts — see the comment there').toEqual([]);
  });

  it('does not pre-bundle what a module deliberately keeps out', () => {
    const fighting = optimizeDeps('include').filter(isModuleManaged);
    expect(fighting).toEqual([]);
  });
});
