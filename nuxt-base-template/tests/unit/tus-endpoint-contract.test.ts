/**
 * The TUS upload endpoint has to name the API's TUS route, and the installed nuxt-extensions has to
 * resolve it against the API.
 *
 * The template shipped `ltExtensions.tus.defaultEndpoint: '/files/upload'`. Up to nuxt-extensions
 * 1.18.x a relative endpoint went to the APP origin, where nothing serves TUS, so every upload
 * through `TusFileUpload` answered 404 (DEV-3595). Since 1.19.0 a relative endpoint resolves
 * against the API (`buildLtApiUrl`: `/api/tus` behind the dev proxy, `NUXT_PUBLIC_API_URL` + `/tus`
 * otherwise) — and `'/files/upload'` would now reach nest-server's MULTIPART route instead. Neither
 * value fails a build or a type check; the only symptom is an upload that never arrives.
 *
 * nest-server serves TUS at `/tus` unless the API's `tus.path` says otherwise. A project that
 * changes that path changes this expectation with it.
 *
 * Read as text, like the other config contracts.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const templateRoot = join(import.meta.dirname, '..', '..');
const configSource = readFileSync(join(templateRoot, 'nuxt.config.ts'), 'utf8');
const pkg = JSON.parse(readFileSync(join(templateRoot, 'package.json'), 'utf8'));
const vendorFile = join(templateRoot, 'app', 'core', 'VENDOR.md');

/** The `defaultEndpoint` inside the `tus: { … }` block of `ltExtensions`. */
function tusDefaultEndpoint(): string | undefined {
  const block = configSource.match(/\btus:\s*\{([^}]*)\}/);
  return block?.[1]?.match(/defaultEndpoint:\s*['"]([^'"]+)['"]/)?.[1];
}

/** `1.19.0` → `[1, 19, 0]`; tolerates a range prefix such as `^`. */
function versionParts(range: string): number[] {
  return (range.match(/(\d+)\.(\d+)\.(\d+)/)?.slice(1) ?? []).map(Number);
}

/** The `- **Baseline-Version:** x.y.z` line the lt CLI writes into `app/core/VENDOR.md`. */
function vendorBaseline(vendorMd: string): string | undefined {
  return vendorMd.match(/Baseline-Version[^0-9]*(\d+\.\d+\.\d+)/)?.[1];
}

/**
 * The nuxt-extensions version the app actually RUNS. In vendor mode that is the vendored core, never
 * the npm entry: a project that ran `pnpm add` there installs a package nothing loads, and reading
 * package.json would let this guard pass while the 1.18.x core still sends uploads to the app.
 */
function runningExtensionsVersion(): string | undefined {
  if (existsSync(vendorFile)) {
    return vendorBaseline(readFileSync(vendorFile, 'utf8'));
  }
  return pkg.dependencies?.['@lenne.tech/nuxt-extensions'];
}

describe('TUS upload endpoint', () => {
  it("names nest-server's TUS route", () => {
    expect(tusDefaultEndpoint()).toBe('/tus');
  });

  it('is relative, so it follows the API URL of whichever environment the app runs in', () => {
    expect(tusDefaultEndpoint()).toMatch(/^\/(?!\/)/);
  });

  it('runs on a nuxt-extensions that resolves relative endpoints against the API (>= 1.19.0)', () => {
    const version = runningExtensionsVersion();
    const [major = 0, minor = 0] = versionParts(version ?? '');

    expect(version, 'no nuxt-extensions version found (package.json or app/core/VENDOR.md Baseline-Version)').toBeDefined();
    expect(major > 1 || (major === 1 && minor >= 19), `nuxt-extensions ${version}: before 1.19.0 a relative endpoint goes to the app origin`).toBe(true);
  });

  it('reads the vendored baseline from the line the lt CLI writes', () => {
    expect(vendorBaseline('- **Baseline-Version:** 1.19.0')).toBe('1.19.0');
    expect(vendorBaseline('- **Baseline-Version:** (not detected)')).toBeUndefined();
  });
});
