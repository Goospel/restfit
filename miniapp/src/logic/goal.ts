import type { Exercise } from '../data/exercises';

/**
 * 운동 목적. **반복 횟수·휴식 길이·종목 수를 한꺼번에 정한다.**
 *
 * 값은 운동생리학의 표준 권장 구간에서 골랐다. 다만 체지방 감량은 권장이 30~60초인데
 * **아래쪽을 쓰면 안 된다** — `adPlan.MIN_REST_SECONDS`(40초)에 걸려 광고가 통째로
 * 사라진다. 그렇다고 광고 때문에 늘리는 것도 금지다(「휴식 길이는 운동이 정한다」).
 * 그래서 **권장 구간 안에서 40초를 넘는 45초**를 골랐다. 이 불변식은 테스트로 못 박았다.
 *
 * 짧게 쉬는 목적은 종목을 늘려 세션 길이를 지킨다 — 그 결과 휴식 **횟수**는 체지방
 * 감량이 더 많다(4종목 11회 vs 3종목 8회).
 */
export type Goal = 'fatLoss' | 'muscle' | 'health';

export const GOAL_KEYS: readonly Goal[] = ['fatLoss', 'muscle', 'health'];

export type GoalSpec = {
  label: string;
  icon: string;
  /** 목적 선택 화면의 한 줄 설명 */
  desc: string;
  /** 목표 반복 [최소, 최대]. 화면 표시와 입력 기본값에 쓴다. */
  reps: [number, number];
  /** 고립 운동 휴식(초) */
  restIsolation: number;
  /** 복합 운동 휴식(초) — 여러 관절을 쓰니 회복이 더 걸린다 */
  restCompound: number;
  /**
   * 루틴에 넣을 종목 수 **상한**.
   *
   * ⚠️ 실제 개수는 이보다 적을 수 있다 — `pickRoutine`이 부위 안의 근육 수와
   * `MAX_PER_MUSCLE`(근육당 3개)로 한 번 더 조인다. 가슴처럼 근육이 하나인 부위는
   * 4를 넘겨도 3종목이 최대다. 그래서 화면 문구도 「최대 N종목」으로 쓴다.
   */
  exerciseCount: number;
};

export const GOALS: Record<Goal, GoalSpec> = {
  fatLoss: {
    label: '체지방 감량',
    icon: '🔥',
    desc: '짧게 쉬고 많이 움직입니다',
    reps: [12, 20],
    restIsolation: 45,
    restCompound: 60,
    exerciseCount: 4,
  },
  muscle: {
    label: '근육 키우기',
    icon: '💪',
    desc: '충분히 회복하고 무겁게 듭니다',
    reps: [6, 12],
    restIsolation: 90,
    restCompound: 150,
    exerciseCount: 3,
  },
  health: {
    label: '건강 유지',
    icon: '🌿',
    desc: '무리 없이 꾸준하게',
    reps: [8, 15],
    restIsolation: 60,
    restCompound: 90,
    exerciseCount: 3,
  },
};

/**
 * 목적을 아직 안 고른 사람에게 쓰는 값.
 *
 * 「건강 유지」인 이유: 세 목적의 가운데라 어느 쪽으로 틀려도 덜 틀린다. 처음 쓰는 사람에게
 * 벌크업 휴식(90/150초)을 주면 세션이 길어 지루하고, 다이어트 반복(20회)을 주면 힘들다.
 */
export const DEFAULT_GOAL: Goal = 'health';

/** 저장소에서 읽은 값이 쓸 수 있는 목적인지. 옛 버전이 남긴 값이 들어올 수 있다. */
export function isGoal(v: unknown): v is Goal {
  return typeof v === 'string' && (GOAL_KEYS as readonly string[]).includes(v);
}

/** 횟수 입력칸의 기본값. 직전 기록이 없을 때만 쓴다. */
export function midReps(goal: Goal): number {
  const [lo, hi] = GOALS[goal].reps;
  return Math.round((lo + hi) / 2);
}

/**
 * 이 mechanic의 휴식 길이(초).
 *
 * ⚠️ `mechanic`이 `null`인 종목이 원본 데이터에 있다. 복합으로 치면 쉬는 시간이 과하게
 * 늘어나므로 **고립으로 친다**.
 */
export function restSecondsForGoal(mechanic: Exercise['mechanic'], goal: Goal): number {
  const spec = GOALS[goal];
  return mechanic === 'compound' ? spec.restCompound : spec.restIsolation;
}
