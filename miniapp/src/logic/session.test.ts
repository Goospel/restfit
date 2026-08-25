import { describe, expect, it } from 'vitest';

import {
  completeSet,
  endRest,
  progress,
  restRemaining,
  restSecondsFor,
  SETS_PER_EXERCISE,
  skipExercise,
  startSession,
} from './session';
import type { Exercise } from '../data/exercises';

const ex = (id: string, mechanic: Exercise['mechanic'] = 'compound'): Exercise => ({
  id,
  name: id,
  nameEn: id,
  requires: [],
  category: 'strength',
  level: 'beginner',
  force: null,
  mechanic,
  primaryMuscles: ['chest'],
  secondaryMuscles: [],
  images: [],
});

const T = 1_000_000; // 기준 시각(ms)
const set = { weight: 20, reps: 10 };

/** 세트를 n번 완료하고 그때마다 휴식을 넘긴다. */
function run(s: ReturnType<typeof startSession>, n: number, now = T) {
  for (let i = 0; i < n; i++) {
    s = completeSet(s, set, now);
    if (!s.finished) s = endRest(s);
  }
  return s;
}

describe('restSecondsFor', () => {
  it('복합 운동은 길게 쉰다', () => {
    expect(restSecondsFor(ex('a', 'compound'))).toBe(90);
  });

  it('고립 운동은 짧게 쉰다', () => {
    expect(restSecondsFor(ex('a', 'isolation'))).toBe(60);
  });

  it('분류가 없으면 짧은 쪽으로 둔다', () => {
    expect(restSecondsFor(ex('a', null))).toBe(60);
  });

  it('모든 휴식이 광고를 틀 수 있는 길이다', () => {
    // 40초 미만이면 adPlan이 광고를 거른다. 휴식이 그보다 짧으면 수익 슬롯이 통째로 사라진다.
    for (const m of ['compound', 'isolation', null] as const) expect(restSecondsFor(ex('a', m))).toBeGreaterThanOrEqual(40);
  });
});

describe('startSession', () => {
  it('첫 운동 첫 세트에서 시작한다', () => {
    const s = startSession([ex('a'), ex('b')]);
    expect(s.index).toBe(0);
    expect(s.done).toEqual([[], []]);
    expect(s.restEndsAt).toBeNull();
    expect(s.finished).toBe(false);
  });

  it('운동이 없으면 시작하자마자 끝난 상태다', () => {
    expect(startSession([]).finished).toBe(true);
  });
});

describe('completeSet', () => {
  it('세트를 기록하고 휴식을 시작한다', () => {
    const s = completeSet(startSession([ex('a')]), set, T);
    expect(s.done[0]).toEqual([set]);
    expect(s.restEndsAt).toBe(T + 90_000);
  });

  it('휴식 길이는 방금 한 운동이 정한다', () => {
    // 다음 운동이 아니라 직전 운동 기준이다.
    const s = run(startSession([ex('a', 'isolation'), ex('b', 'compound')]), SETS_PER_EXERCISE);
    expect(completeSet(s, set, T).restEndsAt).toBe(T + 90_000); // 이제 b(복합)를 하고 있다
  });

  it('마지막 운동 마지막 세트를 마치면 휴식 없이 끝난다', () => {
    // 끝나고 나서 90초를 세워 두면 사용자는 앱 앞에서 이유 없이 기다린다.
    const s = run(startSession([ex('a')]), SETS_PER_EXERCISE - 1);
    const last = completeSet(s, set, T);
    expect(last.finished).toBe(true);
    expect(last.restEndsAt).toBeNull();
  });

  it('중간 운동의 마지막 세트 뒤에는 휴식이 있다', () => {
    const s = run(startSession([ex('a'), ex('b')]), SETS_PER_EXERCISE - 1);
    const afterLastSetOfA = completeSet(s, set, T);
    expect(afterLastSetOfA.finished).toBe(false);
    expect(afterLastSetOfA.restEndsAt).toBe(T + 90_000);
  });

  it('끝난 세션에는 더 기록되지 않는다', () => {
    const done = run(startSession([ex('a')]), SETS_PER_EXERCISE);
    expect(completeSet(done, { weight: 99, reps: 99 }, T)).toEqual(done);
  });

  it('휴식 중에는 세트가 기록되지 않는다', () => {
    // 휴식 화면에서 버튼이 두 번 눌리는 사고를 막는다.
    const resting = completeSet(startSession([ex('a')]), set, T);
    expect(completeSet(resting, { weight: 99, reps: 99 }, T).done[0]).toEqual([set]);
  });

  it('입력 세션을 바꾸지 않는다', () => {
    const s = startSession([ex('a')]);
    completeSet(s, set, T);
    expect(s.done[0]).toEqual([]);
  });
});

describe('endRest', () => {
  it('휴식을 끝내면 같은 운동의 다음 세트로 간다', () => {
    const s = endRest(completeSet(startSession([ex('a')]), set, T));
    expect(s.restEndsAt).toBeNull();
    expect(s.index).toBe(0);
    expect(progress(s).setNo).toBe(2);
  });

  it('정해진 세트를 다 채웠으면 다음 운동으로 넘어간다', () => {
    const s = run(startSession([ex('a'), ex('b')]), SETS_PER_EXERCISE);
    expect(s.index).toBe(1);
    expect(progress(s).setNo).toBe(1);
  });

  it('휴식 중이 아니면 아무 일도 없다', () => {
    const s = startSession([ex('a')]);
    expect(endRest(s)).toEqual(s);
  });
});

describe('skipExercise', () => {
  it('남은 세트를 버리고 다음 운동으로 간다', () => {
    // 기구가 없거나 부상이 있어 못 하는 운동을 만나면 세션 전체가 막히면 안 된다.
    const s = skipExercise(startSession([ex('a'), ex('b')]));
    expect(s.index).toBe(1);
    expect(s.restEndsAt).toBeNull();
  });

  it('마지막 운동을 건너뛰면 세션이 끝난다', () => {
    expect(skipExercise(startSession([ex('a')])).finished).toBe(true);
  });

  it('휴식 중에 건너뛰면 휴식도 함께 끝난다', () => {
    const s = skipExercise(completeSet(startSession([ex('a'), ex('b')]), set, T));
    expect(s.restEndsAt).toBeNull();
    expect(s.index).toBe(1);
  });
});

describe('restRemaining', () => {
  it('휴식 중이 아니면 0이다', () => {
    expect(restRemaining(startSession([ex('a')]), T)).toBe(0);
  });

  it('남은 초를 올림으로 준다', () => {
    // 내림하면 1초 남았을 때 0으로 보인다.
    const s = completeSet(startSession([ex('a')]), set, T);
    expect(restRemaining(s, T)).toBe(90);
    expect(restRemaining(s, T + 30_500)).toBe(60);
  });

  it('시간이 지났으면 음수가 아니라 0이다', () => {
    const s = completeSet(startSession([ex('a')]), set, T);
    expect(restRemaining(s, T + 999_999)).toBe(0);
  });
});

describe('progress', () => {
  it('몇 번째 운동 몇 번째 세트인지 1부터 센다', () => {
    const s = startSession([ex('a'), ex('b'), ex('c')]);
    expect(progress(s)).toEqual({ exerciseNo: 1, totalExercises: 3, setNo: 1, totalSets: SETS_PER_EXERCISE });
  });

  it('마지막 세트를 마치면 setNo가 총 세트 수를 넘지 않는다', () => {
    const s = run(startSession([ex('a')]), SETS_PER_EXERCISE);
    expect(progress(s).setNo).toBe(SETS_PER_EXERCISE);
  });
});
