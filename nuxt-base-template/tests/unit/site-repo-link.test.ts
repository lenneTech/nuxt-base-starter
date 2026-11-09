/**
 * The GitHub links in header, footer and start page point at `SITE_REPO_URL`, and disappear when it
 * is `null`.
 *
 * `lt fullstack init` sets `SITE_REPO_URL` to `null` in every generated project (see
 * `site-contract.test.ts`): a new project has no public repository, and a link to the starter's
 * would send its users to a stranger's code. A link that ignored the constant would stay visible,
 * or point at `#` as the footer's did.
 *
 * There is no Nuxt environment in this suite, so the auto-imports the layout and the page rely on
 * are provided as globals, and the Nuxt UI components are stubs that render their slots and turn
 * `to` into `href`. `~/utils/site` is mocked per case and the components are imported afresh.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computed, createApp, defineComponent, h, onMounted, ref, watch, type Component } from 'vue';

const REPO = 'https://github.com/example/project';

/** Renders every slot it gets, so header, footer and card contents all reach the DOM. */
const slotted = (tag = 'div') =>
  defineComponent({
    inheritAttrs: false,
    setup:
      (_props, { slots }) =>
      () =>
        h(
          tag,
          Object.values(slots).flatMap((slot) => slot?.() ?? []),
        ),
  });

/** UButton / ULink: an anchor, with the icon kept as an attribute the assertions can read. */
const link = defineComponent({
  inheritAttrs: false,
  props: { icon: { default: undefined, type: String }, to: { default: undefined, type: String } },
  setup:
    (props, { attrs, slots }) =>
    () =>
      h('a', { 'aria-label': attrs['aria-label'], 'data-icon': props.icon, href: props.to }, slots.default?.()),
});

async function render(componentPath: '~/layouts/default.vue' | '~/pages/index.vue', repoUrl: null | string) {
  vi.resetModules();
  vi.doMock('~/utils/site', () => ({ SITE_NAME: 'Projekt', SITE_REPO_URL: repoUrl }));

  vi.stubGlobal('computed', computed);
  vi.stubGlobal('onMounted', onMounted);
  vi.stubGlobal('ref', ref);
  vi.stubGlobal('watch', watch);
  vi.stubGlobal('isAdminUser', () => false);
  vi.stubGlobal('navigateTo', vi.fn());
  vi.stubGlobal('useLtAiStatus', () => ({ enabled: ref(false), load: vi.fn() }));
  vi.stubGlobal('useLtAuth', () => ({ isAuthenticated: ref(false), signOut: vi.fn(), user: ref(null), validateSession: vi.fn() }));
  vi.stubGlobal('useSeoMeta', vi.fn());
  vi.stubGlobal('useSiteConfig', () => ({ name: 'Projekt' }));

  const component = (componentPath === '~/layouts/default.vue' ? await import('~/layouts/default.vue') : await import('~/pages/index.vue')).default as Component;
  const app = createApp(component);
  for (const name of ['UHeader', 'UMain', 'UFooter', 'UTooltip', 'UCard', 'UAlert', 'UBadge', 'UNavigationMenu', 'USeparator', 'UColorModeButton', 'UIcon']) {
    app.component(name, slotted());
  }
  app.component('UButton', link);
  app.component('ULink', link);

  const root = document.createElement('div');
  document.body.append(root);
  app.mount(root);
  await Promise.resolve();

  const anchors = [...root.querySelectorAll('a')];
  return {
    /** Every anchor that shows a GitHub icon or points at GitHub. */
    github: anchors.filter((a) => (a.dataset.icon ?? '').includes('github') || (a.getAttribute('href') ?? '').includes('github.com')),
    unmount: () => {
      app.unmount();
      root.remove();
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock('~/utils/site');
});

describe('GitHub links follow SITE_REPO_URL', () => {
  it('the layout links header and footer to the repository', async () => {
    const layout = await render('~/layouts/default.vue', REPO);
    expect(layout.github.map((a) => a.getAttribute('href'))).toEqual([REPO, REPO]);
    layout.unmount();
  });

  it('the layout shows no GitHub link without a repository', async () => {
    const layout = await render('~/layouts/default.vue', null);
    expect(layout.github).toEqual([]);
    layout.unmount();
  });

  it('the start page links to the repository', async () => {
    const page = await render('~/pages/index.vue', REPO);
    expect(page.github.map((a) => a.getAttribute('href'))).toEqual([REPO]);
    page.unmount();
  });

  it('the start page shows no GitHub link without a repository', async () => {
    const page = await render('~/pages/index.vue', null);
    expect(page.github).toEqual([]);
    page.unmount();
  });
});
