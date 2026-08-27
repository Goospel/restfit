import type { IconName } from '../components/Icon';
import type { Exercise } from '../data/exercises';
// 타입만 가져온다 — 컴파일에서 지워지므로 `session`이 이 모듈을 도로 import 해도 순환이 안 생긴다.
import type { SetLog } from './session';

/**
 * 운동 목적. **반복 횟수·휴식 길이·종목 수를 한꺼번에 정한다.**
 *
 * 값은 운동생리학의 표준 권장 구간에서 골랐다. 다만 체지방 감량은 권장이 30~60초인데
 * **아래쪽을 쓰면 안 된다** — `adPlan.MIN_REST_SECONDS`(40초)에 걸려 광고가 통째로
 * 사라진다. 그렇다고 광고 때문에 늘리는 것도 금지다(「휴식 길이는 운동이 정한다」).
 * 그래서 **권장 구간 안에서 40초를 넘는 45초**를 골랐다. 이 불변식은 테스트로 못 박았다.
 *
 * 종목 수는 2분할 개편으로 **셋 다 4로 통일**됐다(설계 §3.8.4 — 상체 4부위 커버리지).
 * 세션 길이는 짧게 쉬는 목적이 여전히 짧다 — 휴식 길이가 다르기 때문이다.
 */
export type Goal = 'fatLoss' | 'muscle' | 'health';

export const GOAL_KEYS: readonly Goal[] = ['fatLoss', 'muscle', 'health'];

export type GoalSpec = {
  label: string;
  icon: IconName;
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
   * ⚠️ 실제 개수는 이보다 적을 수 있다 — `pickRoutine`이 유닛 안의 근육 수와
   * `MAX_PER_MUSCLE`(근육당 3개)로 한 번 더 조인다. 그래서 화면 문구도 「최대 N종목」으로 쓴다.
   *
   * ★ **세 목적 모두 4인 근거는 광고가 아니라 부위 커버리지다**(설계 §3.8.4). 상체 유닛은
   * 부위가 넷(가슴·등·어깨·팔)이라, 2단 라운드로빈의 첫 라운드에서 부위마다 하나씩 나가려면
   * 종목이 넷이어야 한다. 3종목이면 매 상체 세션마다 한 부위가 결번이라 그 부위의 주간
   * 세트가 최소선(주 4세트)을 밑돈다. 슬롯이 8→11로 는 것은 그 결정의 **부수 효과**이지
   * 이유가 아니다 — 「휴식 길이·횟수는 운동이 정한다」는 규율은 그대로다.
   */
  exerciseCount: number;
};

export const GOALS: Record<Goal, GoalSpec> = {
  fatLoss: {
    label: '체지방 감량',
    icon: 'flame',
    desc: '짧게 쉬고 많이 움직입니다',
    reps: [12, 20],
    restIsolation: 45,
    restCompound: 60,
    exerciseCount: 4,
  },
  muscle: {
    label: '근육 키우기',
    icon: 'plate',
    desc: '충분히 회복하고 무겁게 듭니다',
    reps: [6, 12],
    restIsolation: 90,
    restCompound: 150,
    exerciseCount: 4,
  },
  health: {
    label: '건강 유지',
    icon: 'sprout',
    desc: '무리 없이 꾸준하게',
    reps: [8, 15],
    restIsolation: 60,
    restCompound: 90,
    exerciseCount: 4,
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
 * 맨몸 운동의 「동작을 바꿀 때」 컷(회).
 *
 * 반복 25~30회를 넘기면 근비대 효율이 급락한다(리서치 맨몸 사다리 3). 기구는 무게를 얹으면
 * 되지만 맨몸은 얹을 데가 없어서, 이 지점부터는 **더 어려운 동작**이 유일한 진행 수단이다.
 */
export const BODYWEIGHT_LADDER_REPS = 25;

/**
 * 다음 세트의 입력 기본값 — **double progression**(설계 §3.7).
 *
 * 「지난번 **모든** 세트가 목표 상단에 닿았으면 한 단 올린다」. 문헌(Plotkin 2022)과
 * 실무(StrongLifts +2.5kg)의 교차점이다.
 *
 * ⚠️ **「모든 세트」가 규칙이다.** 「한 세트라도」로 느슨해지면 첫 세트만 잘 나온 날에 승급해,
 * 다음 주 내내 못 드는 무게가 기본값으로 떠 있는다.
 *
 * ⚠️ **무게를 올리면 횟수는 하단으로 되돌린다.** 안 되돌리면 무게만 계속 올라 곧 벽에 박는다 —
 * 「무게↑ → 횟수를 다시 쌓아 올림」의 왕복이 이 규칙의 전부다.
 *
 * ⚠️ 맨몸은 상단 **초과를 허용**한다. 얹을 무게가 없으니 되돌릴 곳도 없다.
 *
 * 이 값은 **입력칸 기본값일 뿐**이다 — 루틴 선발·세션 상태 기계는 이 함수를 모른다.
 *
 * @param lastSets 지난번 그 운동의 세트 전부(`lastSetsOf`). 비면 처음 하는 운동이다.
 * @param bodyweight 맨몸인가(`requires`가 비었는가).
 * @param defaultWeight 기록이 없을 때 쓸 무게(`defaultWeightFor`) — 보유 기구를 아는 쪽이 넘긴다.
 */
export function suggestNext(
  lastSets: readonly SetLog[],
  goal: Goal,
  bodyweight: boolean,
  defaultWeight: number,
): SetLog {
  const last = lastSets[lastSets.length - 1];
  if (!last) return { weight: defaultWeight, reps: midReps(goal) };

  const [lo, hi] = GOALS[goal].reps;
  // 경계는 **포함**이다 — 상단을 정확히 채운 것이 곧 목표 달성이다.
  if (!lastSets.every((s) => s.reps >= hi)) return last;

  return bodyweight ? { weight: last.weight, reps: last.reps + 1 } : { weight: last.weight + 2.5, reps: lo };
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
