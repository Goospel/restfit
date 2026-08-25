import type { Exercise } from '../data/exercises';

/**
 * 운동 세션 상태 기계. 순수 함수 — 시각은 항상 인자로 받는다.
 *
 * 화면이 여기 기대는 것은 세 가지다: **지금 뭘 하는가 / 쉬는 중인가 / 얼마나 남았는가.**
 * 광고는 「쉬는 중인가」에만 붙는다.
 */

/** 운동당 세트 수. 홈트 표준. */
export const SETS_PER_EXERCISE = 3;

export type SetLog = { weight: number; reps: number };

export type Session = {
  exercises: Exercise[];
  /** 운동별 완료 세트. `exercises`와 길이가 같다. */
  done: SetLog[][];
  index: number;
  /** 휴식 종료 **시각**(ms). null이면 휴식 중이 아니다. */
  restEndsAt: number | null;
  finished: boolean;
};

/**
 * 방금 마친 운동의 휴식 길이(초).
 *
 * 복합 운동은 여러 관절을 쓰니 회복이 더 걸린다. **둘 다 40초를 넘겨야 한다** —
 * 그보다 짧으면 `adPlan`이 광고를 거르고 수익 슬롯이 통째로 사라진다(테스트로 못 박음).
 */
export function restSecondsFor(e: Exercise): number {
  return e.mechanic === 'compound' ? 90 : 60;
}

export function startSession(exercises: Exercise[]): Session {
  return {
    exercises,
    done: exercises.map(() => []),
    index: 0,
    restEndsAt: null,
    finished: exercises.length === 0,
  };
}

/** 세트 하나를 기록한다. 마지막 세트가 아니면 휴식이 시작된다. */
export function completeSet(s: Session, log: SetLog, now: number): Session {
  // 휴식 중 기록을 막는다 — 휴식 화면에서 버튼이 두 번 눌리는 사고가 실제로 난다.
  if (s.finished || s.restEndsAt !== null) return s;

  const done = s.done.map((sets, i) => (i === s.index ? [...sets, log] : sets));
  const lastSet = done[s.index].length >= SETS_PER_EXERCISE;
  const lastExercise = s.index >= s.exercises.length - 1;

  // 세션이 끝났는데 휴식을 세워 두면 사용자는 앱 앞에서 이유 없이 기다린다.
  if (lastSet && lastExercise) return { ...s, done, restEndsAt: null, finished: true };

  return { ...s, done, restEndsAt: now + restSecondsFor(s.exercises[s.index]) * 1000 };
}

/** 휴식을 끝낸다. 세트를 다 채웠으면 다음 운동으로 넘어간다. */
export function endRest(s: Session): Session {
  if (s.restEndsAt === null) return s;
  const moveOn = s.done[s.index].length >= SETS_PER_EXERCISE;
  return { ...s, restEndsAt: null, index: moveOn ? s.index + 1 : s.index };
}

/** 이 운동을 통째로 건너뛴다. 기구가 없거나 아픈 날에 세션 전체가 막히면 안 된다. */
export function skipExercise(s: Session): Session {
  if (s.finished) return s;
  const last = s.index >= s.exercises.length - 1;
  return { ...s, restEndsAt: null, index: last ? s.index : s.index + 1, finished: last };
}

/** 남은 휴식(초). 올림 — 내림하면 1초 남았을 때 화면에 0이 뜬다. */
export function restRemaining(s: Session, now: number): number {
  if (s.restEndsAt === null) return 0;
  return Math.max(0, Math.ceil((s.restEndsAt - now) / 1000));
}

export function progress(s: Session) {
  return {
    exerciseNo: Math.min(s.index + 1, s.exercises.length),
    totalExercises: s.exercises.length,
    setNo: Math.min((s.done[s.index]?.length ?? 0) + 1, SETS_PER_EXERCISE),
    totalSets: SETS_PER_EXERCISE,
  };
}
