/**
 * The template ships a `securityTxt` example, and it has to stay off.
 *
 * Switched on, every project generated from this template would publish a contact address nobody
 * decided on: `enabled` is fixed at build time, and the contact defaults to lenne.Tech, also for a
 * customer project. A published address nobody answers is worse than none.
 *
 * A contact that is not a URI fails without a sign: the route answers 404, because a file without
 * `Contact` is invalid. So the example must show a working one, or whoever copies it finds out from
 * a scanner.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const config = readFileSync(join(import.meta.dirname, '..', '..', 'nuxt.config.ts'), 'utf8');
const securityTxt = /^ {4}securityTxt: \{\n([\s\S]*?)^ {4}\},/m.exec(config)?.[1] ?? '';

describe('securityTxt example in nuxt.config.ts', () => {
  it('exists', () => {
    expect(securityTxt).not.toBe('');
  });

  it('is off', () => {
    expect(securityTxt).toMatch(/^ {6}enabled: false,$/m);
  });

  it('shows a contact the route accepts', () => {
    expect(securityTxt).toMatch(/^ {6}contact: '(mailto:|https:\/\/|tel:)/m);
  });
});
