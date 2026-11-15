# Migration Guide: @nuxtjs/plausible 4.1.0 and the tracker's pre-bundle entry

The template moves to `@nuxtjs/plausible` 4.1.0. Up to 4.0.0 the module added
`@plausible-analytics/tracker` to `vite.optimizeDeps.include` by bare name. Under pnpm that entry
resolved to nothing and every `nuxt dev` printed `NUXT_B7002` (2.34.0, step 7). 4.1.0 fixes it
(nuxt-modules/plausible#52) and adds no entry at all. `app/plugins/plausible.client.ts` (since
2.37.0) imports the tracker itself, so the project's own list has to carry it now.

A project with the template's guard sees two red tests in `tests/unit/optimize-deps-contract.test.ts`
after it updates the module:

```
× pre-bundles every package the client code imports
  + "@plausible-analytics/tracker (imported by plugins/plausible.client.ts)"
× finds the entries the modules add
  AssertionError: expected [ '@lenne.tech/nuxt-extensions' ] to include '@nuxtjs/plausible'
```

In vendor mode the second one reads `expected [] to include '@nuxtjs/plausible'`. The guard read a
module's entries from `node_modules` only, and the vendored nuxt-extensions module is
`app/core/module.ts`. So swapping the expected name to nuxt-extensions fixes npm mode only. Step 3
covers both modes.

| Project                                                                         | What to do      |
| ------------------------------------------------------------------------------- | --------------- |
| Has `app/plugins/plausible.client.ts` and the guard (starter 2.37.0 or later)   | Steps 1 to 3    |
| Has the guard but not the plugin (2.34.0 to 2.36.x)                             | Steps 1 and 3   |
| Keeps `@nuxtjs/plausible` at 4.0.0                                              | Nothing for now |
| Sets `NUXT_PUBLIC_PLAUSIBLE_IGNORED_HOSTNAMES` to one hostname, not a JSON list | Also step 4     |

The module's defaults did not change (`enabled: true`, `apiHost: 'https://plausible.io'`), so the
`plausible` block from 2.37.0 stays as it is.

## Upgrade steps (existing project)

In an `lt fullstack` monorepo, the steps happen in `projects/app/`.

### 1. Update the module, keep the tracker

```bash
pnpm add -E -D @nuxtjs/plausible@4.1.0
pnpm why @plausible-analytics/tracker      # one copy, 0.4.7
```

Use `pnpm add -E` without `-D` if the project lists the module under `dependencies`. 4.1.0 asks for
`@plausible-analytics/tracker ^0.4.7`. Keep the tracker in `package.json`: the plugin imports it, and
pnpm does not let a project import a package it does not declare. Before 4.1.0 the dependency also
silenced the warning; that reason is gone, this one is not.

### 2. Add the tracker to `vite.optimizeDeps.include`

In `nuxt.config.ts`, add it to the list, next to the entries your project already has:

```ts
include: ['@better-auth/passkey/client', '@plausible-analytics/tracker', 'better-auth/client/plugins', 'better-auth/vue', 'qrcode', 'valibot'],
```

The guard requires every package `app/` imports to be in that list. Until 4.0.0 the module's own entry
counted for it.

### 3. Update the guard

If `tests/unit/optimize-deps-contract.test.ts` is unchanged in your project, copy the template's file.
Otherwise make two changes.

Add `moduleFile()` above `moduleIncludes()`, and let `moduleIncludes()` use it:

```ts
/**
 * The file that holds a module's code: `dist/module.mjs` of a package, or the source of a local
 * module. Vendor mode registers nuxt-extensions as `./app/core/module`, which is `app/core/module.ts`.
 */
function moduleFile(module: string): string {
  if (!/^\.{1,2}\//.test(module)) return join(ROOT, 'node_modules', ...packageName(module).split('/'), 'dist', 'module.mjs');
  return join(ROOT, /\.m?[jt]s$/.test(module) ? module : `${module}.ts`);
}
```

```ts
  return modules.flatMap((module) => {
    const file = moduleFile(module);
    if (!existsSync(file)) return [];
```

Then anchor `finds the entries the modules add` on nuxt-extensions, which pushes
`tus-js-client > url-parse` (since 1.19.0), under either name:

```ts
it('finds the entries the modules add', () => {
  expect(moduleIncludes().map(({ module }) => module)).toEqual(expect.arrayContaining([expect.stringMatching(/^(?:@lenne\.tech\/nuxt-extensions|\.\/app\/core\/module)$/)]));
});
```

In vendor mode the guard now also checks that the vendored module's entries resolve from the project
root. `tus-js-client` is a dependency in the template, so that holds. A project that dropped it gets a
red `resolves every entry from the project root` naming `tus-js-client > url-parse (from ./app/core/module)`.
Declare `tus-js-client` again, at the version the template pins.

### 4. Optional: one ignored hostname from the environment

From 4.1.0 on the module accepts a single hostname in `ignoredHostnames`, for example
`NUXT_PUBLIC_PLAUSIBLE_IGNORED_HOSTNAMES=staging.example`. `destr()` turns only a JSON array into a
list, so that value arrives as a string. The template plugin read a string as "no list" and reported
the stage's traffic after all. Replace the `ignoredHostnames` line in `app/plugins/plausible.client.ts`
and add the helper:

```ts
const ignoredHostnames = hostnameList(options.ignoredHostnames);
```

```ts
/**
 * `ignoredHostnames` as the module reads it. Since @nuxtjs/plausible 4.1.0 that includes a single
 * hostname: `NUXT_PUBLIC_PLAUSIBLE_IGNORED_HOSTNAMES=staging.example` passes `destr()` as a string,
 * and only a JSON array becomes a list. A blank value counts as none.
 */
function hostnameList(value: unknown): string[] {
  if (typeof value === 'string') {
    return value.trim() ? [value.trim()] : ['localhost'];
  }
  return Array.isArray(value) ? value.filter((hostname): hostname is string => typeof hostname === 'string') : ['localhost'];
}
```

As with a list, the value replaces the default `['localhost']`, so the tracker then counts localhost
too, as the module does. The two new cases in `tests/unit/plugins/plausible-tracker.test.ts`
("a single hostname set on the stage as a string", "a blank hostname") pin it; copy them with the
change.

## Check it

```bash
pnpm exec vitest run tests/unit/optimize-deps-contract.test.ts tests/unit/plugins/plausible-tracker.test.ts
```

Both files pass. `nuxt dev` starts without `NUXT_B7002`.
