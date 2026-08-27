import type { IconName } from '../components/Icon';
import { EQUIPMENT, GROUP_KEYS, UNIT_KEYS, type EquipKey, type MuscleGroup, type Unit } from './exercises';

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

/**
 * 부위·유닛 라벨을 **한 맵에** 둔다 — 기록 화면이 둘을 구분하지 않고 저장된 값 그대로 그린다.
 *
 * 2분할 이전 기록은 「가슴」, 이후 기록은 「상체」로 섞여 보인다. 사실 그대로라 허용한다 —
 * 구 기록을 유닛 이름으로 고쳐 쓰면 하지도 않은 운동을 했다고 적는 셈이다.
 *
 * ⚠️ **`legs`는 「다리」이지 「하체」가 아니다.** 유닛 `lower`가 「하체」를 가져갔으므로 둘 다
 * 「하체」로 두면 기록 화면에서 **구 부위 기록과 새 유닛 기록이 구별되지 않는다** — 구 기록의
 * 그것은 다리만 한 날이고 새 기록의 「하체」는 다리+코어라, 같은 말로 적으면 거짓이 된다.
 */
export const GROUP_KO: Record<MuscleGroup | Unit, string> = {
  chest: '가슴', back: '등', shoulders: '어깨', arms: '팔', legs: '다리', core: '코어',
  upper: '상체', lower: '하체',
};

export const LEVEL_KO = { beginner: '초급', intermediate: '중급', expert: '고급' } as const;

/** 어휘가 늘었는데 라벨을 빠뜨리면 화면에 영어 키가 그대로 뜬다. 그걸 여기서 막는다. */
export const MISSING_LABELS = [
  ...EQUIPMENT.filter((k) => !EQUIPMENT_KO[k]),
  ...GROUP_KEYS.filter((k) => !GROUP_KO[k]),
  ...UNIT_KEYS.filter((k) => !GROUP_KO[k]),
];
