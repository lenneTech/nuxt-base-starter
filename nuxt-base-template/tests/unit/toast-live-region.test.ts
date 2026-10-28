/**
 * Guards that a toast is announced to screen readers.
 *
 * WHY
 *
 * Every UToast renders reka-ui's `ToastRoot`, which puts `role="alert"` and `aria-live` on an
 * announcer element (`ToastAnnounce`). reka-ui 2.10.0 changed `VisuallyHidden
 * feature="fully-hidden"`, the wrapper the announcer used, to also set `aria-hidden="true"`.
 * The live region then sat inside an aria-hidden subtree, and screen readers announced no
 * toast at all, while the toast itself still rendered visibly. Nothing in the template's own
 * gates noticed; a Playwright spec in a generated project did, because
 * `getByRole('alert')` found only a hidden node.
 *
 * Upstream: unovue/reka-ui#3049, fixed by #3050 (merged 2026-10-26, not yet released). Until
 * @nuxt/ui resolves a release that carries it, `patches/reka-ui@2.11.0.patch`
 * (`patchedDependencies` in pnpm-workspace.yaml) applies the same one-line change. This test is
 * a port of the upstream regression test and stays when the patch goes: it checks the
 * behaviour, not the patch, so it also catches a later reka-ui release that breaks it again.
 *
 * HOW
 *
 * reka-ui is not a direct dependency (pnpm does not hoist it), so it is resolved from the
 * installed @nuxt/ui, which is exactly the copy the app runs. Layout-agnostic: in an lt
 * fullstack monorepo `projects/app/node_modules/@nuxt/ui` is a symlink just like here.
 */
import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { type App, createApp, h, nextTick } from 'vue';

const templateRoot = join(import.meta.dirname, '..', '..');

async function importRekaUi() {
  const nuxtUiDir = realpathSync(join(templateRoot, 'node_modules', '@nuxt', 'ui'));
  const rekaPackageJson = createRequire(join(nuxtUiDir, 'package.json')).resolve('reka-ui/package.json');
  return import(pathToFileURL(join(dirname(rekaPackageJson), 'dist', 'index.js')).href);
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

let app: App | undefined;

afterEach(() => {
  app?.unmount();
  app = undefined;
  document.body.innerHTML = '';
});

describe('toast live region', () => {
  it('is not inside an aria-hidden subtree', async () => {
    const { ToastProvider, ToastRoot, ToastTitle, ToastViewport } = await importRekaUi();

    const container = document.createElement('div');
    document.body.appendChild(container);
    app = createApp({
      render: () => h(ToastProvider, null, () => [h(ToastRoot, { open: true }, () => [h(ToastTitle, null, () => 'Eintrag gelöscht')]), h(ToastViewport)]),
    });
    app.mount(container);

    // ToastAnnounce renders its text after two animation frames (see ToastAnnounce.js).
    await nextTick();
    await nextFrame();
    await nextFrame();
    await nextTick();

    const liveRegion = document.querySelector('[role="alert"][aria-live]');
    expect(liveRegion, 'reka-ui rendered no toast announcer at all').not.toBeNull();
    expect(liveRegion!.textContent).toContain('Eintrag gelöscht');
    // A live region inside an aria-hidden subtree is ignored by screen readers.
    expect(liveRegion!.closest('[aria-hidden="true"]')).toBeNull();
  });
});
