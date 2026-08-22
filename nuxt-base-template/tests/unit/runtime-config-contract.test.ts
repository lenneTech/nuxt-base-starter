/**
 * Every documented `NUXT_PUBLIC_<X>` must have a matching key in `runtimeConfig.public`.
 *
 * This is the guard that was missing when the password-reset lockout happened.
 * `NUXT_PUBLIC_SITE_URL` was documented in `.env.example`, set in every deployment,
 * and asserted by `lt-dev-env.test.ts` — but `runtimeConfig.public` never declared a
 * `siteUrl` key. Nitro applies `NUXT_PUBLIC_*` ONLY over keys that already exist, so
 * the variable was read by nothing, `config.public.siteUrl` stayed `undefined`, and a
 * template literal turned that into the text `"undefined/auth/reset-password"`. Better
 * Auth answered 403, no reset mail was ever sent, and the env test stayed green
 * throughout — it only ever checked that the variable was *documented*.
 *
 * So this asserts the EFFECT (the variable reaches the app) rather than the spelling
 * (the variable is written down somewhere). It catches the whole class: any future
 * public env var documented without a home fails here instead of in production.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const templateRoot = join(__dirname, '..', '..');
const envFile = join(templateRoot, '.env.example');
const configFile = join(templateRoot, 'nuxt.config.ts');

/**
 * Public env vars that are deliberately NOT declared in this file's `runtimeConfig`.
 * Each entry needs a reason — an unexplained exception here would re-open the hole
 * this test exists to close.
 */
const MODULE_OWNED: Record<string, string> = {
  // Declared by @lenne.tech/nuxt-extensions, which registers its own
  // `runtimeConfig.public.ltExtensions` block. Nothing for this file to declare.
  NUXT_PUBLIC_STORAGE_PREFIX: '@lenne.tech/nuxt-extensions owns this key',
};

/** `NUXT_PUBLIC_SITE_URL` -> `siteUrl` */
function envNameToConfigKey(envName: string): string {
  return envName
    .replace(/^NUXT_PUBLIC_/, '')
    .toLowerCase()
    .replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Top-level keys of the `public: { … }` object inside `runtimeConfig`.
 *
 * Read as text rather than by importing the config: importing it would execute the
 * whole Nuxt config (modules, env reads) for a question that is purely structural.
 * Brace-counting keeps nested objects (`ltExtensions: { … }`) from contributing their
 * inner keys, which a flat regex would wrongly collect.
 */
function readPublicRuntimeConfigKeys(source: string): string[] {
  const anchor = source.indexOf('public: {');
  if (anchor === -1) {
    return [];
  }

  let depth = 0;
  let end = anchor;
  for (let i = source.indexOf('{', anchor); i < source.length; i++) {
    const char = source[i];
    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  const body = source.slice(anchor, end);
  const keys: string[] = [];
  let level = 0;
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (line.startsWith('//')) {
      continue;
    }
    // Only lines at the immediate level of `public` describe its own keys.
    if (level === 1) {
      // `siteUrl: ''` (explicit) or `appCommit,` (shorthand for a const above).
      const match = /^([a-zA-Z_$][\w$]*)\s*[,:]/.exec(line);
      if (match?.[1]) {
        keys.push(match[1]);
      }
    }
    level += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
  }

  return keys;
}

describe('runtimeConfig.public ↔ .env.example contract', () => {
  it('both files exist', () => {
    expect(existsSync(envFile)).toBe(true);
    expect(existsSync(configFile)).toBe(true);
  });

  const envContent = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';
  const configContent = existsSync(configFile) ? readFileSync(configFile, 'utf8') : '';

  const documentedVars = [...new Set(envContent.match(/^NUXT_PUBLIC_[A-Z0-9_]+/gm) ?? [])].sort();
  const declaredKeys = readPublicRuntimeConfigKeys(configContent);

  it('finds the documented public env vars', () => {
    // A regression in the parsing itself would otherwise make this suite vacuously green.
    expect(documentedVars.length).toBeGreaterThan(0);
  });

  it('finds the declared runtimeConfig.public keys', () => {
    expect(declaredKeys.length).toBeGreaterThan(0);
    // Pin one known key so a broken parser cannot pass by returning noise.
    expect(declaredKeys).toContain('apiUrl');
  });

  it.each(documentedVars)('%s reaches runtimeConfig.public', (envName) => {
    if (envName in MODULE_OWNED) {
      expect(MODULE_OWNED[envName]).toBeTruthy();
      return;
    }

    const expectedKey = envNameToConfigKey(envName);
    expect(
      declaredKeys,
      `${envName} is documented in .env.example but runtimeConfig.public has no "${expectedKey}" key. ` +
        `Nitro only applies NUXT_PUBLIC_* over keys that already exist, so the variable would be ` +
        `silently ignored at runtime. Declare it in nuxt.config.ts (an empty-string default is fine), ` +
        `or add it to MODULE_OWNED in this test with the module that owns it.`,
    ).toContain(expectedKey);
  });

  it('declares siteUrl — the key whose absence caused the reset-link lockout', () => {
    expect(declaredKeys).toContain('siteUrl');
  });
});
