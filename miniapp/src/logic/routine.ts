import { groupOf, unitOf, type EquipKey, type Exercise, type MuscleGroup, type Unit } from '../data/exercises';
import { filterByEquipment } from './equipment';

/**
 * 오늘의 루틴. **규칙 기반이다 — LLM은 쓰지 않는다.**
 *
 * seed는 날짜다. 같은 날 재접속해도 루틴이 그대로여야 하기 때문에 난수를 쓰되 seed로 고정한다.
 */

/** FNV-1a — 날짜 문자열을 난수 시드로. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — 짧고 시드가 잘 퍼진다. 암호용이 아니라 루틴 섞기용이다. */
function rng(seed: string): () => number {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], r: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const LEVEL_ORDER = { beginner: 0, intermediate: 1, expert: 2 } as const;

/** 유닛을 고를 최소 운동 수. 이보다 적으면 하루치 루틴이 안 된다. */
const MIN_POOL = 3;

/**
 * 한 근육에서 뽑을 최대 운동 수.
 *
 * 없으면 부위 안에 근육이 하나뿐일 때(맨몸 팔 = 삼두뿐) 같은 근육만 5종목이 나온다.
 * 한 근육에 15세트는 과훈련이고, **그런 루틴은 사람을 떠나게 해서 광고 슬롯도 함께 사라진다.**
 */
const MAX_PER_MUSCLE = 3;

export type Routine = { unit: Unit | null; exercises: Exercise[] };

/**
 * 부위 하나에서 뽑을 순서 — 근육을 돌아가며 하나씩.
 *
 * 그냥 섞어서 뽑으면 대퇴사두만 넷 나오는 날이 생긴다. 근육당 `MAX_PER_MUSCLE`에서 끊는다.
 */
function muscleRoundRobin(list: Exercise[], r: () => number): Exercise[] {
  const buckets = new Map<string, Exercise[]>();
  for (const e of list) {
    const m = e.primaryMuscles[0] ?? '';
    const bucket = buckets.get(m);
    if (bucket) bucket.push(e);
    else buckets.set(m, [e]);
  }
  const queues = shuffled([...buckets.keys()], r).map((m) => shuffled(buckets.get(m)!, r));

  const out: Exercise[] = [];
  for (let round = 0; round < MAX_PER_MUSCLE; round++) {
    for (const q of queues) if (round < q.length) out.push(q[round]);
  }
  return out;
}

/**
 * @param history 최근에 한 **유닛**. **최근 것이 앞**이다.
 * @param seed 날짜 문자열.
 */
export function pickRoutine(
  exercises: Exercise[],
  owned: EquipKey[],
  history: Unit[],
  seed: string,
  count = 5,
): Routine {
  // 근력만 고른다 — 스트레칭·유산소에는 세트와 휴식이 없고, 휴식이 없으면 광고 자리도 없다.
  const available = filterByEquipment(exercises, owned).filter((e) => e.category === 'strength');

  const byGroup = new Map<MuscleGroup, Exercise[]>();
  for (const e of available) {
    const g = groupOf(e);
    if (!g) continue;
    const bucket = byGroup.get(g);
    if (bucket) bucket.push(e);
    else byGroup.set(g, [e]);
  }
  if (byGroup.size === 0) return { unit: null, exercises: [] };

  // 유닛 → 그 유닛에서 쓸 수 있는 부위들.
  const byUnit = new Map<Unit, MuscleGroup[]>();
  for (const g of byGroup.keys()) {
    const u = unitOf(g);
    const bucket = byUnit.get(u);
    if (bucket) bucket.push(g);
    else byUnit.set(u, [g]);
  }

  const r = rng(seed);

  /*
   * ★ **이 로테이션이 곧 회복 게이트다** — 별도의 48h 게이트 코드를 만들지 않은 이유가 여기다.
   *
   * 하루 1유닛 × 가장 오래된 유닛 우선이라, 유닛이 둘뿐이면 어제 유닛(staleness 0)은
   * 구조적으로 재선정되지 않는다. 매일 쓰는 사용자에게 상/하체가 격일로 번갈아 나와
   * 같은 근육의 재방문이 달력일 기준 2일 — **24h 하드 컷을 항상 웃돈다**(설계 §3.3).
   * 시각까지 따지면 최악 ~36h로 48h 권장선을 살짝 밑돌 수 있으나, 격일 상/하체(ULUL…)는
   * 문헌·실무 양쪽의 표준 프로그램이다.
   *
   * ⚠️ **후임 세션에게**: 그러니 회복 게이트를 여기 덧붙이지 마라. 발동 케이스가 없어서
   * 상태만 늘고 「오늘은 쉬는 날」로 운동하러 온 사람을 돌려보내는 화면이 딸려 온다.
   * 이 보장은 routine.test의 「어제 한 유닛은 절대 다시 고르지 않는다」로 못 박혀 있다.
   */
  const poolSize = (u: Unit) => byUnit.get(u)!.reduce((n, g) => n + byGroup.get(g)!.length, 0);
  // 운동이 너무 적은 유닛은 후보에서 뺀다 — 1개짜리 "루틴"은 루틴이 아니다.
  // 다만 **금지가 아니라 선호**다. 전부 걸러지면 있는 것 중에서라도 고른다.
  const rich = [...byUnit.keys()].filter((u) => poolSize(u) >= MIN_POOL);
  // 가장 오래 전에 한 유닛을 고른다. history에 없으면 무한히 오래된 것으로 친다.
  // 같은 유닛이 여러 번 있으면 첫 번째(=가장 최근) 위치로 센다.
  const candidates = rich.length > 0 ? rich : [...byUnit.keys()];
  const staleness = (u: Unit) => {
    const i = history.indexOf(u);
    return i < 0 ? Infinity : i;
  };
  const oldest = Math.max(...candidates.map(staleness));
  const tied = candidates.filter((u) => staleness(u) === oldest);
  const unit = tied.length === 1 ? tied[0] : shuffled(tied, r)[0];

  /*
   * 유닛 안은 **부위 → 근육 2단 라운드로빈**이다.
   *
   * 상체는 근육 버킷이 9개(가슴·광배·등중앙·승모·허리·어깨·이두·삼두·전완)라, 근육을
   * 평평하게 섞으면 어느 날은 등 계열만 넷 뽑히는 "사실상 등 데이"가 난다 — 부위당 빈도
   * 보장이 기대값으로만 성립하고 확정이 아니게 된다. 바깥 라운드 0에서 부위마다 하나씩
   * 나가게 두면 4종목 상체 세션이 4부위를 **전부** 커버한다(설계 §3.8.4).
   */
  const queues = shuffled(byUnit.get(unit)!, r).map((g) => muscleRoundRobin(byGroup.get(g)!, r));

  const picked: Exercise[] = [];
  for (let round = 0; picked.length < count; round++) {
    const before = picked.length;
    for (const q of queues) {
      if (picked.length >= count) break;
      if (round < q.length) picked.push(q[round]);
    }
    if (picked.length === before) break; // 모든 큐가 바닥났다
  }

  // 복합 운동을 앞에 — 지친 상태로 복합 운동을 하면 자세가 무너진다. 그다음 쉬운 것부터.
  picked.sort(
    (a, b) =>
      Number(a.mechanic === 'isolation') - Number(b.mechanic === 'isolation') ||
      LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level],
  );

  return { unit, exercises: picked };
}
