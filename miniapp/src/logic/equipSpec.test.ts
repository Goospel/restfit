import { describe, expect, it } from 'vitest';

import {
  BENCH_OPTIONS,
  defaultWeightFor,
  effectiveOwned,
  PICKABLE,
  WEIGHED,
  WEIGHT_OPTIONS,
  type EquipSpec,
} from './equipSpec';
import { EQUIPMENT, type EquipKey } from '../data/exercises';

describe('WEIGHT_OPTIONS', () => {
  it('무게를 묻는 기구마다 선택지가 있다', () => {
    for (const k of WEIGHED) expect(WEIGHT_OPTIONS[k].length, k).toBeGreaterThan(1);
  });

  it('모든 기구에 「모름」이 있고, 그것만 kg이 비어 있다', () => {
    // 「모름」은 정상 경로다 — 기준을 모르는 사람이 많아서 넣었고(밴드가 대표적),
    // 고르면 기본값을 안 채울 뿐 앱은 그대로 돈다.
    for (const k of WEIGHED) {
      const opts = WEIGHT_OPTIONS[k];
      expect(opts.filter((o) => o.kg === null).map((o) => o.key), k).toEqual(['unknown']);
    }
  });

  it('대표 무게가 기구마다 다르다', () => {
    // 덤벨 15kg은 무겁고 바벨 15kg은 가볍다. 한 테이블로 뭉치면 기본값이 엉뚱해진다.
    const heavy = WEIGHED.map((k) => WEIGHT_OPTIONS[k].find((o) => o.key === 'heavy')?.kg);
    expect(new Set(heavy).size).toBeGreaterThan(1);
  });

  it('대표 무게가 가벼움 < 보통 < 무거움 순이다', () => {
    for (const k of WEIGHED) {
      const kg = (key: string) => WEIGHT_OPTIONS[k].find((o) => o.key === key)?.kg ?? 0;
      expect(kg('light'), k).toBeLessThan(kg('medium'));
      expect(kg('medium'), k).toBeLessThan(kg('heavy'));
    }
  });
});

describe('defaultWeightFor', () => {
  it('요구 기구의 보유 무게를 기본값으로 준다', () => {
    // 지금은 처음 하는 운동이면 0kg으로 시작한다. 아는 무게가 있으면 거기를 채운다.
    const spec: EquipSpec = { dumbbell: 'medium' };
    expect(defaultWeightFor(['dumbbell'], spec)).toBe(10);
  });

  it('기구마다 다른 대표값을 쓴다', () => {
    expect(defaultWeightFor(['barbell'], { barbell: 'medium' })).toBe(35);
    expect(defaultWeightFor(['dumbbell'], { dumbbell: 'medium' })).toBe(10);
  });

  it('「모름」이면 0 — 아는 척하지 않는다', () => {
    expect(defaultWeightFor(['dumbbell'], { dumbbell: 'unknown' })).toBe(0);
  });

  it('스펙을 안 적었으면 0', () => {
    expect(defaultWeightFor(['dumbbell'], {})).toBe(0);
  });

  it('맨몸 운동은 0', () => {
    expect(defaultWeightFor([], { dumbbell: 'heavy' })).toBe(0);
  });

  it('무게를 안 묻는 기구만 쓰는 운동도 0', () => {
    // 풀업바·벤치에는 무게 개념이 없다.
    expect(defaultWeightFor(['pullupBar', 'bench'], { dumbbell: 'heavy' })).toBe(0);
  });

  it('벤치와 함께 쓰는 운동은 프리웨이트 쪽 무게를 본다', () => {
    expect(defaultWeightFor(['dumbbell', 'benchAdjustable'], { dumbbell: 'heavy' })).toBe(20);
  });
});

describe('effectiveOwned', () => {
  it('조절식 벤치면 평벤치 운동도 할 수 있다', () => {
    // 데이터에서 인클라인은 benchAdjustable을 요구하고 평벤치 운동은 bench를 요구한다.
    // 조절식을 가진 사람은 **둘 다** 되므로 여기서 두 키를 함께 세운다.
    const out = effectiveOwned(['bench'], { bench: 'adjustable' });
    expect(out).toContain('bench');
    expect(out).toContain('benchAdjustable');
  });

  it('평벤치면 조절식이 서지 않는다', () => {
    // 이게 이 기능의 존재 이유다 — 평벤치만 가진 사람에게 인클라인이 나오면 안 된다.
    expect(effectiveOwned(['bench'], { bench: 'flat' })).not.toContain('benchAdjustable');
  });

  it('「모름」이면 안전하게 평벤치로 친다', () => {
    // 모른다고 답한 사람이 못 하는 운동을 받는 쪽이, 할 수 있는 운동을 못 받는 쪽보다 나쁘다.
    expect(effectiveOwned(['bench'], { bench: 'unknown' })).not.toContain('benchAdjustable');
  });

  it('벤치 종류를 안 적었어도 평벤치로 친다', () => {
    expect(effectiveOwned(['bench'], {})).not.toContain('benchAdjustable');
  });

  it('벤치가 없으면 조절식도 없다', () => {
    // 벤치를 체크하지 않았는데 spec만 남아 있는 경우(체크를 껐다) 조절식이 살아남으면 안 된다.
    expect(effectiveOwned(['dumbbell'], { bench: 'adjustable' })).toEqual(['dumbbell']);
  });

  it('입력 배열을 바꾸지 않는다', () => {
    const owned: EquipKey[] = ['bench'];
    effectiveOwned(owned, { bench: 'adjustable' });
    expect(owned).toEqual(['bench']);
  });
});

describe('PICKABLE', () => {
  it('조절식 벤치는 목록에서 직접 고르지 않는다', () => {
    // 벤치 상세에서 정해진다. 목록에 따로 두면 「벤치」와 「각도 조절 벤치」가 나란히 떠 헷갈린다.
    expect(PICKABLE).not.toContain('benchAdjustable' as EquipKey);
  });

  it('나머지 기구는 전부 고를 수 있다', () => {
    expect(PICKABLE.length).toBe(EQUIPMENT.length - 1);
  });
});

describe('BENCH_OPTIONS', () => {
  it('평벤치·조절식·모름 세 갈래다', () => {
    expect(BENCH_OPTIONS.map((o) => o.key)).toEqual(['flat', 'adjustable', 'unknown']);
  });
});
