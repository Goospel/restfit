import { describe, expect, it } from 'vitest';

import { pickRoutine } from './routine';
import type { Exercise, MuscleGroup } from '../data/exercises';

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

/** 6개 부위 전부에 운동이 넉넉히 있는 목록. */
const FULL: Exercise[] = Object.values(MUSCLES_BY_GROUP)
  .flat()
  .flatMap((m) => [1, 2, 3, 4].map((i) => ex(`${m}${i}`, m)));

const groupsOf = (r: { exercises: Exercise[] }) => r.exercises.map((e) => e.id);

describe('pickRoutine', () => {
  it('요청한 개수만큼 고른다', () => {
    // 근육이 하나뿐인 부위(가슴·어깨·코어)는 상한 3에 걸리므로, history로 뒤로 밀어 둔다.
    expect(pickRoutine(FULL, [], ['chest', 'shoulders', 'core'], '2026-08-25', 5).exercises).toHaveLength(5);
  });

  it('같은 날이면 같은 루틴이다', () => {
    // seed는 날짜다. 같은 날 재접속했는데 루틴이 바뀌면 하던 운동을 잃는다.
    const a = pickRoutine(FULL, [], [], '2026-08-25');
    const b = pickRoutine(FULL, [], [], '2026-08-25');
    expect(groupsOf(a)).toEqual(groupsOf(b));
    expect(a.group).toBe(b.group);
  });

  it('날짜가 다르면 루틴이 고정되지 않는다', () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 20; d++) seen.add(groupsOf(pickRoutine(FULL, [], ['chest'], `2026-09-${d}`)).join(','));
    expect(seen.size).toBeGreaterThan(1);
  });

  it('고른 운동은 모두 같은 부위다', () => {
    const r = pickRoutine(FULL, [], [], '2026-08-25');
    for (const e of r.exercises) expect(MUSCLES_BY_GROUP[r.group!]).toContain(e.primaryMuscles[0]);
  });

  it('같은 운동이 두 번 나오지 않는다', () => {
    const ids = groupsOf(pickRoutine(FULL, [], [], '2026-08-25'));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('최근에 한 부위는 피한다', () => {
    expect(pickRoutine(FULL, [], ['chest'], '2026-08-25').group).not.toBe('chest');
  });

  it('가장 오래 전에 한 부위를 고른다', () => {
    // history는 최근 것이 앞. 5개를 최근에 했으면 남은 하나가 가장 오래된 부위다.
    const recent: MuscleGroup[] = ['core', 'legs', 'arms', 'shoulders', 'back'];
    expect(pickRoutine(FULL, [], recent, '2026-08-25').group).toBe('chest');
  });

  it('같은 부위가 여러 번 있으면 가장 최근 것으로 센다', () => {
    // ['chest','back','chest'] 에서 chest는 방금 했다. back이 더 오래됐다.
    const only = FULL.filter((e) => ['chest', 'lats'].includes(e.primaryMuscles[0]));
    expect(pickRoutine(only, [], ['chest', 'back', 'chest'], '2026-08-25').group).toBe('back');
  });

  it('할 수 있는 운동이 없는 부위는 고르지 않는다', () => {
    // 맨몸인데 가슴 운동이 전부 덤벨을 요구하는 상황.
    const list = [...FULL.filter((e) => e.primaryMuscles[0] !== 'chest'), ex('덤벨가슴', 'chest', { requires: ['dumbbell'] })];
    for (let d = 1; d <= 20; d++) expect(pickRoutine(list, [], [], `2026-09-${d}`).group).not.toBe('chest');
  });

  it('운동이 너무 적은 부위는 고르지 않는다', () => {
    // 운동 1개짜리 "루틴"은 루틴이 아니다. 맨몸 사용자의 어깨가 실제로 그랬다 —
    // 쓸 수 있는 어깨 운동이 핸드스탠드 푸시업 하나뿐이었다.
    const list = [...FULL.filter((e) => e.primaryMuscles[0] !== 'chest'), ex('가슴1', 'chest'), ex('가슴2', 'chest')];
    for (let d = 1; d <= 20; d++) expect(pickRoutine(list, [], [], `2026-09-${d}`).group).not.toBe('chest');
  });

  it('모든 부위가 빈약하면 그래도 가장 나은 것을 준다', () => {
    // 하한은 선호이지 금지가 아니다. 전부 걸러 버리면 사용자에게 아무것도 못 준다.
    const r = pickRoutine([ex('가슴1', 'chest'), ex('가슴2', 'chest')], [], [], '2026-08-25');
    expect(r.group).toBe('chest');
    expect(r.exercises).toHaveLength(2);
  });

  it('보유 장비로 못 하는 운동은 섞이지 않는다', () => {
    const list = [...FULL, ex('바벨스쿼트', 'quadriceps', { requires: ['barbell'] })];
    for (let d = 1; d <= 20; d++) {
      expect(groupsOf(pickRoutine(list, [], [], `2026-09-${d}`))).not.toContain('바벨스쿼트');
    }
  });

  it('근력이 아닌 것은 섞이지 않는다', () => {
    // 스트레칭·유산소에는 세트와 휴식이 없다. 휴식이 없으면 광고 자리도 없다.
    const list = [...FULL, ex('스트레칭', 'chest', { category: 'stretching' }), ex('달리기', 'quadriceps', { category: 'cardio' })];
    for (let d = 1; d <= 20; d++) {
      const ids = groupsOf(pickRoutine(list, [], [], `2026-09-${d}`));
      expect(ids).not.toContain('스트레칭');
      expect(ids).not.toContain('달리기');
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
    // 부위 안에 쓸 수 있는 근육이 하나뿐이면(맨몸 팔 = 삼두뿐) 5개를 채우려다 같은 근육만 5종목이 된다.
    // 한 근육에 15세트는 과훈련이고, 그런 루틴은 사람을 떠나게 해 **광고 슬롯도 함께 사라진다.**
    const list = [1, 2, 3, 4, 5, 6].map((i) => ex(`tri${i}`, 'triceps'));
    expect(pickRoutine(list, [], [], '2026-08-25', 5).exercises).toHaveLength(3);
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
    expect(groupsOf(pickRoutine(list, [], [], '2026-08-25', 3))[0]).toBe('복합1');
  });

  it('운동이 모자라면 있는 만큼만 준다', () => {
    const list = [ex('a', 'chest'), ex('b', 'chest')];
    expect(pickRoutine(list, [], [], '2026-08-25', 5).exercises).toHaveLength(2);
  });

  it('할 수 있는 운동이 하나도 없으면 빈 루틴이다', () => {
    expect(pickRoutine([], [], [], '2026-08-25')).toEqual({ group: null, exercises: [] });
    expect(pickRoutine([ex('덤벨', 'chest', { requires: ['dumbbell'] })], [], [], '2026-08-25')).toEqual({
      group: null,
      exercises: [],
    });
  });

  it('원본 배열을 건드리지 않는다', () => {
    const before = FULL.map((e) => e.id);
    pickRoutine(FULL, [], [], '2026-08-25');
    expect(FULL.map((e) => e.id)).toEqual(before);
  });
});
