import { describe, expect, it } from 'vitest';

import { BAND_KO, filterByBand, productBands, type Product } from './shareLinks';

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

describe('BAND_KO', () => {
  it('네 구간에 모두 라벨이 있다 — 빠지면 칩에 영어 키가 그대로 뜬다', () => {
    expect(Object.keys(BAND_KO).sort()).toEqual(['adjustable', 'heavy', 'light', 'medium']);
  });
});
