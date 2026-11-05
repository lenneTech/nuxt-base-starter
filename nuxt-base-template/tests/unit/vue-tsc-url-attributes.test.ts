// @vitest-environment node
/**
 * No `//` in a component's attribute, while vue-tsc has vuejs/language-tools#6322.
 *
 * vue-tsc 3.3.14 turns every `//` inside a component attribute into a comment in the code it generates,
 * strings included, and with that ends the function that holds the template. What follows is no longer
 * type-checked, and `typecheck` stays green (measured 2026-11-05 on `app/pages/index.vue`: `size="xxl"` next
 * to `to="https://…"` passed, the same mistake next to a bound `:to="links.github"` failed with TS2322).
 * Where the template narrows `.value` later, it fails loudly instead: six TS2339 in
 * `app/components/Ai/ModalAiConnection.vue`. A string literal inside a binding (`:to="'https://…'"`) is no
 * way out; native elements such as `<a href="https://…">` are not affected.
 *
 * So a URL on a component lives in script and is bound by name. The vendored core (`app/core/`) is left to
 * nuxt-extensions. Remove this test once the pinned vue-tsc has the fix.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'vue/compiler-sfc';
import { describe, expect, it } from 'vitest';

const APP = join(import.meta.dirname, '..', '..', 'app');

// The parts of the template AST read here (@vue/compiler-core: NodeTypes, ElementTypes).
const ELEMENT = 1;
const COMPONENT = 1;
const ATTRIBUTE = 6;
const DIRECTIVE = 7;

interface TemplateNode {
  children?: TemplateNode[];
  loc: { start: { line: number } };
  props?: { exp?: { content: string }; name: string; rawName?: string; type: number; value?: { content: string } }[];
  tag?: string;
  tagType?: number;
  type: number;
}

/** Each component attribute holding `//`, as `line <Tag attribute>`. */
function slashedComponentAttributes(source: string): string[] {
  const found: string[] = [];
  const visit = (node: TemplateNode): void => {
    if (node.type === ELEMENT && node.tagType === COMPONENT) {
      for (const prop of node.props ?? []) {
        const text = prop.type === ATTRIBUTE ? prop.value?.content : prop.type === DIRECTIVE ? prop.exp?.content : undefined;
        if (text?.includes('//')) {
          found.push(`${node.loc.start.line} <${node.tag} ${prop.rawName ?? prop.name}>`);
        }
      }
    }
    node.children?.forEach(visit);
  };
  const ast = parse(source).descriptor.template?.ast as TemplateNode | undefined;
  if (ast) {
    visit(ast);
  }
  return found;
}

describe('component attributes vs. vue-tsc', () => {
  it('finds `//` in a static or bound component attribute, and nowhere else', () => {
    const source = [
      '<template>',
      '  <UButton to="https://example.com" />',
      `  <ULink :to="'https://example.com'" />`,
      '  <UButton :to="links.github" />',
      '  <a href="https://example.com">native</a>',
      '</template>',
    ].join('\n');

    expect(slashedComponentAttributes(source)).toEqual(['2 <UButton to>', '3 <ULink :to>']);
  });

  it('binds every URL on a component in app/ from script', () => {
    const found = readdirSync(APP, { recursive: true, encoding: 'utf8' })
      .filter((file) => file.endsWith('.vue') && file.split(/[/\\]/)[0] !== 'core')
      .flatMap((file) => slashedComponentAttributes(readFileSync(join(APP, file), 'utf8')).map((hit) => `app/${file.replaceAll('\\', '/')}:${hit}`));

    expect(found, 'vue-tsc 3.3.14 stops type-checking at a `//` in a component attribute; move the value into script and bind it by name').toEqual([]);
  });
});
