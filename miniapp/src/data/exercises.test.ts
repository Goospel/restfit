import { describe, expect, it } from 'vitest';

import { EQUIPMENT, EXERCISES, GROUP_KEYS, groupOf, type EquipKey } from './exercises';
import { MISSING_LABELS, MUSCLE_KO } from './labels';
import { filterByEquipment, unlockGain } from '../logic/equipment';

/**
 * 생성된 데이터에 대한 회귀 가드.
 *
 * `scripts/build-exercises.mjs`를 다시 돌렸을 때 조용히 망가지는 것들을 잡는다 —
 * 특히 **덤벨 해금량**은 쉐어링크 추천의 근거라서, 이게 무너지면 아이템의 전제가 무너진다.
 */
const STRENGTH = EXERCISES.filter((e) => e.category === 'strength');

describe('exercises.json', () => {
  it('비어 있지 않다', () => {
    expect(EXERCISES.length).toBeGreaterThan(500);
  });

  it('id가 중복되지 않는다', () => {
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
  });

  it('어휘에 없는 장비를 요구하는 운동이 없다', () => {
    const bad = EXERCISES.filter((e) => e.requires.some((r) => !EQUIPMENT.includes(r)));
    expect(bad.map((e) => e.id)).toEqual([]);
  });

  it('헬스장 전용 장비가 실려 있지 않다', () => {
    // 머신·케이블·스미스는 홈트 앱에서 노이즈다. 어휘에 아예 없으니 위 테스트와 함께 이중으로 막힌다.
    for (const k of ['machine', 'cable', 'smith']) expect(EQUIPMENT).not.toContain(k as EquipKey);
  });

  it('모든 운동이 6개 부위 중 하나에 속한다', () => {
    // 매핑에서 빠진 근육이 있으면 그 운동은 루틴에 영영 안 나온다.
    expect(EXERCISES.filter((e) => groupOf(e) === null).map((e) => e.id)).toEqual([]);
  });

  it('맨몸으로 할 수 있는 근력 운동이 충분하다', () => {
    // 장비를 하나도 안 산 사용자도 앱을 쓸 수 있어야 한다.
    expect(filterByEquipment(STRENGTH, []).length).toBeGreaterThan(50);
  });

  it('덤벨 해금량이 훅으로 쓸 만하다', () => {
    // "덤벨 하나면 운동이 2배" — 쉐어링크 추천의 유일한 근거다.
    const u = unlockGain(STRENGTH, [], 'dumbbell');
    expect(u.gain).toBeGreaterThan(50);
    expect(u.ratio).toBeGreaterThan(2);
  });

  it('덤벨이 단일 최대 해금 장비다', () => {
    const gains = EQUIPMENT.map((k) => [k, unlockGain(STRENGTH, [], k).gain] as const).sort((a, b) => b[1] - a[1]);
    expect(gains[0][0]).toBe('dumbbell');
  });

  it('모든 운동 이름이 한글이다', () => {
    // 사용자는 영어를 못 읽는다. 사전에서 한 토큰만 빠져도 "웨이티드 풀업s" 같은 게 화면에 뜬다.
    // SMR·IT·JM은 한국 헬스에서도 그대로 쓰는 약어다.
    const bad = EXERCISES.filter((e) => /[a-zA-Z]/.test(e.name.replace(/SMR|IT|JM/g, '')));
    expect(bad.map((e) => e.name)).toEqual([]);
  });

  it('이름이 비어 있는 운동이 없다', () => {
    expect(EXERCISES.filter((e) => !e.name?.trim()).map((e) => e.id)).toEqual([]);
  });

  it('장비·부위 한글 라벨이 빠짐없이 있다', () => {
    // 어휘를 늘리고 라벨을 빠뜨리면 화면에 'pullupBar' 같은 영어 키가 그대로 뜬다.
    expect(MISSING_LABELS).toEqual([]);
  });

  it('데이터에 나오는 모든 근육에 한글 이름이 있다', () => {
    const used = new Set(EXERCISES.flatMap((e) => [...e.primaryMuscles, ...e.secondaryMuscles]));
    expect([...used].filter((m) => !MUSCLE_KO[m])).toEqual([]);
  });

  it('매달아야 하는 운동이 맨몸으로 분류되지 않았다', () => {
    // 원본은 "자기 체중을 든다"는 뜻으로 풀업을 body only로 적어 뒀다. 그대로 두면
    // 기구가 하나도 없는 사용자의 첫 화면에 풀업 3종이 뜬다 — 실제로 그렇게 나왔다.
    const needsBar = /pull-?up|chin-?up|hanging|muscle up/i;
    const bad = EXERCISES.filter((e) => e.requires.length === 0 && needsBar.test(e.nameEn));
    expect(bad.map((e) => e.nameEn)).toEqual([]);
  });

  it('모든 부위에 근력 운동이 있다', () => {
    // 어떤 부위가 통째로 비면 루틴 로테이션에서 영영 안 나온다.
    const byGroup = new Set(STRENGTH.map(groupOf));
    expect(GROUP_KEYS.filter((g) => !byGroup.has(g))).toEqual([]);
  });

  it('맨몸만으로도 부위 네 개 이상이 돈다', () => {
    // 기구를 안 산 사용자도 로테이션이 돌아야 한다. 등은 매달 데가 없으면 불가능해 빠진다 — 의도된 결과다.
    const groups = new Set(filterByEquipment(STRENGTH, []).map(groupOf));
    expect(groups.size).toBeGreaterThanOrEqual(4);
  });

  it('장비를 둘 요구하는 운동이 실제로 존재한다', () => {
    // 덤벨 벤치프레스류. 이게 0이면 requires를 집합으로 둔 의미가 없다.
    expect(EXERCISES.filter((e) => e.requires.length >= 2).length).toBeGreaterThan(10);
  });
});

describe('벤치 각도', () => {
  const ANGLED = /인클라인|디클라인/;
  const usesBench = (e: (typeof EXERCISES)[number]) => e.requires.some((r) => r === 'bench' || r === 'benchAdjustable');

  it('각도가 필요한 운동은 조절식 벤치를 요구한다', () => {
    // 평벤치만 가진 사람에게 인클라인 벤치프레스가 나오는 건 **못 하는 운동을 시키는 것**이다.
    // 실제로 그렇게 나왔다 — 벤치를 체크하자마자 첫 루틴이 인클라인 덤벨 벤치프레스였다.
    const angled = EXERCISES.filter((e) => ANGLED.test(e.name) && usesBench(e));
    expect(angled.length).toBeGreaterThan(20);
    for (const e of angled) {
      expect(e.requires, e.name).toContain('benchAdjustable');
      expect(e.requires, e.name).not.toContain('bench');
    }
  });

  it('각도어가 없는 벤치 운동은 평벤치로 남는다', () => {
    // 반대 방향도 막는다 — 전부 조절식으로 몰면 평벤치 사용자가 벤치 운동을 통째로 잃는다.
    const flat = EXERCISES.filter((e) => e.requires.includes('bench'));
    expect(flat.length).toBeGreaterThan(20);
    for (const e of flat) expect(e.name, e.name).not.toMatch(ANGLED);
  });

  it('조절식 벤치가 어휘에 있다', () => {
    expect(EQUIPMENT).toContain('benchAdjustable' as EquipKey);
  });
});
