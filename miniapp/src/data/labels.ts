import type { IconName } from '../components/Icon';
import { EQUIPMENT, GROUP_KEYS, type EquipKey, type MuscleGroup } from './exercises';

/** 화면에 그대로 뜨는 한글 라벨. 운동명은 데이터에 이미 한글로 들어 있다. */

export const MUSCLE_KO: Record<string, string> = {
  abdominals: '복근', hamstrings: '햄스트링', adductors: '내전근', quadriceps: '대퇴사두',
  biceps: '이두', shoulders: '어깨', chest: '가슴', 'middle back': '등 중앙', calves: '종아리',
  glutes: '둔근', 'lower back': '허리', lats: '광배근', triceps: '삼두', traps: '승모근',
  forearms: '전완근', neck: '목', abductors: '외전근',
};

export const EQUIPMENT_KO: Record<EquipKey, string> = {
  dumbbell: '덤벨', barbell: '바벨', kettlebell: '케틀벨', band: '밴드', pullupBar: '풀업바',
  bench: '벤치', benchAdjustable: '각도 조절 벤치', exerciseBall: '짐볼', foamRoller: '폼롤러', medicineBall: '메디신볼', abRoller: '복근롤러',
};

/**
 * 기구 → 아이콘. **라벨 바로 옆에 두는 이유는 같은 일을 하기 때문이다** — 데이터의 키를
 * 사람이 보는 것으로 바꾼다. 어휘가 늘면 둘 다 여기서 같이 챙긴다.
 *
 * 조절식 벤치는 평벤치와 같은 그림을 쓴다 — 고르는 목록(`PICKABLE`)에 없고, 화면에 뜰 때도
 * 「벤치」로 읽히면 충분하다.
 */
export const EQUIPMENT_ICON: Record<EquipKey, IconName> = {
  dumbbell: 'dumbbell', barbell: 'barbell', kettlebell: 'kettlebell', band: 'band', pullupBar: 'pullupBar',
  bench: 'bench', benchAdjustable: 'bench', exerciseBall: 'exerciseBall', foamRoller: 'foamRoller',
  medicineBall: 'medicineBall', abRoller: 'abRoller',
};

export const GROUP_KO: Record<MuscleGroup, string> = {
  chest: '가슴', back: '등', shoulders: '어깨', arms: '팔', legs: '하체', core: '코어',
};

export const LEVEL_KO = { beginner: '초급', intermediate: '중급', expert: '고급' } as const;

/** 어휘가 늘었는데 라벨을 빠뜨리면 화면에 영어 키가 그대로 뜬다. 그걸 여기서 막는다. */
export const MISSING_LABELS = [
  ...EQUIPMENT.filter((k) => !EQUIPMENT_KO[k]),
  ...GROUP_KEYS.filter((k) => !GROUP_KO[k]),
];
