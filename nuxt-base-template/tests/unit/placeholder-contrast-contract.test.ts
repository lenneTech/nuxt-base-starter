// @vitest-environment node
/**
 * Every Nuxt UI placeholder must reach WCAG AA contrast (4.5:1) in both colour modes.
 *
 * Nuxt UI draws placeholders `text-dimmed`. With this template's slate neutrals that is
 * neutral-400 on white, 2.56:1, and neutral-500 on neutral-900, 3.75:1. Lighthouse reported it
 * on one page only, /app/admin/ai/preferences, because USelectMenu renders its placeholder as a
 * real <span>. The `::placeholder` of UInput and UTextarea has the same colour, but axe does not
 * check pseudo-elements, so no audit ever flagged the login or register form. Every generated
 * project inherited both (measured 2026-10-27, Lighthouse 13.4.1).
 *
 * `app/app.config.ts` lifts the placeholder of each of the ten components that draw one, so a
 * project that adds UInputDate or UPinInput later gets the fix too. This spec pins both halves:
 * that every override is in place, and that the token it names clears 4.5:1 against `bg-default`,
 * computed from this template's palette (`app/assets/css/tailwind.css`) and the token map of the
 * installed @nuxt/ui. A palette change or a Nuxt UI token remap that breaks the contrast fails
 * here, not in a Lighthouse run nobody does.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');

interface ComponentTheme {
  slots?: Record<string, string>;
  variants?: Record<string, Record<string, Record<string, string>>>;
}

/** app.config `ui` key, the theme slot that colours the placeholder, and the variant it is coloured under. */
const PLACEHOLDERS = [
  ['input', 'base', 'placeholder:'],
  ['inputDate', 'segment', 'data-placeholder:'],
  ['inputMenu', 'tagsInput', 'placeholder:'],
  ['inputNumber', 'base', 'placeholder:'],
  ['inputTags', 'input', 'placeholder:'],
  ['inputTime', 'segment', 'data-placeholder:'],
  ['pinInput', 'base', 'placeholder:'],
  ['select', 'placeholder', ''],
  ['selectMenu', 'placeholder', ''],
  ['textarea', 'base', 'placeholder:'],
] as const;

let ui: Record<string, ComponentTheme | undefined>;

beforeAll(async () => {
  vi.stubGlobal('defineAppConfig', (config: unknown) => config);
  ui = ((await import('../../app/app.config')).default as unknown as { ui: typeof ui }).ui;
});

/** The text token (`muted`, `dimmed`, ...) a class list colours its placeholder with. */
function placeholderToken(classes: string | undefined, prefix: string): string | undefined {
  return new RegExp(`(?:^|\\s)${prefix}text-([a-z]+)(?:\\s|$)`).exec(classes ?? '')?.[1];
}

/** Every placeholder override in app.config, as `[where, token]`. */
function overrides(): [string, string | undefined][] {
  return [
    ...PLACEHOLDERS.map(([component, slot, prefix]): [string, string | undefined] => [`ui.${component}.slots.${slot}`, placeholderToken(ui[component]?.slots?.[slot], prefix)]),
    // UInputMenu without `multiple` colours its input through a variant, not a slot.
    ['ui.inputMenu.variants.multiple.false.base', placeholderToken(ui.inputMenu?.variants?.multiple?.false?.base, 'placeholder:')],
  ];
}

const palette: Record<string, string> = Object.fromEntries(
  [...readFileSync(join(ROOT, 'app', 'assets', 'css', 'tailwind.css'), 'utf8').matchAll(/--ui-color-neutral-(\d+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]),
);
const nuxtUiCss = readFileSync(join(ROOT, 'node_modules', '@nuxt', 'ui', 'dist', 'runtime', 'index.css'), 'utf8');

/** A Nuxt UI colour variable for one mode, resolved through this template's neutral palette. */
function color(mode: 'dark' | 'light', variable: string): string {
  const block = (mode === 'light' ? /\.light,:host,:root\{([^}]*)\}/ : /\.dark\{([^}]*)\}/).exec(nuxtUiCss)?.[1] ?? '';
  const value = new RegExp(`${variable}:([^;}]+)`).exec(block)?.[1]?.trim() ?? '';
  const shade = /^var\(--ui-color-neutral-(\d+)\)$/.exec(value)?.[1];
  const hex = shade ? palette[shade] : value;
  if (!hex?.startsWith('#')) throw new Error(`${variable} (${mode}) does not resolve to a colour: "${value}"`);
  // `#fff` -> `#ffffff`. A regex rather than `[...hex.slice(1)].map(...)`: unicorn/no-useless-spread
  // assumes `slice` returns an array, and the check's autofix removed the spread (seen 2026-10-27).
  return hex.length === 4 ? hex.replace(/[0-9a-f]/gi, '$&$&') : hex;
}

/** WCAG 2 contrast ratio of two sRGB hex colours. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.040_45 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('placeholder contrast', () => {
  it('reproduces the defect it guards against (text-dimmed on bg-default)', () => {
    expect(contrast(color('light', '--ui-text-dimmed'), color('light', '--ui-bg'))).toBeCloseTo(2.56, 2);
    expect(contrast(color('dark', '--ui-text-dimmed'), color('dark', '--ui-bg'))).toBeCloseTo(3.75, 2);
  });

  it('overrides the placeholder of every component that draws one', () => {
    for (const [where, token] of overrides()) {
      expect(token, `${where} sets no placeholder colour, so Nuxt UI's text-dimmed applies`).toBeDefined();
    }
  });

  it.each(['light', 'dark'] as const)('every placeholder clears 4.5:1 on bg-default in %s mode', (mode) => {
    for (const [where, token] of overrides()) {
      if (!token) continue; // reported by the test above
      const ratio = contrast(color(mode, `--ui-text-${token}`), color(mode, '--ui-bg'));
      expect(ratio, `${where}: text-${token} on bg-default is ${ratio.toFixed(2)}:1 in ${mode} mode`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
