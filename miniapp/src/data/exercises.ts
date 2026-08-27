import raw from './exercises.json';

/** 홈트 장비 어휘. `scripts/build-exercises.mjs`의 EQUIPMENT와 같아야 한다(데이터 테스트가 대조한다). */
export const EQUIPMENT = ['dumbbell', 'barbell', 'kettlebell', 'band', 'pullupBar', 'bench', 'benchAdjustable', 'exerciseBall', 'foamRoller', 'medicineBall', 'abRoller'] as const;
export type EquipKey = (typeof EQUIPMENT)[number];

export type Category = 'strength' | 'stretching' | 'plyometrics' | 'cardio' | 'powerlifting' | 'olympic weightlifting' | 'strongman';
export type Level = 'beginner' | 'intermediate' | 'expert';

export type Exercise = {
  id: string;
  /** 한글 이름. 화면에 그대로 뜬다. */
  name: string;
  /** 원문. 대조·검색용으로만 둔다. */
  nameEn: string;
  /** 이 운동에 **전부** 필요한 장비. 빈 배열이면 맨몸. */
  requires: EquipKey[];
  category: Category;
  level: Level;
  force: 'push' | 'pull' | 'static' | null;
  mechanic: 'compound' | 'isolation' | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  images: string[];
};

export const EXERCISES = raw as Exercise[];

/**
 * 부위 — 원본의 17개 근육을 6개로 묶는다.
 *
 * **선발의 단위다.** 로테이션의 단위는 이보다 위인 유닛(`Unit`)이다 — 6개로 돌렸더니
 * 부위당 주간 빈도가 0.33~0.5회로 빈도 문헌의 연구 범위(주 1~3회) 밖이었다(설계 §3.8.1).
 */
export const MUSCLE_GROUPS = {
  chest: ['chest'],
  back: ['lats', 'middle back', 'lower back', 'traps'],
  shoulders: ['shoulders', 'neck'],
  arms: ['biceps', 'triceps', 'forearms'],
  legs: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors'],
  core: ['abdominals'],
} as const;

export type MuscleGroup = keyof typeof MUSCLE_GROUPS;
export const GROUP_KEYS = Object.keys(MUSCLE_GROUPS) as MuscleGroup[];

const OF_MUSCLE = new Map<string, MuscleGroup>(
  GROUP_KEYS.flatMap((g) => MUSCLE_GROUPS[g].map((m) => [m, g] as const)),
);

/** 운동이 속한 부위. 첫 번째 주동근으로 정한다. 매핑에 없는 근육이면 `null`. */
export function groupOf(e: Exercise): MuscleGroup | null {
  for (const m of e.primaryMuscles) {
    const g = OF_MUSCLE.get(m);
    if (g) return g;
  }
  return null;
}

/**
 * 로테이션 유닛 — 6부위를 상체/하체 2분할로 묶는다.
 *
 * **왜 6이 아니라 2인가**: 부위당 주간 빈도가 6분할에서는 0.33~0.5회(주 2~3회 사용 기준)로
 * 근단백 합성 창(24~72h) 대비 무자극 기간이 11일을 넘었다. 2분할이면 전 사용 구간에서
 * 빈도가 ≥1회/주로 올라온다(설계 §3.8.2 실측 비교표).
 *
 * 전신 분할이 지표는 더 좋았지만 기각했다 — 연속일 사용 시 같은 근육이 24h 안에 겹쳐
 * **회복 게이트 코드가 따로 필요해진다.** 2분할은 로테이션 구조 자체가 그 보장을 한다(§3.3).
 */
export type Unit = 'upper' | 'lower';
export const UNIT_KEYS: readonly Unit[] = ['upper', 'lower'];

export const UNIT_OF: Record<MuscleGroup, Unit> = {
  chest: 'upper',
  back: 'upper',
  shoulders: 'upper',
  arms: 'upper',
  legs: 'lower',
  core: 'lower',
};

/**
 * 부위든 유닛이든 유닛으로 만든다.
 *
 * ⚠️ **유닛 값을 그대로 통과시키는 것이 이 함수의 절반이다.** 기록의 `group`에는 2분할
 * 이전에 저장된 부위(`'chest'`)와 이후의 유닛(`'upper'`)이 섞여 있다. 한쪽만 받으면
 * 배포 당일에 어제 기록이 로테이션에서 무시돼 **같은 근육을 이틀 연속** 준다.
 *
 * ⚠️ 조회는 `in`이 아니라 **인덱싱 + `??`**로 한다 — `in`은 프로토타입 체인까지 보므로
 * `'constructor'` 같은 키가 「부위」로 통과해 `undefined`를 유닛인 양 돌려준다.
 */
export function unitOf(v: MuscleGroup | Unit): Unit {
  return UNIT_OF[v as MuscleGroup] ?? (v as Unit);
}
