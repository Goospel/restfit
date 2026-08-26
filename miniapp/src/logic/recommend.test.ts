import { describe, expect, it } from 'vitest';

import { MIN_GAIN, recommend, SHOP_CANDIDATES } from './recommend';
import { EXERCISES, type EquipKey, type Exercise } from '../data/exercises';

/** 테스트용 최소 운동. `requires` 외의 필드는 판정에 안 쓰인다. */
const ex = (id: string, requires: EquipKey[]): Exercise => ({
  id,
  name: id,
  nameEn: id,
  requires,
  category: 'strength',
  level: 'beginner',
  force: null,
  mechanic: null,
  primaryMuscles: ['chest'],
  secondaryMuscles: [],
  images: [],
});

/** 같은 장비를 쓰는 운동 n개. 임계값을 넘기려면 개수가 필요하다. */
const many = (prefix: string, n: number, requires: EquipKey[]) =>
  Array.from({ length: n }, (_, i) => ex(`${prefix}${i}`, requires));

const keysOf = (owned: EquipKey[], list: Exercise[]) => recommend(list, owned, {}).map((p) => p.key);

describe('recommend', () => {
  const LIST = [
    ...many('맨몸', 20, []),
    ...many('덤벨', 30, ['dumbbell']),
    ...many('케틀벨', 15, ['kettlebell']),
    ...many('밴드', 12, ['band']),
  ];

  it('안 가진 기구만 추천한다', () => {
    // 이미 산 것을 또 권하면 그 순간 추천 전체를 안 믿게 된다.
    expect(keysOf([], LIST)).toContain('dumbbell');
    expect(keysOf(['dumbbell'], LIST)).not.toContain('dumbbell');
  });

  it('많이 열어주는 순서로 정렬한다', () => {
    expect(keysOf([], LIST)).toEqual(['dumbbell', 'kettlebell', 'band']);
  });

  it(`${MIN_GAIN}개 미만으로 늘어나는 기구는 아예 안 보여준다`, () => {
    // 「막무가내로 아무거나 보여주지 않는다」가 이 한 줄이다.
    const 시시한 = [...many('맨몸', 20, []), ...many('풀업', MIN_GAIN - 1, ['pullupBar'])];
    expect(keysOf([], 시시한)).toEqual([]);
  });

  it('경계값은 포함한다', () => {
    const 딱맞음 = [...many('맨몸', 20, []), ...many('풀업', MIN_GAIN, ['pullupBar'])];
    expect(keysOf([], 딱맞음)).toEqual(['pullupBar']);
  });

  it('바벨은 후보에 아예 없다', () => {
    // 운동 수로는 2위지만 원룸에 랙을 놓으라고 할 수는 없다. 데이터가 못 잡는 판단이라 목록으로 박았다.
    expect(SHOP_CANDIDATES).not.toContain('barbell');
    const 바벨천지 = [...many('맨몸', 20, []), ...many('바벨', 99, ['barbell'])];
    expect(keysOf([], 바벨천지)).toEqual([]);
  });

  it('다 가지고 있으면 빈 목록이다', () => {
    expect(recommend(LIST, [...SHOP_CANDIDATES], {})).toEqual([]);
  });

  it('늘어나는 개수와 배수를 함께 준다', () => {
    const [top] = recommend(LIST, [], {});
    expect(top).toMatchObject({ key: 'dumbbell', gain: 30 });
    // 20개 → 50개
    expect(top.ratio).toBeCloseTo(2.5);
  });

  it('조절식 벤치를 가졌으면 그 운동까지 센 기준으로 계산한다', () => {
    // spec을 안 보면 base가 낮게 잡혀 다른 기구의 배수가 부풀어 보인다.
    const 벤치포함 = [...many('맨몸', 20, []), ...many('인클라인', 20, ['benchAdjustable']), ...many('덤벨', 30, ['dumbbell'])];
    const 평벤치 = recommend(벤치포함, ['bench'], { bench: 'flat' })[0];
    const 조절식 = recommend(벤치포함, ['bench'], { bench: 'adjustable' })[0];
    expect(평벤치.before).toBe(20);
    expect(조절식.before).toBe(40);
  });
});

describe('recommend — 실제 데이터의 경계', () => {
  // 임계값 10이 실제로 옳게 동작하는지는 합성 데이터로 증명되지 않는다.
  // 벤치가 정확히 그 경계에 걸쳐 있어서, 이 두 건이 임계값 선택의 근거다.
  it('맨몸만 가진 사람에게는 벤치를 권하지 않는다', () => {
    // 벤치 단독은 +4뿐이다 — 사도 루틴이 거의 안 바뀐다.
    expect(recommend(EXERCISES, [], {}).map((p) => p.key)).not.toContain('bench');
  });

  it('덤벨을 가진 사람에게는 벤치를 권한다', () => {
    // 같은 벤치가 +12가 된다. 추천이 「지금 뭘 가졌나」에 따라 달라진다는 증거다.
    expect(recommend(EXERCISES, ['dumbbell'], {}).map((p) => p.key)).toContain('bench');
  });

  it('맨몸만 가진 사람의 1순위는 덤벨이다', () => {
    expect(recommend(EXERCISES, [], {})[0]).toMatchObject({ key: 'dumbbell', gain: 96 });
  });

  it('스트레칭은 세지 않는다', () => {
    // 이 함수의 첫 테스트가 걸린 함정이다. 스트레칭까지 세면 맨몸 기준이 부풀어
    // 덤벨 배수가 2.68배에서 주저앉고, 그러면 추천 문구의 설득력이 통째로 사라진다.
    const 근력만 = EXERCISES.filter((e) => e.category === 'strength');
    expect(recommend(EXERCISES, [], {})).toEqual(recommend(근력만, [], {}));
    expect(recommend(EXERCISES, [], {})[0].before).toBe(57);
  });
});
