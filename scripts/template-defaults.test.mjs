/**
 * Defaults of the template that only bind the template.
 *
 * This file lives in the repository root on purpose. `lt fullstack init` copies `nuxt-base-template/`
 * and nothing else, tests included, so a test in there would also run in every generated project,
 * where switching `securityTxt` on is a legitimate step the config comment describes.
 *
 * The example has to stay off here. Switched on, every generated project would publish a contact
 * address nobody decided on: `enabled` is fixed at build time, and the contact defaults to
 * lenne.Tech, also for a customer project.
 *
 * A contact that is not a URI fails without a sign: the route answers 404, because a file without
 * `Contact` is invalid. So the example must show a working one, or whoever copies it finds out from
 * a scanner.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const config = readFileSync(new URL('../nuxt-base-template/nuxt.config.ts', import.meta.url), 'utf8');

const ltExtensions = config.slice(Math.max(config.indexOf('\n  ltExtensions: {'), 0));
const securityTxt = /^ {4}securityTxt: \{\n([\s\S]*?)^ {4}\},/m.exec(ltExtensions)?.[1] ?? '';

test('the template carries a securityTxt example under ltExtensions', () => {
  assert.notEqual(securityTxt, '');
});

test('the securityTxt example is off', () => {
  assert.deepEqual(securityTxt.match(/^ {6}enabled: .*$/gm), ['      enabled: false,']);
});

test('the securityTxt example shows a contact the route accepts', () => {
  assert.match(securityTxt, /^ {6}contact: '(mailto:|https:\/\/|tel:)[^\s']+',$/m);
});
