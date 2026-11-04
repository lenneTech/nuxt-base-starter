/**
 * app/middleware/ai.global.ts: the AI pages exist only while the API runs its AI module.
 *
 * nest-server-starter leaves the module off by default (decided 2026-11-04), and nest-server
 * answers `GET /ai/status` with 404 then. A visitor who opens an AI route anyway must land on /app
 * instead of a page whose every request fails; with the module on, nothing changes. The status is
 * loaded for every /app route, so the layout's navigation is right on the first render.
 *
 * There is no Nuxt environment in this suite, so the auto-imports the middleware uses are globals,
 * and `useLtAiStatus` is a fake with the contract of nuxt-extensions 1.23.0.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computed, ref } from 'vue';

import { isAiRoute } from '../../../app/utils/ai-routes';

type Middleware = (to: { fullPath: string; path: string }) => Promise<unknown>;

async function loadMiddleware(status: { enabled: boolean }) {
  const enabled = ref(false);
  const load = vi.fn(async () => {
    enabled.value = status.enabled;
  });
  const navigateTo = vi.fn((target: string) => ({ redirectedTo: target }));
  vi.stubGlobal('defineNuxtRouteMiddleware', (middleware: Middleware) => middleware);
  vi.stubGlobal('isAiRoute', isAiRoute);
  vi.stubGlobal('navigateTo', navigateTo);
  vi.stubGlobal('useLtAiStatus', () => ({ enabled: computed(() => enabled.value), load }));
  vi.resetModules();
  const middleware = (await import('../../../app/middleware/ai.global')).default as unknown as Middleware;
  const visit = (path: string) => middleware({ fullPath: path, path });
  return { load, navigateTo, visit };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ai.global middleware', () => {
  it('sends an AI route to /app while the API runs no AI module', async () => {
    const { navigateTo, visit } = await loadMiddleware({ enabled: false });

    expect(await visit('/app/settings/ai')).toEqual({ redirectedTo: '/app' });
    expect(navigateTo).toHaveBeenCalledWith('/app');
  });

  it('lets an AI route through while the module is on', async () => {
    const { navigateTo, visit } = await loadMiddleware({ enabled: true });

    expect(await visit('/app/ai')).toBeUndefined();
    expect(await visit('/app/admin/ai/connections')).toBeUndefined();
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it('loads the status for every /app route, so the navigation is right on the first render', async () => {
    const { load, navigateTo, visit } = await loadMiddleware({ enabled: false });

    expect(await visit('/app/settings/security')).toBeUndefined();
    expect(load).toHaveBeenCalled();
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it('asks nothing outside /app', async () => {
    const { load, visit } = await loadMiddleware({ enabled: false });

    expect(await visit('/auth/login')).toBeUndefined();
    expect(await visit('/')).toBeUndefined();
    expect(load).not.toHaveBeenCalled();
  });
});
