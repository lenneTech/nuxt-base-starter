/**
 * The generated API client must not promise `Date` where the wire delivers a
 * string.
 *
 * `@hey-api/transformers` emits `app/api-client/transformers.gen.ts` and makes
 * `types.gen.ts` declare every date-time field as `Date`. But nothing imports
 * those transformers and the generated SDK passes no `responseTransformer`, so
 * what arrives at runtime is the raw ISO string. The declaration then misleads
 * instead of protecting: `goal.periodStart.getTime()` compiles cleanly and
 * throws, and `as string` casts spread through consuming code to bend the type
 * back into shape. Found and fixed in a consumer first (lt-crm DEV-2897), where
 * the plugin had been in this template's config since the beginning — so every
 * project generated from it inherited the same lie.
 *
 * A project created from this template generates its own `app/api-client/`, and
 * nothing generated is committed here. The configuration is therefore the entire
 * contract at template level; a consuming project additionally pins the
 * generator's OUTPUT (no `transformers.gen.ts`, no `Date` in `types.gen.ts`).
 */
import { describe, expect, it } from 'vitest';

const TRANSFORMERS_PLUGIN = '@hey-api/transformers';

/**
 * Loads the real `openapi-ts.config.ts` and resolves it — `defineConfig`
 * returns a promise, so the configured object is readable rather than having to
 * be matched as source text.
 *
 * The config refuses to load without `NUXT_API_URL` (DEV-2802). Any
 * syntactically valid URL satisfies that guard; nothing here contacts an API.
 */
async function resolveOpenApiConfig() {
  process.env.NUXT_API_URL ||= 'http://127.0.0.1:1';
  const module = await import('../../openapi-ts.config');
  return await module.default;
}

/** Plugins may be given as a bare name or as a configured object. */
function pluginNames(plugins: unknown): string[] {
  if (!Array.isArray(plugins)) {
    return [];
  }
  return plugins.map((plugin) => (typeof plugin === 'string' ? plugin : String((plugin as { name?: string })?.name ?? '')));
}

describe('openapi-ts configuration', () => {
  it('does not configure the transformers plugin', async () => {
    const config = await resolveOpenApiConfig();
    expect(pluginNames(config.plugins)).not.toContain(TRANSFORMERS_PLUGIN);
  });

  it('still configures the plugins the client actually needs', async () => {
    // Guards against "fixing" the above by emptying the list: without these the
    // generator produces no client, no SDK and no types at all.
    const config = await resolveOpenApiConfig();
    expect(pluginNames(config.plugins)).toEqual(expect.arrayContaining(['@hey-api/client-fetch', '@hey-api/sdk', '@hey-api/typescript']));
  });
});
