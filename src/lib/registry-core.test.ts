import { describe, expect, it } from 'vitest';
import { buildRegistry, groupByCategory, type ToolSources } from './registry-core';
import type { ToolMeta } from './tool-meta';

const meta = (slug: string, over: Partial<ToolMeta> = {}): ToolMeta => ({
  slug,
  title: slug,
  description: `${slug} の説明`,
  category: 'convert',
  icon: '🔧',
  keywords: [],
  ...over,
});

const sources = (metas: ToolMeta[], opts: { noComponent?: string; noGuide?: string } = {}): ToolSources => ({
  metas: Object.fromEntries(metas.map((m) => [`../tools/${m.slug}/meta.ts`, { meta: m }])),
  components: metas.filter((m) => m.slug !== opts.noComponent).map((m) => `../tools/${m.slug}/Tool.astro`),
  guides: metas.filter((m) => m.slug !== opts.noGuide).map((m) => `../tools/${m.slug}/guide.md`),
});

describe('buildRegistry', () => {
  it('カテゴリ順 → order → タイトル順に並べる', () => {
    const tools = buildRegistry(
      sources([
        meta('gen', { category: 'generate' }),
        meta('b-conv', { title: 'B' }),
        meta('a-conv', { title: 'A' }),
        meta('first', { title: 'Z', order: 1 }),
      ]),
    );
    expect(tools.map((t) => t.slug)).toEqual(['first', 'a-conv', 'b-conv', 'gen']);
  });

  it('slug とフォルダ名が違えばエラー', () => {
    const src = sources([meta('abc')]);
    src.metas = { '../tools/xyz/meta.ts': { meta: meta('abc') } };
    src.components = ['../tools/xyz/Tool.astro'];
    src.guides = ['../tools/xyz/guide.md'];
    expect(() => buildRegistry(src)).toThrow(/フォルダ名 "xyz"/);
  });

  it('Tool.astro や guide.md がなければエラー', () => {
    expect(() => buildRegistry(sources([meta('a')], { noComponent: 'a' }))).toThrow(/Tool.astro/);
    expect(() => buildRegistry(sources([meta('a')], { noGuide: 'a' }))).toThrow(/guide.md/);
  });

  it('meta.ts のないツールフォルダはエラー', () => {
    const src = sources([meta('a')]);
    src.components.push('../tools/orphan/Tool.astro');
    expect(() => buildRegistry(src)).toThrow(/orphan: meta.ts/);
  });

  it('meta を export していなければエラー', () => {
    const src = sources([]);
    src.metas = { '../tools/a/meta.ts': {} };
    expect(() => buildRegistry(src)).toThrow(/meta を export/);
  });

  it('slug の書式・カテゴリ・説明文の長さを検査する', () => {
    expect(() => buildRegistry(sources([meta('Bad_Slug')]))).toThrow(/英小文字/);
    expect(() =>
      buildRegistry(sources([meta('a', { category: 'nope' as ToolMeta['category'] })])),
    ).toThrow(/カテゴリ/);
    expect(() => buildRegistry(sources([meta('a', { description: 'あ'.repeat(121) })]))).toThrow(
      /120/,
    );
  });

  it('ツールが 0 件でも動く', () => {
    expect(buildRegistry(sources([]))).toEqual([]);
  });
});

describe('groupByCategory', () => {
  it('空のカテゴリを除き、カテゴリ順で返す', () => {
    const groups = groupByCategory([meta('g', { category: 'generate' }), meta('c')]);
    expect(groups.map((g) => [g.category, g.label, g.tools.length])).toEqual([
      ['convert', '変換', 1],
      ['generate', '生成', 1],
    ]);
  });
});
