import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { EquipKey } from './exercises';
import { BAND_KO, filterByBand, productBadge, productBands, SHARE_LINKS, type Product } from './shareLinks';

const p = (name: string, weight?: Product['weight']): Product => ({
  name,
  url: `https://toss.im/_m/${name}`,
  weight,
});

describe('productBands', () => {
  it('존재하는 구간만 돌려준다 — 빈 구간의 칩이 뜨면 눌러도 아무것도 안 나온다', () => {
    const bands = productBands([p('a', 'light'), p('b', 'heavy')]);
    expect(bands.map((b) => b.band)).toEqual(['light', 'heavy']);
  });

  it('순서는 가벼움 → 보통 → 무거움 → 조절식으로 고정이다 — 데이터 순서가 칩 순서를 흔들면 안 된다', () => {
    const bands = productBands([p('a', 'adjustable'), p('b', 'heavy'), p('c', 'light'), p('d', 'medium')]);
    expect(bands.map((b) => b.band)).toEqual(['light', 'medium', 'heavy', 'adjustable']);
  });

  it('개수를 함께 준다 — 칩에 개수가 없으면 눌러 보기 전엔 좁혀지는지 알 수 없다', () => {
    const bands = productBands([p('a', 'light'), p('b', 'light'), p('c', 'medium')]);
    expect(bands).toEqual([
      { band: 'light', count: 2 },
      { band: 'medium', count: 1 },
    ]);
  });

  it('무게를 모르는 상품은 어느 구간에도 안 들어간다 — 모르는 것에 구간을 붙이면 그게 거짓이다', () => {
    expect(productBands([p('a')])).toEqual([]);
  });

  it('상품이 없으면 빈 배열이다', () => {
    expect(productBands([])).toEqual([]);
  });
});

describe('filterByBand', () => {
  const list = [p('a', 'light'), p('b', 'medium'), p('c'), p('d', 'light')];

  it('구간이 null이면 전부 — 무게를 모르는 상품도 여기서는 보인다', () => {
    expect(filterByBand(list, null).map((x) => x.name)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('구간을 주면 그 구간만 남는다', () => {
    expect(filterByBand(list, 'light').map((x) => x.name)).toEqual(['a', 'd']);
  });

  it('원본 순서를 지킨다 — 무게순으로 적어 둔 배열이 필터 때문에 뒤집히면 안 된다', () => {
    expect(filterByBand([p('z', 'light'), p('a', 'light')], 'light').map((x) => x.name)).toEqual(['z', 'a']);
  });
});

describe('productBadge', () => {
  it('무게가 있으면 kg을 붙여 돌려준다', () => {
    expect(productBadge({ name: 'a', url: 'u', kg: 4, weight: 'light' })).toBe('4kg');
  });

  it('소수점을 지운다 — 4.5kg을 4kg으로 반올림하면 다른 상품이 된다', () => {
    expect(productBadge({ name: 'a', url: 'u', kg: 4.5, weight: 'light' })).toBe('4.5kg');
    expect(productBadge({ name: 'a', url: 'u', kg: 22.6, weight: 'adjustable' })).toBe('조절식');
  });

  it('조절식은 무게보다 「조절식」이 유용하다 — kg이 있어도 그쪽이 이긴다', () => {
    expect(productBadge({ name: 'a', url: 'u', kg: 20, weight: 'adjustable' })).toBe('조절식');
  });

  it('무게를 모르면 null — 빈 자리로 남겨야 목록 정렬이 안 흔들린다', () => {
    expect(productBadge({ name: 'a', url: 'u' })).toBeNull();
    expect(productBadge({ name: 'a', url: 'u', weight: 'light' })).toBeNull();
  });
});

describe('SHARE_LINKS 데이터', () => {
  const all = Object.values(SHARE_LINKS).flatMap((list) => list ?? []);

  it('이름에 kg을 남기지 않는다 — 배지가 말하는 것을 이름이 또 말하면 같은 줄에 두 번 뜬다', () => {
    // 조절식만 예외다. 배지가 「조절식」이라 최대 무게를 이름에서 잃으면 같은 제품군이 구분되지 않는다.
    const leaked = all.filter((p) => p.weight !== 'adjustable' && /\d\s*kg/i.test(p.name));
    expect(leaked.map((p) => p.name)).toEqual([]);
  });

  it('무게 구간이 있으면 kg도 있다 — 구간만 있고 숫자가 없으면 배지가 빈다', () => {
    const missing = all.filter((p) => p.weight && p.weight !== 'adjustable' && p.kg === undefined);
    expect(missing.map((p) => p.name)).toEqual([]);
  });

  it('링크는 전부 발급 주소(toss.im/_m/)다 — 상품 페이지 주소를 넣으면 수익이 0으로 잡힌다', () => {
    const bad = all.filter((p) => !p.url.startsWith('https://toss.im/_m/'));
    expect(bad.map((p) => p.url)).toEqual([]);
  });

  it('링크가 중복되지 않는다 — 같은 상품이 두 줄로 뜨면 고르는 사람이 헷갈린다', () => {
    const urls = all.map((p) => p.url);
    expect(urls.length).toBe(new Set(urls).size);
  });
});

/**
 * 같은 링크가 **코드와 문서 두 곳에** 산다 — 코드는 앱이 읽고, 문서는 사람이 점검할 때 읽는다.
 * 두 벌을 손으로 맞추면 반드시 어긋나고, **어긋난 쪽이 문서면 죽은 링크를 영영 못 찾는다**
 * (점검은 문서를 보고 하기 때문이다). 그래서 여기서 묶는다.
 *
 * ⚠️ **「반영된 링크」 절만 본다.** 수집함은 아직 코드에 안 들어간 것을 담는 자리라,
 * 거기까지 세면 붙여넣는 순간 빨간불이 켜져 계측기가 못 쓰게 된다.
 */
describe('기구 문서 ↔ shareLinks.ts', () => {
  /** ⚠️ 파일명이 키와 다른 것이 있다(`pullupBar` → `pullup-bar.md`). 이 표가 그 유일한 대응이다. */
  const DOCS: Record<string, string> = {
    dumbbell: 'dumbbell.md',
    kettlebell: 'kettlebell.md',
    bench: 'bench.md',
    band: 'band.md',
    pullupBar: 'pullup-bar.md',
  };
  const DIR = fileURLToPath(new URL('../../../docs/sharelinks/', import.meta.url));

  it.each(Object.entries(DOCS))('%s 문서의 링크가 코드와 순서까지 같다', (key, file) => {
    const md = readFileSync(DIR + file, 'utf8');
    // `### `는 안 걸린다 — `^## ` 는 세 번째 글자가 공백이어야 매치한다.
    const section = md.split(/^## /m).find((s) => s.startsWith('반영된 링크')) ?? '';
    const inDoc = section.match(/https:\/\/toss\.im\/_m\/\w+/g) ?? [];
    expect(inDoc).toEqual((SHARE_LINKS[key as EquipKey] ?? []).map((p) => p.url));
  });
});

describe('BAND_KO', () => {
  it('네 구간에 모두 라벨이 있다 — 빠지면 칩에 영어 키가 그대로 뜬다', () => {
    expect(Object.keys(BAND_KO).sort()).toEqual(['adjustable', 'heavy', 'light', 'medium']);
  });
});
