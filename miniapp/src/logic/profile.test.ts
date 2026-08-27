import { describe, expect, it } from 'vitest';

import { EXERCISES } from '../data/exercises';
import { isAvoided, isFeel, nextExperience } from './profile';

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

describe('nextExperience — 세션 피드백 승급·강등', () => {
  it('빈 기록이면 유지한다', () => {
    // 첫 세션에 아무 근거 없이 수준을 옮기면 온보딩 답을 즉시 뒤집는 꼴이다.
    expect(nextExperience('beginner', [])).toBe('beginner');
  });

  it('3연속 easy면 한 단계 올린다', () => {
    expect(nextExperience('beginner', ['easy', 'easy', 'easy'])).toBe('intermediate');
    expect(nextExperience('intermediate', ['easy', 'easy', 'easy'])).toBe('advanced');
  });

  it('easy 2개까지는 유지한다 — 승급 임계는 정확히 3이다', () => {
    // ★ 임계가 2로 내려가면 「조금 쉬웠던 이틀」이 곧바로 승급이 된다.
    expect(nextExperience('beginner', ['easy', 'easy'])).toBe('beginner');
  });

  it('2연속 hard면 한 단계 내린다 — 강등이 승급보다 민감한 것은 의도다', () => {
    // 과부하 쪽 오류가 이탈·부상 비용이 더 크다(설계 §3.6).
    expect(nextExperience('advanced', ['hard', 'hard'])).toBe('intermediate');
    expect(nextExperience('intermediate', ['hard', 'hard'])).toBe('beginner');
  });

  it('hard 1개로는 안 내린다 — 강등 임계는 정확히 2다', () => {
    expect(nextExperience('advanced', ['hard'])).toBe('advanced');
  });

  it('상급에서 더 못 오르고, 초급에서 더 못 내린다', () => {
    // 사다리 밖으로 나가면 EXPERIENCE_KEYS 인덱스가 undefined가 되어 화면이 죽는다.
    expect(nextExperience('advanced', ['easy', 'easy', 'easy'])).toBe('advanced');
    expect(nextExperience('beginner', ['hard', 'hard'])).toBe('beginner');
  });

  it('feel이 없는(건너뛴) 레코드가 스트릭을 끊는다', () => {
    // ★ **보수적이어야 한다** — 무응답을 easy로 세면 아무 말 안 한 사람을 오승급시킨다.
    expect(nextExperience('beginner', [undefined, 'easy', 'easy', 'easy'])).toBe('beginner');
    expect(nextExperience('beginner', ['easy', undefined, 'easy', 'easy'])).toBe('beginner');
    expect(nextExperience('advanced', [undefined, 'hard', 'hard'])).toBe('advanced');
  });

  it('ok가 스트릭을 끊는다', () => {
    // 「적당하다」는 지금 수준이 맞다는 뜻이다 — 그게 스트릭을 이어 주면 안 된다.
    expect(nextExperience('beginner', ['easy', 'easy', 'ok', 'easy'])).toBe('beginner');
    expect(nextExperience('advanced', ['hard', 'ok', 'hard'])).toBe('advanced');
  });

  it('가장 최근 것만 본다 — 옛 스트릭은 되살아나지 않는다', () => {
    // 최근 것이 앞이다. 뒤쪽에 남은 3연속 easy가 오늘의 판정을 건드리면
    // 한 번 쌓인 스트릭이 영원히 승급을 예약해 둔 셈이 된다.
    expect(nextExperience('beginner', ['ok', 'easy', 'easy', 'easy'])).toBe('beginner');
  });
});

describe('isFeel — 저장소에서 읽은 값', () => {
  it('어휘 안의 값만 통과시킨다', () => {
    expect(isFeel('easy')).toBe(true);
    expect(isFeel('ok')).toBe(true);
    expect(isFeel('hard')).toBe(true);
    expect(isFeel('very-hard')).toBe(false);
    expect(isFeel(undefined)).toBe(false);
    expect(isFeel(3)).toBe(false);
  });
});
