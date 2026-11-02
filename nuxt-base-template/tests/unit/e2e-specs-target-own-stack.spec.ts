import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// An E2E spec must test THIS project's stack — nest-base on Postgres — and nothing else.
//
// This branch once shipped two auth specs copied from the `main` template, whose backend
// is @lenne.tech/nest-server on MongoDB. Every project generated from it inherited both
// failure modes, and both were silent:
//
// - They hardcoded `http://localhost:3000` / `:3001`. `lt dev` gives each project its own
//   ports, so on a machine running several lt projects :3000 belongs to a FOREIGN API.
//   The availability probe and the direct API calls (`resetTestData`, …) went there while
//   the browser tested the right app — a run green without checking the right thing.
// - They reset the database through MongoDB (`mongodb://127.0.0.1/nest-server-local`) and
//   read `GET /api/auth/features`. nest-base has neither, so they could never pass, and
//   generated projects stilled them — which read like auth coverage that did not exist.
//
// These checks keep that class out when a merge from `main` or a copy brings such a spec back.

// `happy-dom` replaces the global URL with a browser implementation that cannot resolve a
// file: base, so the paths are resolved through node:path instead.
const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const E2E_DIR = join(APP_ROOT, 'tests/e2e');

const read = (absolutePath: string): string => readFileSync(absolutePath, 'utf8');

const e2eSpecs = (): Array<{ name: string; source: string }> =>
  readdirSync(E2E_DIR)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => ({ name, source: read(join(E2E_DIR, name)) }));

describe('E2E specs target this project, not a framework default', () => {
  it('reach the API and the app through the environment, with localhost only as a fallback', () => {
    // The accepted form: `process.env.NUXT_PUBLIC_API_URL || 'http://localhost:3000'`.
    // `lt dev test` and CI set these variables, so the fallback only applies to a bare
    // local run, where the default ports are right. A line naming a default port without
    // reading the environment is a hardcoded target — also in a comment or log line,
    // because that is where a copied instruction like "curl http://localhost:3000" sends
    // the reader.
    const offenders = e2eSpecs().flatMap(({ name, source }) =>
      source
        .split(/\r?\n/)
        .map((line, index) => ({ line, location: `tests/e2e/${name}:${index + 1}` }))
        .filter(({ line }) => /localhost:300[01]\b/.test(line) && !line.includes('process.env.'))
        .map(({ line, location }) => `${location}  ${line.trim()}`),
    );

    expect(offenders, `E2E specs hardcode a default port instead of reading NUXT_PUBLIC_API_URL / NUXT_PUBLIC_SITE_URL:\n${offenders.join('\n')}`).toEqual([]);
  });
});

describe('E2E specs target nest-base on Postgres, not nest-server on MongoDB', () => {
  it('never talk to MongoDB', () => {
    const offenders = e2eSpecs()
      .filter(({ source }) => /from ['"]mongodb['"]|mongodb:\/\//.test(source))
      .map(({ name }) => `tests/e2e/${name}`);

    expect(offenders, `These specs talk to MongoDB, which a nest-base project does not run:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('do not keep a MongoDB driver installed for them', () => {
    // A leftover driver is the invitation to write the next spec against a database the
    // project lacks.
    const pkg = JSON.parse(read(join(APP_ROOT, 'package.json'))) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect({ ...pkg.dependencies, ...pkg.devDependencies }).not.toHaveProperty('mongodb');
  });
});
