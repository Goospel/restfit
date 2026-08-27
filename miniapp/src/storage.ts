import { EQUIPMENT, GROUP_KEYS, type EquipKey, type MuscleGroup } from './data/exercises';
import { BAND_OPTIONS, BENCH_OPTIONS, WEIGHED, WEIGHT_OPTIONS, type EquipSpec } from './logic/equipSpec';
import { isGoal, type Goal } from './logic/goal';
import { isAvoidArea, isExperience, type Profile } from './logic/profile';
import type { SetLog } from './logic/session';

/**
 * localStorage 영속. **서버가 없으므로 여기가 유일한 저장소다.**
 *
 * 읽기는 전부 방어적이다 — 프라이빗 모드에서 저장소가 막히거나, 옛 버전이 남긴 형태가
 * 달라도 앱이 죽으면 안 된다. 죽는 대신 빈 값으로 시작한다.
 *
 * ⚠️ 기기를 바꾸면 기록이 날아간다. 클라우드 동기화는 의도적 보류(설계 §5).
 */

const OWNED_KEY = 'restfit.owned';
const HISTORY_KEY = 'restfit.history';
const GOAL_KEY = 'restfit.goal';
const SPEC_KEY = 'restfit.equipSpec';
const PROFILE_KEY = 'restfit.profile';

/** 기록 상한. 무한히 자라면 저장이 실패해 **그날 운동이 통째로 사라진다.** */
export const HISTORY_MAX = 400;

export type WorkoutRecord = {
  date: string;
  group: MuscleGroup;
  entries: {
    id: string;
    /** 이름을 함께 저장한다 — 데이터에서 운동이 빠져도 지난 기록은 읽을 수 있어야 한다. */
    name: string;
    sets: SetLog[];
  }[];
};

function read(key: string, storage: Storage): unknown {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown, storage: Storage): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장이 막혀도 화면은 계속 돈다. 계산된 값은 호출한 쪽이 그대로 쓴다.
  }
}

function remove(key: string, storage: Storage): void {
  try {
    storage.removeItem(key);
  } catch {
    // 읽기·쓰기와 같은 이유로 삼킨다.
  }
}

export function loadOwned(storage: Storage = localStorage): EquipKey[] {
  const v = read(OWNED_KEY, storage);
  if (!Array.isArray(v)) return [];
  // 어휘에 없는 값은 버린다 — 남겨 두면 그 장비를 요구하는 운동이 영영 안 나온다.
  return v.filter((k): k is EquipKey => EQUIPMENT.includes(k));
}

export function saveOwned(owned: EquipKey[], storage: Storage = localStorage): void {
  write(OWNED_KEY, owned, storage);
}

/**
 * 운동 목적. **`null`은 「아직 안 골랐다」는 뜻이고, 그게 온보딩을 띄울 유일한 근거다.**
 *
 * 여기서 기본값을 대신 돌려주면 온보딩을 한 사람과 안 한 사람이 구별되지 않는다.
 * 기본값(`DEFAULT_GOAL`)은 화면이 고르지, 저장소가 고르지 않는다.
 */
export function loadGoal(storage: Storage = localStorage): Goal | null {
  const v = read(GOAL_KEY, storage);
  // 옛 버전이 남긴 값이 들어오면 GOALS[goal]이 undefined가 되어 화면이 죽는다.
  return isGoal(v) ? v : null;
}

export function saveGoal(goal: Goal, storage: Storage = localStorage): void {
  write(GOAL_KEY, goal, storage);
}

/**
 * 운동 프로필(훈련 수준 · 불편 부위). **`null`은 「아직 안 물어봤다」는 뜻이다.**
 *
 * 기존 사용자는 여기가 계속 `null`이고, 그 상태에서는 개인화 경로를 통째로 건너뛴다 —
 * **업데이트가 그 사람의 오늘 루틴을 바꾸지 않는다**는 보증이 여기서 나온다.
 *
 * ⚠️ **`experience`가 어휘 밖이면 `avoid`가 멀쩡해도 프로필 전체를 버린다.** 기구 상세처럼
 * 필드별로 걸러 반쪽을 남기면 「불편 부위는 먹는데 난이도는 안 먹는」 상태가 조용히 생겨,
 * 나중에 루틴이 이상하다는 제보를 받았을 때 원인을 짚을 수가 없다. 반쪽 프로필은
 * 반쪽 개인화다. 반대로 `avoid`는 어휘 밖 값만 걸러낸다 — 부위 어휘가 바뀌었다고
 * 훈련 수준까지 날릴 이유는 없다.
 */
export function loadProfile(storage: Storage = localStorage): Profile | null {
  const v = read(PROFILE_KEY, storage);
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const { experience, avoid } = v as { experience?: unknown; avoid?: unknown };
  if (!isExperience(experience)) return null;
  return { experience, avoid: Array.isArray(avoid) ? avoid.filter(isAvoidArea) : [] };
}

export function saveProfile(profile: Profile, storage: Storage = localStorage): void {
  write(PROFILE_KEY, profile, storage);
}

/**
 * 온보딩을 안 한 상태로 되돌린다 — **목적과 기구를 함께 지운다.**
 *
 * 목적만 지우면 온보딩 1단계에 이미 고른 기구가 남아 첫 진입 경험이 재현되지 않는다.
 * 온보딩 화면을 고친 뒤 실기기에서 확인할 유일한 방법이라(폰에서는 localStorage를 손댈 수 없다)
 * 재현이 곧 이 함수의 목적이다. **운동 기록은 건드리지 않는다.**
 */
export function clearOnboarding(storage: Storage = localStorage): void {
  remove(GOAL_KEY, storage);
  remove(OWNED_KEY, storage);
  // 기구를 지우면서 상세만 남기면 안 가진 기구의 무게가 기본값으로 새어 나온다.
  remove(SPEC_KEY, storage);
  // 온보딩 2단계(경험·불편 부위)도 같은 이유로 지운다 — 남으면 그 단계가 이미
  // 답해진 채로 떠서 재현이 반쪽이 된다.
  remove(PROFILE_KEY, storage);
}

/**
 * 기구 상세(무게 구간 · 벤치 등판 · 밴드 강도).
 *
 * ⚠️ **키마다 허용 어휘가 다르다.** 한 벌로 검사하면 `bench: 'heavy'` 같은 값이 통과해
 * 화면이 조용히 어긋난다 — 무게 구간과 벤치 종류는 서로 다른 어휘다.
 */
const SPEC_VOCAB: Record<string, readonly string[]> = {
  ...Object.fromEntries(WEIGHED.map((k) => [k, WEIGHT_OPTIONS[k].map((o) => o.key)])),
  bench: BENCH_OPTIONS.map((o) => o.key),
  band: BAND_OPTIONS.map((o) => o.key),
};

export function loadEquipSpec(storage: Storage = localStorage): EquipSpec {
  const v = read(SPEC_KEY, storage);
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === 'string' && SPEC_VOCAB[k]?.includes(val)) out[k] = val;
  }
  return out as EquipSpec;
}

export function saveEquipSpec(spec: EquipSpec, storage: Storage = localStorage): void {
  write(SPEC_KEY, spec, storage);
}

function isRecord(v: unknown): v is WorkoutRecord {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as WorkoutRecord;
  return typeof r.date === 'string' && GROUP_KEYS.includes(r.group) && Array.isArray(r.entries);
}

export function loadHistory(storage: Storage = localStorage): WorkoutRecord[] {
  const v = read(HISTORY_KEY, storage);
  return Array.isArray(v) ? v.filter(isRecord) : [];
}

/** 오래된 것이 앞. 상한을 넘으면 앞에서 잘린다. */
export function appendRecord(rec: WorkoutRecord, storage: Storage = localStorage): WorkoutRecord[] {
  const next = [...loadHistory(storage), rec].slice(-HISTORY_MAX);
  write(HISTORY_KEY, next, storage);
  return next;
}

/** 이 운동을 마지막으로 했을 때의 마지막 세트. *"지난번 20kg × 10"* 에 쓴다. */
export function lastSetOf(history: WorkoutRecord[], exerciseId: string): SetLog | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i].entries.find((e) => e.id === exerciseId);
    if (entry?.sets.length) return entry.sets[entry.sets.length - 1];
  }
  return null;
}

/** `pickRoutine`이 받는 형태 — **최근 것이 앞**, 중복 제거. */
export function recentGroups(history: WorkoutRecord[]): MuscleGroup[] {
  const out: MuscleGroup[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    if (!out.includes(history[i].group)) out.push(history[i].group);
  }
  return out;
}

/**
 * 한국 시간 기준 `YYYY-MM-DD`. 루틴 seed이자 기록 키다.
 *
 * UTC로 자르면 한국의 오전 9시 이전이 전날로 찍혀 **날짜가 바뀌었는데 어제 루틴이 그대로 나온다.**
 * `sv-SE` 로케일이 `YYYY-MM-DD` 형태를 준다.
 *
 * ⚠️ `timeZone`이 인자인 이유는 **테스트를 위해서다.** 개발 기계가 한국 시간이라
 * 옵션을 통째로 빼도 결과가 같아 테스트가 공허해진다(돌연변이가 살아남아 발각됐다).
 * 다른 시간대를 넣었을 때 답이 달라지는지로 옵션이 실제로 쓰이는지 검증한다.
 */
export function todayKey(date: Date = new Date(), timeZone = 'Asia/Seoul'): string {
  return date.toLocaleDateString('sv-SE', { timeZone });
}
