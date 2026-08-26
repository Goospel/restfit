import { EQUIPMENT, GROUP_KEYS, type EquipKey, type MuscleGroup } from './data/exercises';
import { isGoal, type Goal } from './logic/goal';
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
