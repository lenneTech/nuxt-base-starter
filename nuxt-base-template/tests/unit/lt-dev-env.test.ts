/**
 * Verifies that the .env.example documents the lt-dev defaults the
 * runtime expects. The starter must keep these in sync so a fresh
 * `cp .env.example .env` reflects the lt-dev URL conventions.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const envFile = join(__dirname, '..', '..', '.env.example');

describe('.env.example — lt dev keys', () => {
  it('exists', () => {
    expect(existsSync(envFile)).toBe(true);
  });

  const content = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';

  it('documents NUXT_PUBLIC_SITE_URL with localhost default', () => {
    expect(content).toMatch(/NUXT_PUBLIC_SITE_URL=http:\/\/localhost:3001/);
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
