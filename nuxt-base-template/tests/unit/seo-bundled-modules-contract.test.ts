/**
 * `@nuxtjs/seo` 6 bundles nuxt-ai-ready and nuxt-skew-protection and switches both ON unless the
 * project says otherwise. Upstream gives no reason beyond "installed by default" (harlan-zw/nuxt-seo#643),
 * and in the apps this template produces both cost more than they deliver (measured 2026-10-24):
 *
 * - Skew Protection keeps old build assets only if its storage survives between builds. Every
 *   deploy here builds a fresh Docker image, so it never restores a chunk, and what is left (hourly
 *   manifest polling, reload on a chunk error, the crawler guard) is Nuxt core already. It still
 *   registers a service worker at scope `/` for every visitor, which stays in their browsers after
 *   the module is switched off, and whose `recoveryPath` query lets a single XSS turn every 404 of
 *   the app into attacker HTML on the app origin.
 * - AI Ready adds a middleware to every request (an axios-default `Accept` header is redirected to
 *   `.md`, `Accept: image/webp` gets a 406), writes `Content-Signal: ai-input=yes` into the
 *   customer's robots.txt, and warns on every Docker build because the site URL arrives only at
 *   runtime. Without prerendering, `/llms-full.txt` and `/sitemap.md` are empty placeholders.
 *
 * So the template switches both off, and this contract keeps it a decision rather than a default:
 * each key must be present at the top level of nuxt.config.ts, either `false` or an object. An
 * object is a deliberate opt-in and has to carry the one setting the default gets wrong for us:
 * `storage` for Skew Protection (without it nothing survives a build) and `contentSignal` for AI
 * Ready (the default declares the customer's content free for AI input).
 *
 * Read as text, like the other contract tests: importing would execute the whole Nuxt config.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');
const config = readFileSync(join(ROOT, 'nuxt.config.ts'), 'utf8').replace(/\/\/.*$/gm, '');

/** Value of a top-level key of `defineNuxtConfig({ ... })`: `false`, the object body, or undefined. */
function topLevel(key: string): false | string | undefined {
  const match = new RegExp(`^ {2}${key}:\\s*(false|\\{)`, 'm').exec(config);
  if (!match) return undefined;
  if (match[1] === 'false') return false;
  let depth = 0;
  const start = match.index + match[0].length - 1;
  for (let i = start; i < config.length; i++) {
    if (config[i] === '{') depth++;
    if (config[i] === '}' && --depth === 0) return config.slice(start, i + 1);
  }
  return undefined;
}

describe('@nuxtjs/seo bundled modules contract', () => {
  const cases = [
    { key: 'skewProtection', required: 'storage', why: 'a fresh Docker build per deploy keeps no old assets without it' },
    { key: 'aiReady', required: 'contentSignal', why: "the default declares ai-input=yes in robots.txt on the customer's behalf" },
  ];

  it.each(cases)('$key is decided explicitly in nuxt.config.ts', ({ key }) => {
    expect(topLevel(key), `set \`${key}: false\` (or a configured object) — @nuxtjs/seo 6 enables it when the key is missing`).not.toBeUndefined();
  });

  it.each(cases)('an enabled $key sets `$required` itself', ({ key, required, why }) => {
    const value = topLevel(key);
    if (typeof value !== 'string') return;
    expect(value, `${key} is enabled without \`${required}\`: ${why}`).toMatch(new RegExp(`\\b${required}:`));
  });

  it('ships the template with both switched off', () => {
    expect(topLevel('skewProtection')).toBe(false);
    expect(topLevel('aiReady')).toBe(false);
  });
});
