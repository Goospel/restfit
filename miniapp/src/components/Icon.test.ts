import { describe, expect, it } from 'vitest';

import { EQUIPMENT } from '../data/exercises';
import { EQUIPMENT_ICON } from '../data/labels';
import { FILLED_ICONS, ICONS } from './Icon';

describe('기구 아이콘', () => {
  it('모든 기구가 실제로 그려지는 아이콘을 가리킨다', () => {
    // 타입은 「이름이 존재한다」까지만 막는다. 이름만 있고 path가 비면 화면엔 빈 칸이 뜨는데,
    // 그건 컴파일을 통과한다. 여기서 막는다.
    for (const key of EQUIPMENT) {
      expect(ICONS[EQUIPMENT_ICON[key]]?.length, key).toBeGreaterThan(0);
    }
  });
});

describe('FILLED_ICONS', () => {
  it('면으로 채우는 아이콘의 path는 닫혀 있다', () => {
    // 열린 path를 채우면 브라우저가 제멋대로 이어 붙여 엉뚱한 면이 생긴다.
    // 선으로 그릴 땐 안 나던 문제라, 면으로 바꾸는 순간 조용히 깨진다.
    for (const name of FILLED_ICONS) {
      for (const d of ICONS[name]) {
        expect(d.trim().toLowerCase().endsWith('z'), `${name}: ${d.slice(0, 24)}…`).toBe(true);
      }
    }
  });

  it('선으로 그리는 아이콘이 대부분이다 — 면은 예외다', () => {
    // 면 아이콘이 늘어나면 선 아이콘 사이에서 무게가 안 맞는다. 늘릴 땐 의식하고 늘리라는 뜻.
    expect(FILLED_ICONS.size).toBeLessThan(Object.keys(ICONS).length / 2);
  });
});
