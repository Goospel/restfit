import { describe, expect, it } from 'vitest';

import { pickRoutine } from './routine';
import type { Exercise, MuscleGroup, Unit } from '../data/exercises';

const ex = (id: string, muscle: string, o: Partial<Exercise> = {}): Exercise => ({
  id,
  name: id,
  nameEn: id,
  requires: [],
  category: 'strength',
  level: 'beginner',
  force: null,
  mechanic: 'compound',
  primaryMuscles: [muscle],
  secondaryMuscles: [],
  images: [],
  ...o,
});

/**
 * 부위별 근육 구성. **실제 데이터를 닮게 둔다** — 가슴과 코어는 근육이 하나뿐이라
 * 한 근육 상한(3)에 걸리고, 등·팔·하체는 여러 개라 안 걸린다.
 */
const MUSCLES_BY_GROUP: Record<MuscleGroup, string[]> = {
  chest: ['chest'],
  back: ['lats', 'middle back'],
  shoulders: ['shoulders'],
  arms: ['biceps', 'triceps'],
  legs: ['quadriceps', 'hamstrings'],
  core: ['abdominals'],
};

/** 근육 → 부위. 뽑힌 운동이 어느 부위·유닛인지 되짚는 데만 쓴다. */
const GROUP_OF: Record<string, MuscleGroup> = Object.fromEntries(
  (Object.keys(MUSCLES_BY_GROUP) as MuscleGroup[]).flatMap((g) => MUSCLES_BY_GROUP[g].map((m) => [m, g])),
);
const UNIT_GROUPS: Record<Unit, MuscleGroup[]> = {
  upper: ['chest', 'back', 'shoulders', 'arms'],
  lower: ['legs', 'core'],
};

/** 6개 부위 전부에 운동이 넉넉히 있는 목록 — 상체 4부위 · 하체 2부위. */
const FULL: Exercise[] = Object.values(MUSCLES_BY_GROUP)
  .flat()
  .flatMap((m) => [1, 2, 3, 4].map((i) => ex(`${m}${i}`, m)));

const idsOf = (r: { exercises: Exercise[] }) => r.exercises.map((e) => e.id);
const groupsOf = (r: { exercises: Exercise[] }) => r.exercises.map((e) => GROUP_OF[e.primaryMuscles[0]]);

describe('pickRoutine', () => {
  it('요청한 개수만큼 고른다', () => {
    expect(pickRoutine(FULL, [], [], '2026-08-25', 5).exercises).toHaveLength(5);
  });

  it('같은 날이면 같은 루틴이다', () => {
    // seed는 날짜다. 같은 날 재접속했는데 루틴이 바뀌면 하던 운동을 잃는다.
    const a = pickRoutine(FULL, [], [], '2026-08-25');
    const b = pickRoutine(FULL, [], [], '2026-08-25');
    expect(idsOf(a)).toEqual(idsOf(b));
    expect(a.unit).toBe(b.unit);
  });

  it('날짜가 다르면 루틴이 고정되지 않는다', () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 20; d++) seen.add(idsOf(pickRoutine(FULL, [], ['upper'], `2026-09-${d}`)).join(','));
    expect(seen.size).toBeGreaterThan(1);
  });

  it('고른 운동은 모두 같은 유닛이다', () => {
    // 「오늘은 상체」라고 써 놓고 스쿼트를 섞으면 헤드라인이 거짓말이 된다.
    for (let d = 1; d <= 20; d++) {
      const r = pickRoutine(FULL, [], [], `2026-09-${d}`);
      for (const g of groupsOf(r)) expect(UNIT_GROUPS[r.unit!]).toContain(g);
    }
  });

  it('같은 운동이 두 번 나오지 않는다', () => {
    const ids = idsOf(pickRoutine(FULL, [], [], '2026-08-25'));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('어제 한 유닛은 절대 다시 고르지 않는다', () => {
    // ★ **이 불변식이 곧 회복 게이트다**(설계 §3.3). 유닛이 둘뿐이라 「가장 오래된 것 우선」이
    //   격일 교대를 강제하고, 그 덕에 별도의 48h 게이트 코드를 안 만들었다. 여기가 깨지면
    //   같은 근육을 24h 안에 두 번 때리게 되므로 게이트를 신설해야 한다.
    for (let d = 1; d <= 20; d++) {
      expect(pickRoutine(FULL, [], ['upper'], `2026-09-${d}`).unit).toBe('lower');
      expect(pickRoutine(FULL, [], ['lower'], `2026-09-${d}`).unit).toBe('upper');
    }
  });

  it('20일을 이어서 하면 두 유닛이 교대로 나온다', () => {
    // 어제 기록을 그대로 먹여 20일을 굴린다 — 실제 사용자의 연속 사용 그대로다.
    const units: Unit[] = [];
    for (let d = 1; d <= 20; d++) {
      units.unshift(pickRoutine(FULL, [], units, `2026-09-${d}`).unit!);
    }
    // 어느 유닛도 연속 두 번 나오지 않는다 = 완전 교대.
    expect(units.filter((u, i) => i > 0 && u === units[i - 1])).toEqual([]);
    expect(new Set(units).size).toBe(2);
  });

  it('같은 유닛이 여러 번 있으면 가장 최근 것으로 센다', () => {
    // ['upper','lower','upper'] 에서 upper는 방금 했다. lower가 더 오래됐다.
    expect(pickRoutine(FULL, [], ['upper', 'lower', 'upper'], '2026-08-25').unit).toBe('lower');
  });

  it('할 수 있는 운동이 없는 유닛은 고르지 않는다', () => {
    // 맨몸인데 하체 운동이 전부 덤벨을 요구하는 상황.
    const list = [
      ...FULL.filter((e) => UNIT_GROUPS.upper.includes(GROUP_OF[e.primaryMuscles[0]])),
      ex('덤벨스쿼트', 'quadriceps', { requires: ['dumbbell'] }),
    ];
    for (let d = 1; d <= 20; d++) expect(pickRoutine(list, [], [], `2026-09-${d}`).unit).not.toBe('lower');
  });

  it('운동이 너무 적은 유닛은 고르지 않는다', () => {
    // 운동 2개짜리 "루틴"은 루틴이 아니다. 유닛이 둘뿐이라 이 하한이 없으면
    // 격일 교대가 빈약한 쪽을 매번 절반씩 채간다.
    const list = [
      ...FULL.filter((e) => UNIT_GROUPS.upper.includes(GROUP_OF[e.primaryMuscles[0]])),
      ex('하체1', 'quadriceps'),
      ex('하체2', 'abdominals'),
    ];
    for (let d = 1; d <= 20; d++) expect(pickRoutine(list, [], [], `2026-09-${d}`).unit).not.toBe('lower');
  });

  it('한 유닛이 전멸하면 남은 유닛이 매일 반복된다', () => {
    // 퇴화 케이스는 **허용한다**(설계 §3.3) — 운동이 있는 것이 없는 것보다 낫다.
    // 어제 한 유닛이라도 대안이 없으면 그대로 다시 준다.
    const upperOnly = FULL.filter((e) => UNIT_GROUPS.upper.includes(GROUP_OF[e.primaryMuscles[0]]));
    for (let d = 1; d <= 20; d++) {
      expect(pickRoutine(upperOnly, [], ['upper'], `2026-09-${d}`).unit).toBe('upper');
    }
  });

  it('두 유닛 다 빈약하면 그래도 가장 나은 것을 준다', () => {
    // 하한은 선호이지 금지가 아니다. 전부 걸러 버리면 사용자에게 아무것도 못 준다.
    const r = pickRoutine([ex('가슴1', 'chest'), ex('가슴2', 'chest')], [], [], '2026-08-25');
    expect(r.unit).toBe('upper');
    expect(r.exercises).toHaveLength(2);
  });

  it('보유 장비로 못 하는 운동은 섞이지 않는다', () => {
    const list = [...FULL, ex('바벨스쿼트', 'quadriceps', { requires: ['barbell'] })];
    for (let d = 1; d <= 20; d++) {
      expect(idsOf(pickRoutine(list, [], [], `2026-09-${d}`))).not.toContain('바벨스쿼트');
    }
  });

  it('근력이 아닌 것은 섞이지 않는다', () => {
    // 스트레칭·유산소에는 세트와 휴식이 없다. 휴식이 없으면 광고 자리도 없다.
    const list = [...FULL, ex('스트레칭', 'chest', { category: 'stretching' }), ex('달리기', 'quadriceps', { category: 'cardio' })];
    for (let d = 1; d <= 20; d++) {
      const ids = idsOf(pickRoutine(list, [], [], `2026-09-${d}`));
      expect(ids).not.toContain('스트레칭');
      expect(ids).not.toContain('달리기');
    }
  });

  it('상체 4종목이면 네 부위를 하나씩 전부 커버한다', () => {
    // ★ 종목 수를 4로 통일한 **유일한 근거**다(설계 §3.8.4). 부위→근육 2단 라운드로빈의
    //   바깥 라운드 0에서 부위마다 하나씩 나가므로, 부위당 빈도가 기대값이 아니라 **확정값**이 된다.
    //   평평하게 섞으면 "사실상 등 데이"가 생겨 이 보장이 확률로 희석된다.
    for (let d = 1; d <= 20; d++) {
      const r = pickRoutine(FULL, [], ['lower'], `2026-09-${d}`, 4);
      expect(r.unit).toBe('upper');
      expect([...groupsOf(r)].sort()).toEqual(['arms', 'back', 'chest', 'shoulders']);
    }
  });

  it('상체 3종목이면 세 부위를 커버한다', () => {
    // 레거시 종목 수(3)에서도 부위가 겹치지 않는다 — 겹치면 한 부위가 두 번, 다른 둘이 결번이다.
    for (let d = 1; d <= 20; d++) {
      const gs = groupsOf(pickRoutine(FULL, [], ['lower'], `2026-09-${d}`, 3));
      expect(new Set(gs).size).toBe(3);
    }
  });

  it('하체 4종목이면 legs와 core가 번갈아 나온다', () => {
    // 하체 유닛은 부위가 둘뿐이라 2:2가 된다. core가 통째로 빠지면 복근이 영영 안 나온다.
    for (let d = 1; d <= 20; d++) {
      const r = pickRoutine(FULL, [], ['upper'], `2026-09-${d}`, 4);
      expect(r.unit).toBe('lower');
      expect(groupsOf(r).filter((g) => g === 'core')).toHaveLength(2);
      expect(groupsOf(r).filter((g) => g === 'legs')).toHaveLength(2);
    }
  });

  it('한 근육에 몰리지 않고 부위 안에서 골고루 고른다', () => {
    // 하체에 대퇴사두 4개 · 햄스트링 1개 · 둔근 1개. 3개를 고르면 셋 다 다른 근육이어야 한다.
    const legs = [
      ...[1, 2, 3, 4].map((i) => ex(`quad${i}`, 'quadriceps')),
      ex('ham1', 'hamstrings'),
      ex('glute1', 'glutes'),
    ];
    const muscles = pickRoutine(legs, [], [], '2026-08-25', 3).exercises.map((e) => e.primaryMuscles[0]);
    expect(new Set(muscles).size).toBe(3);
  });

  it('근육 종류보다 많이 고르면 그제서야 겹친다', () => {
    const legs = [...[1, 2, 3].map((i) => ex(`quad${i}`, 'quadriceps')), ex('ham1', 'hamstrings')];
    const r = pickRoutine(legs, [], [], '2026-08-25', 4);
    expect(r.exercises).toHaveLength(4);
    expect(r.exercises.map((e) => e.primaryMuscles[0]).filter((m) => m === 'hamstrings')).toHaveLength(1);
  });

  it('한 근육에서 세 개까지만 고른다', () => {
    // 유닛 안에 쓸 수 있는 근육이 하나뿐이면(맨몸 팔 = 삼두뿐) 5개를 채우려다 같은 근육만 5종목이 된다.
    // 한 근육에 15세트는 과훈련이고, 그런 루틴은 사람을 떠나게 해 **광고 슬롯도 함께 사라진다.**
    const list = [1, 2, 3, 4, 5, 6].map((i) => ex(`tri${i}`, 'triceps'));
    expect(pickRoutine(list, [], [], '2026-08-25', 5).exercises).toHaveLength(3);
  });

  it('부위가 여럿이면 한 근육 상한을 넘어서도 요청한 개수를 채운다', () => {
    // 상한은 근육당이지 유닛당이 아니다. 삼두 3 + 이두 3 = 6까지 나갈 수 있어야 한다.
    const arms = [...[1, 2, 3, 4].map((i) => ex(`tri${i}`, 'triceps')), ...[1, 2, 3].map((i) => ex(`bi${i}`, 'biceps'))];
    expect(pickRoutine(arms, [], [], '2026-08-25', 5).exercises).toHaveLength(5);
  });

  it('근육이 여러 개면 요청한 개수를 채운다', () => {
    const list = [...[1, 2, 3, 4].map((i) => ex(`quad${i}`, 'quadriceps')), ...[1, 2].map((i) => ex(`ham${i}`, 'hamstrings'))];
    expect(pickRoutine(list, [], [], '2026-08-25', 5).exercises).toHaveLength(5);
  });

  it('복합 운동을 단순 운동보다 앞에 둔다', () => {
    // 지친 상태로 복합 운동을 하면 자세가 무너진다.
    const list = [
      ex('고립1', 'chest', { mechanic: 'isolation' }),
      ex('고립2', 'chest', { mechanic: 'isolation' }),
      ex('복합1', 'chest', { mechanic: 'compound' }),
    ];
    expect(idsOf(pickRoutine(list, [], [], '2026-08-25', 3))[0]).toBe('복합1');
  });

  it('부위가 섞여도 복합이 먼저다', () => {
    // 2단 라운드로빈이 부위를 번갈아 뽑아 오므로, 정렬이 없으면 고립이 앞에 설 수 있다.
    const list = [
      ...[1, 2, 3].map((i) => ex(`가슴고립${i}`, 'chest', { mechanic: 'isolation' })),
      ...[1, 2, 3].map((i) => ex(`등복합${i}`, 'lats', { mechanic: 'compound' })),
    ];
    for (let d = 1; d <= 20; d++) {
      const mech = pickRoutine(list, [], [], `2026-09-${d}`, 4).exercises.map((e) => e.mechanic);
      expect(mech.indexOf('isolation')).toBeGreaterThan(mech.lastIndexOf('compound'));
    }
  });

  it('운동이 모자라면 있는 만큼만 준다', () => {
    const list = [ex('a', 'chest'), ex('b', 'chest')];
    expect(pickRoutine(list, [], [], '2026-08-25', 5).exercises).toHaveLength(2);
  });

  it('할 수 있는 운동이 하나도 없으면 빈 루틴이다', () => {
    expect(pickRoutine([], [], [], '2026-08-25')).toEqual({ unit: null, exercises: [] });
    expect(pickRoutine([ex('덤벨', 'chest', { requires: ['dumbbell'] })], [], [], '2026-08-25')).toEqual({
      unit: null,
      exercises: [],
    });
  });

  it('원본 배열을 건드리지 않는다', () => {
    const before = FULL.map((e) => e.id);
    pickRoutine(FULL, [], [], '2026-08-25');
    expect(FULL.map((e) => e.id)).toEqual(before);
  });
});
