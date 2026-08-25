import { groupOf, type EquipKey, type Exercise, type MuscleGroup } from '../data/exercises';
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

/** 부위를 고를 최소 운동 수. 이보다 적으면 하루치 루틴이 안 된다. */
const MIN_POOL = 3;

/**
 * 한 근육에서 뽑을 최대 운동 수.
 *
 * 없으면 부위 안에 근육이 하나뿐일 때(맨몸 팔 = 삼두뿐) 같은 근육만 5종목이 나온다.
 * 한 근육에 15세트는 과훈련이고, **그런 루틴은 사람을 떠나게 해서 광고 슬롯도 함께 사라진다.**
 */
const MAX_PER_MUSCLE = 3;

export type Routine = { group: MuscleGroup | null; exercises: Exercise[] };

/**
 * @param history 최근에 한 부위. **최근 것이 앞**이다.
 * @param seed 날짜 문자열.
 */
export function pickRoutine(
  exercises: Exercise[],
  owned: EquipKey[],
  history: MuscleGroup[],
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
  if (byGroup.size === 0) return { group: null, exercises: [] };

  const r = rng(seed);

  // 운동이 너무 적은 부위는 후보에서 뺀다 — 1개짜리 "루틴"은 루틴이 아니다.
  // 다만 **금지가 아니라 선호**다. 전부 걸러지면 있는 것 중에서라도 고른다.
  const rich = [...byGroup.keys()].filter((g) => byGroup.get(g)!.length >= MIN_POOL);
  // 가장 오래 전에 한 부위를 고른다. history에 없으면 무한히 오래된 것으로 친다.
  // 같은 부위가 여러 번 있으면 첫 번째(=가장 최근) 위치로 센다.
  const candidates = rich.length > 0 ? rich : [...byGroup.keys()];
  const staleness = (g: MuscleGroup) => {
    const i = history.indexOf(g);
    return i < 0 ? Infinity : i;
  };
  const oldest = Math.max(...candidates.map(staleness));
  const tied = candidates.filter((g) => staleness(g) === oldest);
  const group = tied.length === 1 ? tied[0] : shuffled(tied, r)[0];

  // 부위 안에서 근육별로 나눠 담고 돌아가며 하나씩 뽑는다.
  // 그냥 섞어서 5개를 뽑으면 대퇴사두만 5개 나오는 날이 생긴다.
  const buckets = new Map<string, Exercise[]>();
  for (const e of byGroup.get(group)!) {
    const m = e.primaryMuscles[0] ?? '';
    const bucket = buckets.get(m);
    if (bucket) bucket.push(e);
    else buckets.set(m, [e]);
  }
  const queues = shuffled([...buckets.keys()], r).map((m) => shuffled(buckets.get(m)!, r));

  const picked: Exercise[] = [];
  for (let round = 0; picked.length < count && round < MAX_PER_MUSCLE; round++) {
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

  return { group, exercises: picked };
}
