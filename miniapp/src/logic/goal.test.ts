import { describe, expect, it } from 'vitest';

import { ICONS } from '../components/Icon';
import { MIN_REST_SECONDS } from './adPlan';
import { DEFAULT_GOAL, GOAL_KEYS, GOALS, midReps, restSecondsForGoal, suggestNext } from './goal';

describe('GOALS', () => {
  it('모든 목적의 휴식이 광고 하한을 넘는다', () => {
    // ★ 이 앱의 수익 전체가 걸린 불변식이다. 근거 권장치의 아래쪽(체지방 감량 30초)을
    //   그대로 쓰면 adPlan이 restTooShort로 광고를 통째로 거른다.
    for (const key of GOAL_KEYS) {
      expect(GOALS[key].restIsolation, key + ' 고립').toBeGreaterThanOrEqual(MIN_REST_SECONDS);
      expect(GOALS[key].restCompound, key + ' 복합').toBeGreaterThanOrEqual(MIN_REST_SECONDS);
    }
  });

  it('복합 운동이 고립보다 오래 쉰다', () => {
    // 여러 관절을 쓰면 회복이 더 걸린다. 뒤집히면 자세가 무너진 채로 다음 세트에 들어간다.
    for (const key of GOAL_KEYS) {
      expect(GOALS[key].restCompound, key).toBeGreaterThan(GOALS[key].restIsolation);
    }
  });

  it('반복 범위가 [최소, 최대] 순서이고 양수다', () => {
    for (const key of GOAL_KEYS) {
      const [lo, hi] = GOALS[key].reps;
      expect(lo, key).toBeGreaterThan(0);
      expect(hi, key).toBeGreaterThan(lo);
    }
  });

  it('루틴에 넣을 운동이 최소 1개는 된다', () => {
    for (const key of GOAL_KEYS) expect(GOALS[key].exerciseCount, key).toBeGreaterThanOrEqual(1);
  });

  it('기본 목적이 실재하는 키다', () => {
    expect(GOAL_KEYS).toContain(DEFAULT_GOAL);
  });

  it('목적마다 휴식이 다르다', () => {
    // 값이 겹치면 목적을 고를 이유가 화면에서 사라진다.
    const rests = GOAL_KEYS.map((k) => GOALS[k].restIsolation);
    expect(new Set(rests).size).toBe(GOAL_KEYS.length);
  });

  it('체지방 감량은 짧게 쉬고 많이 반복한다', () => {
    expect(GOALS.fatLoss.restIsolation).toBeLessThan(GOALS.muscle.restIsolation);
    expect(GOALS.fatLoss.reps[0]).toBeGreaterThan(GOALS.muscle.reps[0]);
  });

  it('체지방 감량이 운동 수가 적지는 않다', () => {
    // 원래는 「더 많다」였다. 상·하체 2분할로 바뀌면서 **상체 4부위를 매 세션 하나씩 커버**하려면
    // 종목이 4개여야 해서(설계 §3.8.4) 셋 다 4로 통일됐다 — 3종목이면 매번 한 부위가 결번이라
    // 상체 부위당 주간 세트가 최소선(주 4세트)을 밑돈다. 그래서 부등호를 ≥로 완화한다.
    // 뒤집히는 것(체지방 감량이 더 적어지는 것)은 여전히 금지다 — 짧게 쉬는 목적이 종목까지
    // 적으면 세션이 너무 짧아진다.
    expect(GOALS.fatLoss.exerciseCount).toBeGreaterThanOrEqual(GOALS.muscle.exerciseCount);
  });

  it('모든 목적이 4종목이다 — 상체 4부위 커버리지', () => {
    // ★ 이 숫자가 곧 「부위당 빈도 = 확정값」의 근거다(설계 §3.8.4). 하나라도 3으로 되돌아가면
    //   그 목적의 상체 세션에서 부위 하나가 매번 빠진다.
    for (const key of GOAL_KEYS) expect(GOALS[key].exerciseCount, key).toBe(4);
  });

  it('라벨이 비어 있지 않고, 아이콘이 실제로 그려지는 이름이다', () => {
    // 아이콘 이름을 오타 내거나 세트에서 지우면 화면에 빈 사각형이 뜬다. 그걸 여기서 막는다.
    for (const key of GOAL_KEYS) {
      expect(GOALS[key].label.length, key).toBeGreaterThan(0);
      expect(ICONS[GOALS[key].icon]?.length, key).toBeGreaterThan(0);
    }
  });
});

describe('midReps', () => {
  it('반복 범위 안의 값을 준다', () => {
    for (const key of GOAL_KEYS) {
      const [lo, hi] = GOALS[key].reps;
      const m = midReps(key);
      expect(m, key).toBeGreaterThanOrEqual(lo);
      expect(m, key).toBeLessThanOrEqual(hi);
    }
  });

  it('정수를 준다 — 횟수 입력칸에 그대로 들어간다', () => {
    for (const key of GOAL_KEYS) expect(Number.isInteger(midReps(key)), key).toBe(true);
  });
});

describe('restSecondsForGoal', () => {
  it('mechanic에 따라 고립/복합 값을 고른다', () => {
    expect(restSecondsForGoal('compound', 'muscle')).toBe(GOALS.muscle.restCompound);
    expect(restSecondsForGoal('isolation', 'muscle')).toBe(GOALS.muscle.restIsolation);
  });

  it('mechanic이 없으면 고립으로 친다', () => {
    // 원본 데이터에 mechanic이 비어 있는 종목이 있다. 복합으로 치면 쉬는 시간이 과하게 늘어난다.
    expect(restSecondsForGoal(null, 'fatLoss')).toBe(GOALS.fatLoss.restIsolation);
  });

  it('목적이 바뀌면 값도 바뀐다', () => {
    expect(restSecondsForGoal('isolation', 'fatLoss')).not.toBe(restSecondsForGoal('isolation', 'muscle'));
  });
});

describe('suggestNext — 졸업 프리필 (double progression)', () => {
  // muscle 6~12 / fatLoss 12~20. 상단에 닿았는지가 졸업 판정의 전부다.
  const set = (weight: number, reps: number) => ({ weight, reps });

  it('전 세트가 상단에 닿으면 무게를 2.5kg 올리고 횟수는 하단으로 되돌린다', () => {
    // ★ double progression의 핵심 — 횟수를 안 되돌리면 무게만 오르다 곧 못 드는 무게가 된다.
    expect(suggestNext([set(20, 12), set(20, 12), set(20, 12)], 'muscle', false, 0)).toEqual({ weight: 22.5, reps: 6 });
  });

  it('한 세트라도 상단에 못 닿으면 지난 마지막 세트 값 그대로다', () => {
    // ★ 「모든 세트」가 규칙이다. 「한 세트라도」로 느슨해지면 첫 세트만 잘 나온 날에 승급해
    //   다음 주 내내 못 드는 무게가 기본값으로 뜬다.
    expect(suggestNext([set(20, 12), set(20, 11), set(20, 12)], 'muscle', false, 0)).toEqual({ weight: 20, reps: 12 });
  });

  it('정확히 상단이면 도달이다 — 경계는 포함', () => {
    expect(suggestNext([set(20, 12)], 'muscle', false, 0).weight).toBe(22.5);
    expect(suggestNext([set(20, 11)], 'muscle', false, 0).weight).toBe(20);
  });

  it('맨몸은 무게 대신 횟수를 하나 올린다 — 상단 초과를 허용한다', () => {
    // 맨몸에 +2.5kg는 얹을 데가 없다. 하단으로 되돌리면 진행이 아니라 후퇴다.
    expect(suggestNext([set(0, 12), set(0, 13)], 'muscle', true, 0)).toEqual({ weight: 0, reps: 14 });
  });

  it('목적이 다르면 상단도 다르다 — muscle 12 · fatLoss 20', () => {
    // 같은 12회 기록이 muscle에서는 졸업, fatLoss에서는 아직이다. 상단을 상수로 박으면 이게 깨진다.
    const sets = [set(20, 12), set(20, 12)];
    expect(suggestNext(sets, 'muscle', false, 0).weight).toBe(22.5);
    expect(suggestNext(sets, 'fatLoss', false, 0)).toEqual({ weight: 20, reps: 12 });
    expect(suggestNext([set(20, 20), set(20, 20)], 'fatLoss', false, 0)).toEqual({ weight: 22.5, reps: 12 });
  });

  it('기록이 없으면 현행 기본값 — 넘겨받은 무게와 목적의 중간 횟수', () => {
    expect(suggestNext([], 'fatLoss', false, 10)).toEqual({ weight: 10, reps: midReps('fatLoss') });
  });
});
