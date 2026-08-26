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
 * 루틴 로테이션의 단위다. 17개로 돌리면 한 부위가 다시 오기까지 2주가 넘어가고,
 * 3개로 묶으면 매번 같은 운동이 나온다.
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
