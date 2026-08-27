import { describe, expect, it } from 'vitest';

import { EXERCISES } from '../data/exercises';
import { isAvoided } from './profile';

/** 설계 §3.2의 실측 수치는 전부 **근력 408종** 기준이다. */
const STRENGTH = EXERCISES.filter((e) => e.category === 'strength');
const byId = (id: string) => STRENGTH.find((e) => e.id === id)!;
const excluded = (avoid: Parameters<typeof isAvoided>[1]) => STRENGTH.filter((e) => isAvoided(e, avoid)).length;

describe('isAvoided — 불편 부위 하드 제외', () => {
  it('고른 부위가 없으면 아무것도 안 뺀다', () => {
    // 프로필을 채웠어도 「없음」이면 현행 그대로여야 한다.
    expect(excluded([])).toBe(0);
  });

  it('무릎은 주동근만으로 50종을 뺀다', () => {
    // 스쿼트·런지류가 전부 quadriceps primary라 **주동근만으로 충분하다**(설계 §3.2 실측).
    expect(excluded(['knee'])).toBe(50);
    expect(isAvoided(byId('Barbell_Squat'), ['knee'])).toBe(true);
    expect(isAvoided(byId('Barbell_Curl'), ['knee'])).toBe(false);
  });

  it('어깨는 주동근만 본다 — 가슴 종목이 전부 살아남는다', () => {
    // ★ **보조근까지 걸면 가슴 47종 중 43종이 전멸한다**(실측). 벤치류의 어깨 관여가
    //   secondary로 기재돼 있어서다 — 그건 필터가 아니라 상체 몰살이라 주동근만 본다.
    const bench = byId('Barbell_Bench_Press_-_Medium_Grip');
    expect(bench.secondaryMuscles).toContain('shoulders'); // 전제: 이 종목은 보조근에 어깨가 있다
    expect(isAvoided(bench, ['shoulder'])).toBe(false);

    const chest = STRENGTH.filter((e) => e.primaryMuscles[0] === 'chest');
    expect(chest).toHaveLength(47);
    expect(chest.filter((e) => isAvoided(e, ['shoulder']))).toHaveLength(0);
    expect(excluded(['shoulder'])).toBe(83);
  });

  it('허리는 보조근까지 본다 — 바벨 스쿼트가 빠진다', () => {
    // ★ 주동근만 보면 **3종뿐**이라 필터가 사실상 아무 일도 안 한다(실측). 스쿼트·데드리프트의
    //   축성 부하가 secondary로 기재돼 있어, 허리만은 보조근까지 봐야 의미를 가진다.
    const squat = byId('Barbell_Squat');
    expect(squat.primaryMuscles).not.toContain('lower back'); // 전제: 주동근에는 허리가 없다
    expect(squat.secondaryMuscles).toContain('lower back');
    expect(isAvoided(squat, ['lowerBack'])).toBe(true);

    expect(STRENGTH.filter((e) => e.primaryMuscles.includes('lower back'))).toHaveLength(3);
    expect(excluded(['lowerBack'])).toBe(43);
  });

  it('부위를 여럿 고르면 합집합으로 뺀다', () => {
    // 하나라도 걸리면 뺀다 — 안전 쪽으로 기운다.
    const knee = STRENGTH.filter((e) => isAvoided(e, ['knee']));
    const shoulder = STRENGTH.filter((e) => isAvoided(e, ['shoulder']));
    const both = STRENGTH.filter((e) => isAvoided(e, ['knee', 'shoulder']));
    expect(both).toHaveLength(new Set([...knee, ...shoulder]).size);
    expect(both.length).toBeGreaterThan(Math.max(knee.length, shoulder.length));
  });
});
