import type { EquipKey, Exercise } from '../data/exercises';

/**
 * 보유 장비로 할 수 있는 운동만 남긴다.
 *
 * `requires`가 **집합**인 게 핵심이다. 덤벨 벤치프레스는 덤벨과 벤치가 둘 다 있어야 하는데,
 * 원본 데이터의 단일 `equipment` 필드로는 이걸 표현할 수 없어 "덤벨만 있는 사람에게
 * 벤치프레스를 추천하는" 오류가 난다.
 */
export function filterByEquipment(exercises: Exercise[], owned: EquipKey[]): Exercise[] {
  const have = new Set(owned);
  return exercises.filter((e) => e.requires.every((r) => have.has(r)));
}

export type Unlock = {
  before: number;
  after: number;
  gain: number;
  /** 배수. 기준이 0이면 `null`(화면에 "무한배"를 띄우지 않기 위해). */
  ratio: number | null;
};

/**
 * 장비 하나를 더 사면 운동이 몇 개 늘어나는지. **쉐어링크 추천의 유일한 근거다.**
 *
 * 카테고리 필터는 호출하는 쪽 몫이다 — 근력만 세야 훅이 산다(스트레칭까지 넣으면
 * 맨몸 기준이 부풀어 덤벨 배수가 2.17배에서 1.2배로 주저앉는다).
 */
export function unlockGain(exercises: Exercise[], owned: EquipKey[], candidate: EquipKey): Unlock {
  const before = filterByEquipment(exercises, owned).length;
  const after = filterByEquipment(exercises, [...owned, candidate]).length;
  return { before, after, gain: after - before, ratio: before === 0 ? null : after / before };
}
