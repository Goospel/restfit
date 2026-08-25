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
  bench: '벤치', exerciseBall: '짐볼', foamRoller: '폼롤러', medicineBall: '메디신볼', abRoller: '복근롤러',
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
