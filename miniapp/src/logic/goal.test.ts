import { describe, expect, it } from 'vitest';

import { MIN_REST_SECONDS } from './adPlan';
import { DEFAULT_GOAL, GOAL_KEYS, GOALS, midReps, restSecondsForGoal } from './goal';

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

  it('체지방 감량이 운동 수가 더 많다', () => {
    // 휴식이 짧은 만큼 종목을 늘려 세션 길이와 광고 슬롯 수를 지킨다.
    expect(GOALS.fatLoss.exerciseCount).toBeGreaterThan(GOALS.muscle.exerciseCount);
  });

  it('라벨과 아이콘이 비어 있지 않다', () => {
    for (const key of GOAL_KEYS) {
      expect(GOALS[key].label.length, key).toBeGreaterThan(0);
      expect(GOALS[key].icon.length, key).toBeGreaterThan(0);
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
