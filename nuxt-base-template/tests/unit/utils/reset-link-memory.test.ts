/**
 * Contract test for the memory behind `/auth/reset-password`.
 *
 * This guards a security control: what is remembered here can set somebody's password, so a
 * recall must hand it out for the id it was stored under and for nothing else. Which arrival may
 * ask at all is decided by the page and pinned by `tests/e2e/auth-reset-password-token.spec.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createResetLinkId, forgetResetLink, recallResetLink, rememberResetLink } from '../../../app/utils/reset-link-memory';

describe('reset link memory', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hands the token out for the id it was stored under, repeatedly', () => {
    rememberResetLink('entry-a', 'token-a');

    expect(recallResetLink('entry-a')).toBe('token-a');
    expect(recallResetLink('entry-a')).toBe('token-a');
  });

  it.each([
    ['another id', 'entry-b'],
    ['an entry without an id', undefined],
    ['a cleared history state', null],
    ['an empty id', ''],
    ['an id of the wrong type', 42],
  ])('hands out nothing for %s', (_label, id) => {
    rememberResetLink('entry-a', 'token-a');

    expect(recallResetLink(id)).toBe('');
  });

  it('hands out nothing when nothing was stored', () => {
    expect(recallResetLink('entry-a')).toBe('');
  });

  it('keeps only the newest link', () => {
    rememberResetLink('entry-a', 'token-a');
    rememberResetLink('entry-b', 'token-b');

    expect(recallResetLink('entry-a')).toBe('');
    expect(recallResetLink('entry-b')).toBe('token-b');
  });

  it('erases the link', () => {
    rememberResetLink('entry-a', 'token-a');

    forgetResetLink();

    expect(recallResetLink('entry-a')).toBe('');
    expect(window.sessionStorage.length).toBe(0);
  });

  it.each([
    ['text that is no JSON', '{broken'],
    ['a token of the wrong type', JSON.stringify({ id: 'entry-a', token: 42 })],
    ['a JSON null', 'null'],
  ])('treats %s as nothing stored', (_label, stored) => {
    rememberResetLink('entry-a', 'token-a');
    window.sessionStorage.setItem(window.sessionStorage.key(0) as string, stored);

    expect(recallResetLink('entry-a')).toBe('');
  });

  it('loses the link instead of failing when storage is blocked', () => {
    const blocked = (): never => {
      throw new DOMException('Storage is blocked', 'SecurityError');
    };
    vi.stubGlobal('sessionStorage', { getItem: blocked, removeItem: blocked, setItem: blocked });

    expect(() => rememberResetLink('entry-a', 'token-a')).not.toThrow();
    expect(recallResetLink('entry-a')).toBe('');
    expect(() => forgetResetLink()).not.toThrow();
  });

  it('creates ids nobody can guess', () => {
    const ids = new Set(Array.from({ length: 100 }, () => createResetLinkId()));

    expect(ids.size).toBe(100);
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{32}$/);
    }
  });

  it('creates ids without `crypto.randomUUID`, which plain-http origins do not have', () => {
    vi.stubGlobal('crypto', { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) });

    expect(createResetLinkId()).toMatch(/^[0-9a-f]{32}$/);
  });
});
