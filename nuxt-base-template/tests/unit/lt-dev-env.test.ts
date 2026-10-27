/**
 * Verifies that the .env.example documents the lt-dev defaults the
 * runtime expects. The starter must keep these in sync so a fresh
 * `cp .env.example .env` reflects the lt-dev URL conventions.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const envFile = join(import.meta.dirname, '..', '..', '.env.example');

describe('.env.example — lt dev keys', () => {
  it('exists', () => {
    expect(existsSync(envFile)).toBe(true);
  });

  const content = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';

  it('documents NUXT_PUBLIC_SITE_URL with localhost default', () => {
    expect(content).toMatch(/NUXT_PUBLIC_SITE_URL=http:\/\/localhost:3001/);
  });

  // `lt fullstack init` copies this file to `.env`. nuxt-site-config flags a localhost URL
  // unless the site env is `development`, and outside `nuxt dev` that env comes from Nuxt's
  // `envName` (= production), so every `nuxt prepare` (postinstall) warned
  // "url ... from buildEnv should not be localhost". Docker strips `.env*`, so production
  // builds keep `production` and stay indexable.
  it('pairs the localhost site URL with NUXT_SITE_ENV=development', () => {
    expect(content).toMatch(/^NUXT_SITE_ENV=development$/m);
  });

  it('documents NUXT_PUBLIC_API_URL with localhost default', () => {
    expect(content).toMatch(/NUXT_PUBLIC_API_URL=http:\/\/localhost:3000/);
  });

  it('documents NUXT_PUBLIC_STORAGE_PREFIX (cross-project namespacing)', () => {
    expect(content).toMatch(/NUXT_PUBLIC_STORAGE_PREFIX=/);
  });

  it('documents NUXT_PUBLIC_API_PROXY (set to true for classic local dev)', () => {
    expect(content).toMatch(/NUXT_PUBLIC_API_PROXY=true/);
  });

  it('explains that lt dev up sets NUXT_PUBLIC_API_PROXY=false', () => {
    expect(content).toMatch(/lt dev up.*NUXT_PUBLIC_API_PROXY=false/s);
  });

  it('explains URLs are overridden under lt dev', () => {
    expect(content).toMatch(/lt dev up/);
    expect(content).toMatch(/<slug>\.localhost/);
  });
});
