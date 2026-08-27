import { describe, expect, it } from 'vitest';

import { suggestNext } from './goal';
import type { Profile } from './profile';
import { pickRoutine } from './routine';
import { startSession } from './session';
import { EXERCISES, type EquipKey, type Exercise, type MuscleGroup, type Unit } from '../data/exercises';
import { lastSetsOf, recentUnits, type WorkoutRecord } from '../storage';

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

  it('종목이 하나뿐인 부위는 확정 슬롯을 받지 못한다', () => {
    // ★ 2단 라운드로빈의 첫 라운드는 부위마다 **확정 슬롯**을 준다. 그래서 종목이 하나뿐인
    //   부위가 큐에 끼면 그 한 종목이 이틀에 한 번 **반드시** 배급된다 — 구 코드의 부위
    //   하한(MIN_POOL)이 막던 것이 2단 개편으로 사라졌다.
    const list = [
      ...[1, 2, 3, 4].map((i) => ex(`가슴${i}`, 'chest')),
      ...[1, 2, 3, 4].map((i) => ex(`삼두${i}`, 'triceps')),
      ex('어깨단독', 'shoulders'),
    ];
    for (let d = 1; d <= 20; d++) {
      const r = pickRoutine(list, [], [], `2026-09-${d}`, 4);
      expect(idsOf(r)).not.toContain('어깨단독');
      // 빈약 부위를 걸러도 남은 부위로 요청한 개수를 채운다.
      expect(r.exercises).toHaveLength(4);
    }
  });

  it('모든 부위가 빈약하면 그래도 있는 것 중에서 고른다', () => {
    // 하한은 **금지가 아니라 선호**다(구 MIN_POOL과 같은 철학). 전부 걸러 버리면
    // 사용자에게 아무것도 못 준다 — 불가능한 동작 하나라도 없는 것보다는 낫다.
    const list = [ex('가슴단독', 'chest'), ex('어깨단독', 'shoulders')];
    const r = pickRoutine(list, [], [], '2026-08-25', 4);
    expect(r.unit).toBe('upper');
    expect(idsOf(r).sort()).toEqual(['가슴단독', '어깨단독']);
  });

  it('맨몸 상체 세션에 핸드스탠드 푸시업이 나오지 않는다', () => {
    // ★ **실데이터 회귀 가드.** 맨몸 근력의 어깨는 이 상급 1종이 전부다(등은 0종).
    //   부위 하한이 없으면 초보 맨몸 사용자의 상체 세션마다 이 동작이 확정 배급된다 —
    //   실제로 60/60 배급되던 것을 리뷰가 잡았다.
    for (let d = 1; d <= 30; d++) {
      const ids = idsOf(pickRoutine(EXERCISES, [], ['lower'], `2026-09-${d}`, 4));
      expect(ids, `2026-09-${d}`).not.toContain('Handstand_Push-Ups');
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

describe('pickRoutine — 개인화(profile)', () => {
  const OWNED: EquipKey[] = ['dumbbell', 'barbell', 'bench'];

  /**
   * PR 3 **직전**(2분할만 들어간 상태)의 실제 출력이다. 손으로 고른 값이 아니라 그때의
   * `pickRoutine`을 돌려 받아 적었다.
   *
   * ★ **기존 사용자 보증이 여기서만 나온다.** 프로필을 안 채운 사람의 오늘 루틴은 이 PR로
   *   한 톨도 바뀌면 안 된다 — 「profile을 안 넘긴 것과 null을 넘긴 것이 같다」는 자기 자신과의
   *   비교라, 개인화가 프로필 유무와 무관하게 늘 켜져도 그대로 통과한다. 그래서 **바깥에서
   *   구한 고정값**과 대조한다.
   *
   * ⚠️ 이 값이 깨지면 먼저 의심할 것은 테스트가 아니라 **선발 규칙이 조용히 바뀐 것**이다.
   *   운동 데이터(`exercises.json`)를 다시 뽑았다면 그때는 고정값을 갱신하는 게 맞다.
   */
  const BASELINE: { seed: string; history: Unit[]; unit: Unit; ids: string[] }[] = [
    {
      seed: '2026-09-01',
      history: [],
      unit: 'lower',
      ids: ['Otis-Up', 'Weighted_Squat', 'Seated_Leg_Tucks', 'Dumbbell_Seated_One-Leg_Calf_Raise'],
    },
    {
      seed: '2026-09-02',
      history: ['upper'],
      unit: 'lower',
      ids: ['Elbow_to_Knee', 'Glute_Kickback', 'Snatch_Pull', 'Barbell_Ab_Rollout'],
    },
    {
      seed: '2026-09-03',
      history: ['lower', 'upper'],
      unit: 'upper',
      ids: ['Dumbbell_Bench_Press', 'Standing_Dumbbell_Press', 'Dumbbell_Shrug', 'Barbell_Curl'],
    },
  ];

  it('프로필이 없으면 2분할(PR 2)과 배열까지 같은 루틴이다', () => {
    for (const { seed, history, unit, ids } of BASELINE) {
      for (const r of [
        pickRoutine(EXERCISES, OWNED, history, seed, 4),
        pickRoutine(EXERCISES, OWNED, history, seed, 4, null),
      ]) {
        expect(r.unit, seed).toBe(unit);
        expect(idsOf(r), seed).toEqual(ids);
      }
    }
  });

  it('프로필을 주면 그 고정값과 달라진다', () => {
    // 위 고정값이 「아무것도 안 하는 코드」로도 통과하는 공허한 테스트가 아님을 여기서 못 박는다.
    for (const { seed, history, ids } of BASELINE) {
      const r = pickRoutine(EXERCISES, OWNED, history, seed, 4, {
        experience: 'advanced',
        avoid: ['knee', 'shoulder', 'lowerBack'],
      });
      expect(idsOf(r), seed).not.toEqual(ids);
    }
  });

  it('같은 날 같은 프로필이면 같은 루틴이다', () => {
    // 프로필은 순수 입력이라 날짜 시드 결정성이 그대로 남아야 한다(설계 §3.1).
    const profile: Profile = { experience: 'intermediate', avoid: ['knee'] };
    const a = pickRoutine(EXERCISES, OWNED, ['upper'], '2026-08-25', 4, profile);
    const b = pickRoutine(EXERCISES, OWNED, ['upper'], '2026-08-25', 4, profile);
    expect(idsOf(a)).toEqual(idsOf(b));
    expect(a.unit).toBe(b.unit);
  });

  describe('부상 부위 하드 제외', () => {
    it('한 부위가 전멸해도 유닛은 남은 부위로 성립한다', () => {
      // 어깨를 빼면 상체의 네 부위 중 하나가 통째로 죽는다. 2단 라운드로빈이 남은 셋으로
      // 알아서 채우므로 **추가 코드가 없다**(설계 §3.2).
      const profile: Profile = { experience: 'beginner', avoid: ['shoulder'] };
      for (let d = 1; d <= 20; d++) {
        const r = pickRoutine(FULL, [], ['lower'], `2026-09-${d}`, 4, profile);
        expect(r.unit).toBe('upper');
        expect(groupsOf(r), `2026-09-${d}`).not.toContain('shoulders');
        expect(r.exercises, `2026-09-${d}`).toHaveLength(4);
      }
    });

    it('한 유닛이 통째로 전멸하면 남은 유닛이 반복된다', () => {
      // 퇴화 케이스는 허용한다 — 어제 한 유닛이라도 대안이 없으면 그대로 다시 준다(설계 §3.3).
      const upper = FULL.filter((e) => UNIT_GROUPS.upper.includes(GROUP_OF[e.primaryMuscles[0]]));
      const list = [...upper, ...[1, 2, 3, 4].map((i) => ex(`무릎${i}`, 'quadriceps'))];
      const profile: Profile = { experience: 'beginner', avoid: ['knee'] };
      for (let d = 1; d <= 20; d++) {
        expect(pickRoutine(list, [], ['upper'], `2026-09-${d}`, 4, profile).unit).toBe('upper');
      }
    });

    it('전부 전멸하면 빈 루틴이다 — 폴백으로 되살리지 않는다', () => {
      // ★ 기구 하한(MIN_POOL)·부위 하한과 결정적으로 다른 지점이다. 저건 「선호」라 전부
      //   걸러지면 있는 것 중에서라도 주지만, 통증 부위는 **안전 문제**라 되살리면 안 된다.
      //   빈 화면은 §6의 「불편 부위 설정 확인」 문구가 받는다.
      const list = [1, 2, 3, 4].map((i) => ex(`무릎${i}`, 'quadriceps'));
      const profile: Profile = { experience: 'beginner', avoid: ['knee'] };
      expect(pickRoutine(list, [], [], '2026-08-25', 4, profile)).toEqual({ unit: null, exercises: [] });
    });
  });

  describe('난이도 티어 선호', () => {
    /** 같은 근육 안에 티어만 다른 종목을 깔아 두고, 첫 한 개가 어느 티어인지 본다. */
    const twoTiers = (a: Exercise['level'], b: Exercise['level']) => [
      ...[1, 2].map((i) => ex(`${a}${i}`, 'chest', { level: a })),
      ...[1, 2].map((i) => ex(`${b}${i}`, 'chest', { level: b })),
    ];

    /**
     * 세 티어를 2종씩. **1등 종목의 티어가 30일에 걸쳐 어느 집합을 그리는지**를 본다.
     *
     * ⚠️ 위의 2티어 테스트들은 표의 세 줄을 **구별하지 못한다** — 「초급 단독 1위」와
     * 「초·중급 동률」이 2티어 리스트에서는 같은 답을 내기 때문이다. 세 티어를 깔고
     * 집합으로 받아야 순위표의 **동률 여부**까지 관측된다.
     */
    const threeTiers = [
      ...[1, 2].map((i) => ex(`beginner${i}`, 'chest', { level: 'beginner' })),
      ...[1, 2].map((i) => ex(`intermediate${i}`, 'chest', { level: 'intermediate' })),
      ...[1, 2].map((i) => ex(`expert${i}`, 'chest', { level: 'expert' })),
    ];
    const topTiers = (experience: Profile['experience']) => {
      const seen = new Set<string>();
      for (let d = 1; d <= 30; d++) {
        seen.add(pickRoutine(threeTiers, [], [], `2026-09-${d}`, 1, { experience, avoid: [] }).exercises[0].level);
      }
      return [...seen].sort();
    };

    it('초급 프로필은 초급만 1등에 세운다', () => {
      // 초급 줄이 「초·중급 동률」로 잘못 써지면 여기서 중급이 섞여 나온다 — 2티어
      // 테스트는 그 오타를 통과시킨다(초급이 상급보다 먼저인 건 여전히 참이라서).
      expect(topTiers('beginner')).toEqual(['beginner']);
    });

    it('중급 프로필은 초급과 중급을 동률로 섞는다', () => {
      // ★ 두 가지를 한꺼번에 잡는다. ① 중급 줄이 초급 줄과 같아지면 집합이 ['beginner']로
      //   쪼그라든다. ② **티어 안 셔플이 죽어도** 1등이 늘 같은 종목이라 집합이 하나로
      //   쪼그라든다 — 동률인데 한쪽만 나오는 것은 섞이지 않았다는 뜻이다.
      expect(topTiers('intermediate')).toEqual(['beginner', 'intermediate']);
    });

    it('상급 프로필은 중·상급을 동률로 섞고 초급을 꼴찌로 민다', () => {
      expect(topTiers('advanced')).toEqual(['expert', 'intermediate']);
    });

    it('프로필이 있어도 30일이 같은 종목으로 굳지 않는다', () => {
      // ★ **티어 정렬이 셔플을 잡아먹지 않았다는 증거.** 정렬을 셔플 **위에** 얹지 않고
      //   셔플을 건너뛰면 티어 안 순서가 데이터 순서로 고정돼 매일 같은 종목이 배급된다 —
      //   개인화가 「난이도를 맞춰 주는 것」에서 「같은 운동만 주는 것」으로 조용히 바뀐다.
      //   실측 80종이라 하한 40은 절반 붕괴만 잡는 헐렁한 선이다(굳으면 17종으로 떨어진다).
      const owned: EquipKey[] = ['dumbbell', 'barbell', 'bench', 'pullupBar', 'kettlebell', 'band'];
      const seen = new Set<string>();
      for (let d = 1; d <= 30; d++) {
        const r = pickRoutine(EXERCISES, owned, [], `2026-09-${d}`, 4, { experience: 'beginner', avoid: [] });
        for (const e of r.exercises) seen.add(e.id);
      }
      expect(seen.size).toBeGreaterThan(40);
    });

    it('초급이면 초급이 상급보다 먼저다', () => {
      const list = twoTiers('beginner', 'expert');
      for (let d = 1; d <= 20; d++) {
        const seed = `2026-09-${d}`;
        expect(idsOf(pickRoutine(list, [], [], seed, 1, { experience: 'beginner', avoid: [] }))[0], seed).toMatch(
          /^beginner/,
        );
      }
    });

    it('중급이면 중급이 상급보다 먼저다', () => {
      const list = twoTiers('intermediate', 'expert');
      for (let d = 1; d <= 20; d++) {
        const seed = `2026-09-${d}`;
        expect(
          idsOf(pickRoutine(list, [], [], seed, 1, { experience: 'intermediate', avoid: [] }))[0],
          seed,
        ).toMatch(/^intermediate/);
      }
    });

    it('상급이면 상급이 초급보다 먼저다', () => {
      // 표의 마지막 줄(advanced = 중·상급 → 초급)은 순서가 **뒤집힌다** — 초급 우선을
      // 그대로 둔 구현이면 여기서 죽는다.
      const list = twoTiers('beginner', 'expert');
      for (let d = 1; d <= 20; d++) {
        const seed = `2026-09-${d}`;
        expect(idsOf(pickRoutine(list, [], [], seed, 1, { experience: 'advanced', avoid: [] }))[0], seed).toMatch(
          /^expert/,
        );
      }
    });

    it('초급 프로필이면 실데이터에서 상급 동작이 안 나온다', () => {
      // ★ 실데이터 가드. 근육 버킷마다 초급이 하나 이상 있어서 첫 라운드가 전부 초급으로 찬다.
      const owned: EquipKey[] = ['dumbbell', 'barbell', 'bench', 'pullupBar', 'kettlebell', 'band'];
      for (let d = 1; d <= 30; d++) {
        const seed = `2026-09-${d}`;
        const r = pickRoutine(EXERCISES, owned, [], seed, 4, { experience: 'beginner', avoid: [] });
        expect(r.exercises.map((e) => e.level), seed).not.toContain('expert');
      }
    });

    it('초급 풀이 마르면 상위 티어로 자연히 넘어간다', () => {
      // ★ **폴백이 규칙에 내장돼 있다**(설계 §3.4). 난이도를 하드 필터로 만들면 맨몸 어깨
      //   (상급 1종뿐)처럼 풀이 비어 폴백 규칙을 따로 지어야 한다 — 선호 정렬은 그냥 넘어간다.
      const list = [
        ...[1, 2].map((i) => ex(`가슴상급${i}`, 'chest', { level: 'expert' })),
        ...[1, 2].map((i) => ex(`삼두상급${i}`, 'triceps', { level: 'expert' })),
      ];
      const r = pickRoutine(list, [], [], '2026-08-25', 4, { experience: 'beginner', avoid: [] });
      expect(r.exercises).toHaveLength(4);
    });
  });
});

describe('졸업 프리필은 루틴 결정성에 영향이 없다 (§3.7)', () => {
  /**
   * ★ 프리필은 **입력칸 기본값**일 뿐이다. 지난 세트가 승급감이든 정체든 오늘 뽑히는 종목은
   *   같아야 한다 — 프리필이 선발로 새면 「같은 날 같은 입력이면 같은 루틴」이 깨진다.
   */
  const hist = (reps: number): WorkoutRecord[] => [
    {
      date: '2026-08-26',
      group: 'lower',
      entries: [{ id: 'chest1', name: 'chest1', sets: [{ weight: 20, reps }, { weight: 20, reps }] }],
    },
  ];
  const graduating = hist(12); // muscle 상단 도달 → 승급
  const stalling = hist(11); // 한 회 모자람 → 정체

  it('프리필이 실제로 갈리는 두 기록이다 — 계측기부터 세운다', () => {
    // 이 단언이 없으면 아래 테스트는 「둘 다 같으니 당연히 같다」로 공허해진다.
    expect(suggestNext(lastSetsOf(graduating, 'chest1'), 'muscle', false, 0)).not.toEqual(
      suggestNext(lastSetsOf(stalling, 'chest1'), 'muscle', false, 0),
    );
  });

  it('세트 기록이 달라도 오늘의 루틴은 한 글자도 안 바뀐다', () => {
    const pick = (h: WorkoutRecord[]) => pickRoutine(FULL, [], recentUnits(h), '2026-08-27', 4, null);
    expect(idsOf(pick(graduating))).toEqual(idsOf(pick(stalling)));
    expect(pick(graduating).unit).toBe(pick(stalling).unit);
  });

  it('시작한 세션도 같다 — 세트·휴식 상태 기계는 프리필을 모른다', () => {
    const s = (h: WorkoutRecord[]) => startSession(pickRoutine(FULL, [], recentUnits(h), '2026-08-27', 4, null).exercises, 'muscle');
    expect(s(graduating)).toEqual(s(stalling));
  });
});
