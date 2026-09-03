import { groupOf, unitOf, type EquipKey, type Exercise, type Level, type MuscleGroup, type Unit } from '../data/exercises';
import { filterByEquipment } from './equipment';
import { isAvoided, type Experience, type Profile } from './profile';

/**
 * 오늘의 루틴. **규칙 기반이다 — LLM은 쓰지 않는다.**
 *
 * seed는 날짜다. 같은 날 재접속해도 루틴이 그대로여야 하기 때문에 난수를 쓰되 seed로 고정한다.
 */

/**
 * 직접 고른 운동으로 만든 **고정 루틴**. `pickRoutine`을 통째로 대신한다.
 *
 * 거르지 않는 것이 이 함수의 전부다 — 기구도 난이도도 불편 부위도 안 본다. 「풀업바를
 * 안 골랐으니 풀업은 뺀다」가 정확히 사용자가 막혔던 자리라(제보 2026-09-03), 여기서 한 번 더
 * 거르면 고르기 화면을 만든 이유가 사라진다. **고른 것이 곧 답이다.**
 *
 * 날짜도 안 본다 — 같은 종목을 꾸준히 해서 몸의 변화를 보겠다는 것이 이 모드의 요구다.
 * 로테이션이 회복 게이트 노릇을 하던 자리는 사용자 본인이 가져간다.
 *
 * @param ids 고른 순서. **그 순서가 곧 루틴 순서다.**
 */
export function customRoutine(exercises: Exercise[], ids: string[]): Routine {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const picked = ids.map((id) => byId.get(id)).filter((e): e is Exercise => e !== undefined);
  if (picked.length === 0) return { unit: null, exercises: [] };

  // 유닛은 **다수결**이다. 기록의 `group`은 그날 한 것을 말해야 하는데, 첫 운동으로 정하면
  // 「푸시업 하나 + 스쿼트 셋」이 상체로 적힌다. 동수면 상체 — 어느 쪽이든 절반은 거짓이라
  // 규칙을 하나로 고정해 두는 편이 낫다.
  const units = picked.map(groupOf).filter((g): g is MuscleGroup => g !== null).map(unitOf);
  const lower = units.filter((u) => u === 'lower').length;
  return { unit: lower > units.length / 2 ? 'lower' : 'upper', exercises: picked };
}

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
 * 부위가 **확정 슬롯**을 받을 최소 운동 수.
 *
 * 2단 라운드로빈의 첫 라운드는 부위마다 한 자리를 보장한다 — 그러니 종목이 하나뿐인 부위는
 * 그 한 종목이 매 세션 고정 배급된다. 하한을 2로 두면 최소한 번갈아 나오기라도 한다.
 */
const MIN_PER_GROUP = 2;

/**
 * 한 근육에서 뽑을 최대 운동 수.
 *
 * 없으면 부위 안에 근육이 하나뿐일 때(맨몸 팔 = 삼두뿐) 같은 근육만 5종목이 나온다.
 * 한 근육에 15세트는 과훈련이고, **그런 루틴은 사람을 떠나게 해서 광고 슬롯도 함께 사라진다.**
 */
const MAX_PER_MUSCLE = 3;

export type Routine = { unit: Unit | null; exercises: Exercise[] };

/**
 * 경험별 티어 순위 — **작을수록 먼저 뽑힌다.** 같은 순위끼리는 섞이고, 순위 간 순서는 고정이다.
 *
 * **제외가 아니라 선발 순서인 이유**(설계 §3.4): 맨몸 근력은 57종뿐이고 부위 편중이 심하다 —
 * 등 0종, 어깨는 상급 1종이 전부다. 난이도를 하드 필터로 만들면 맨몸 사용자의 풀이 비어
 * **폴백 규칙을 따로 지어야 한다.** 선호 정렬은 풀이 넉넉하면 필터처럼 동작하고(상급 26/408은
 * 초보에게 사실상 안 나온다), 마르면 자연히 다음 티어로 넘어간다 — **폴백이 규칙에 내장**된다.
 *
 * ⚠️ `advanced` 줄만 순서가 뒤집혀 있다(초급이 꼴찌). 오타가 아니라 표 그대로다.
 */
const TIER_RANK: Record<Experience, Record<Level, number>> = {
  beginner: { beginner: 0, intermediate: 1, expert: 2 },
  intermediate: { beginner: 0, intermediate: 0, expert: 1 },
  advanced: { beginner: 1, intermediate: 0, expert: 0 },
};

/**
 * 부위 하나에서 뽑을 순서 — 근육을 돌아가며 하나씩.
 *
 * 그냥 섞어서 뽑으면 대퇴사두만 넷 나오는 날이 생긴다. 근육당 `MAX_PER_MUSCLE`에서 끊는다.
 *
 * @param tier 티어 순위표. `null`이면 정렬을 **아예 안 한다** — 프로필 미설정 사용자의 루틴이
 *   현행과 배열 단위로 같아야 하기 때문이다(설계 §3.1). 정렬은 셔플한 뒤 **안정 정렬**로
 *   얹으므로 티어 안의 순서는 그대로 시드가 정한 무작위다.
 */
function muscleRoundRobin(list: Exercise[], r: () => number, tier: Record<Level, number> | null): Exercise[] {
  const buckets = new Map<string, Exercise[]>();
  for (const e of list) {
    const m = e.primaryMuscles[0] ?? '';
    const bucket = buckets.get(m);
    if (bucket) bucket.push(e);
    else buckets.set(m, [e]);
  }
  const queues = shuffled([...buckets.keys()], r).map((m) => {
    const q = shuffled(buckets.get(m)!, r);
    return tier ? q.sort((a, b) => tier[a.level] - tier[b.level]) : q;
  });

  const out: Exercise[] = [];
  for (let round = 0; round < MAX_PER_MUSCLE; round++) {
    for (const q of queues) if (round < q.length) out.push(q[round]);
  }
  return out;
}

/**
 * @param history 최근에 한 **유닛**. **최근 것이 앞**이다.
 * @param seed 날짜 문자열.
 * @param profile 훈련 수준·불편 부위. ⚠️ **`null`이면 개인화를 통째로 건너뛴다** — 프로필을
 *   안 채운 기존 사용자의 오늘 루틴이 배열 단위로 안 바뀌는 것이 마이그레이션 기본값이다
 *   (설계 §3.1). 이 보장은 routine.test의 고정 기대값이 지킨다.
 */
export function pickRoutine(
  exercises: Exercise[],
  owned: EquipKey[],
  history: Unit[],
  seed: string,
  count = 5,
  profile?: Profile | null,
): Routine {
  const avoid = profile?.avoid ?? [];
  // 티어 순위는 프로필이 있을 때만. 없으면 `null`을 흘려보내 정렬 자체를 건너뛴다.
  const tier = profile ? TIER_RANK[profile.experience] : null;

  // 근력만 고른다 — 스트레칭·유산소에는 세트와 휴식이 없고, 휴식이 없으면 광고 자리도 없다.
  // 불편 부위는 여기서 **하드로** 뺀다 — 아래의 기구·부위 하한과 달리 폴백으로 되살리지 않는다.
  const available = filterByEquipment(exercises, owned).filter(
    (e) => e.category === 'strength' && !isAvoided(e, avoid),
  );

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
   *
   * ⚠️ **종목이 `MIN_PER_GROUP` 미만인 부위는 바깥 큐에서 뺀다.** 첫 라운드가 부위마다 주는
   * 것은 「기회」가 아니라 **확정 슬롯**이라, 종목이 하나뿐인 부위가 큐에 끼면 그 한 종목이
   * 이틀에 한 번 **반드시** 배급된다. 맨몸 사용자의 어깨가 정확히 그 경우다 — 쓸 수 있는
   * 어깨 운동이 **상급 핸드스탠드 푸시업 1종뿐**이라, 초보에게 불가능한 동작이 상체 세션마다
   * 고정으로 나갔다(리뷰 실측 60/60). 구 코드의 부위 하한이 막던 자리가 2단 개편으로
   * 비었던 것이다. 다만 **금지가 아니라 선호**라, 전부 걸러지면 있는 것 중에서라도 고른다.
   */
  const groups = byUnit.get(unit)!;
  const richGroups = groups.filter((g) => byGroup.get(g)!.length >= MIN_PER_GROUP);
  const queues = shuffled(richGroups.length > 0 ? richGroups : groups, r).map((g) =>
    muscleRoundRobin(byGroup.get(g)!, r, tier),
  );

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
