import { describe, expect, it } from 'vitest';

import { filterByEquipment, unlockGain } from './equipment';
import type { Exercise } from '../data/exercises';

/** 테스트용 최소 운동. requires 외의 필드는 판정에 안 쓰이므로 기본값으로 채운다. */
const ex = (id: string, requires: Exercise['requires']): Exercise => ({
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

const LIST = [
  ex('맨몸1', []),
  ex('맨몸2', []),
  ex('덤벨1', ['dumbbell']),
  ex('덤벨벤치', ['bench', 'dumbbell']),
  ex('바벨1', ['barbell']),
];

describe('filterByEquipment', () => {
  it('아무것도 없으면 맨몸 운동만 나온다', () => {
    expect(filterByEquipment(LIST, []).map((e) => e.id)).toEqual(['맨몸1', '맨몸2']);
  });

  it('덤벨이 있으면 덤벨 운동이 추가된다', () => {
    expect(filterByEquipment(LIST, ['dumbbell']).map((e) => e.id)).toEqual(['맨몸1', '맨몸2', '덤벨1']);
  });

  it('장비가 둘 필요한 운동은 둘 다 있어야 나온다', () => {
    // 덤벨만으로는 덤벨 벤치프레스를 할 수 없다. 이게 requires를 집합으로 둔 이유다.
    expect(filterByEquipment(LIST, ['dumbbell']).map((e) => e.id)).not.toContain('덤벨벤치');
    expect(filterByEquipment(LIST, ['dumbbell', 'bench']).map((e) => e.id)).toContain('덤벨벤치');
  });

  it('벤치만 있으면 덤벨 벤치프레스는 여전히 안 나온다', () => {
    expect(filterByEquipment(LIST, ['bench']).map((e) => e.id)).toEqual(['맨몸1', '맨몸2']);
  });

  it('안 쓰는 장비를 갖고 있어도 결과는 그대로다', () => {
    expect(filterByEquipment(LIST, ['foamRoller']).map((e) => e.id)).toEqual(['맨몸1', '맨몸2']);
  });

  it('중복된 보유 목록에도 흔들리지 않는다', () => {
    expect(filterByEquipment(LIST, ['dumbbell', 'dumbbell']).map((e) => e.id)).toEqual(['맨몸1', '맨몸2', '덤벨1']);
  });

  it('빈 목록을 넣으면 빈 목록이 나온다', () => {
    expect(filterByEquipment([], ['dumbbell'])).toEqual([]);
  });

  it('원본 배열을 건드리지 않는다', () => {
    const before = LIST.map((e) => e.id);
    filterByEquipment(LIST, ['dumbbell']);
    expect(LIST.map((e) => e.id)).toEqual(before);
  });
});

describe('unlockGain', () => {
  it('덤벨을 더하면 늘어나는 개수와 배수를 알려준다', () => {
    expect(unlockGain(LIST, [], 'dumbbell')).toEqual({ before: 2, after: 3, gain: 1, ratio: 1.5 });
  });

  it('이미 갖고 있는 장비는 늘어나는 게 없다', () => {
    expect(unlockGain(LIST, ['dumbbell'], 'dumbbell')).toEqual({ before: 3, after: 3, gain: 0, ratio: 1 });
  });

  it('혼자서는 아무것도 못 여는 장비는 0이다', () => {
    // 벤치는 덤벨이 있어야 의미가 있다. 맨몸 상태에서 벤치만 사면 해금이 0이다 — 이걸 추천하면 안 된다.
    expect(unlockGain(LIST, [], 'bench')).toEqual({ before: 2, after: 2, gain: 0, ratio: 1 });
  });

  it('덤벨을 가진 뒤에는 벤치의 해금량이 생긴다', () => {
    expect(unlockGain(LIST, ['dumbbell'], 'bench')).toEqual({ before: 3, after: 4, gain: 1, ratio: 4 / 3 });
  });

  it('기준이 0이면 배수는 없다', () => {
    // 0으로 나눈 Infinity를 화면에 "무한배"로 띄우면 안 된다.
    expect(unlockGain([ex('덤벨1', ['dumbbell'])], [], 'dumbbell')).toEqual({ before: 0, after: 1, gain: 1, ratio: null });
  });
});
