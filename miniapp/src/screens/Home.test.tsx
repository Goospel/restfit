// @vitest-environment jsdom
// ⚠️ 전역으로 켜면 shareLinks 테스트가 죽는다 — 이유는 `Onboarding.test.tsx` 머리말 참조.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { Exercise } from '../data/exercises';
import { GOALS } from '../logic/goal';
import type { Routine } from '../logic/routine';
import { Home } from './Home';

afterEach(cleanup);

const ex = (id: string, o: Partial<Exercise> = {}): Exercise => ({
  id,
  name: id,
  nameEn: id,
  requires: [],
  category: 'strength',
  level: 'beginner',
  force: null,
  mechanic: 'compound',
  primaryMuscles: ['chest'],
  secondaryMuscles: [],
  images: [],
  ...o,
});

function setup(routine: Routine) {
  render(
    <Home
      routine={routine}
      history={[]}
      goal="muscle"
      doneToday={false}
      onStart={() => {}}
      onOpenSettings={() => {}}
    />,
  );
}

describe('홈 — 오늘의 유닛', () => {
  it('상체 루틴이면 「오늘은 상체」다', () => {
    // 로테이션 단위가 부위에서 유닛으로 바뀌었으니 헤드라인도 유닛을 말해야 한다.
    setup({ unit: 'upper', exercises: [ex('a'), ex('b')] });
    expect(screen.getByRole('heading').textContent).toBe('오늘은 상체');
  });

  it('하체 루틴이면 「오늘은 하체」다', () => {
    setup({ unit: 'lower', exercises: [ex('a')] });
    expect(screen.getByRole('heading').textContent).toBe('오늘은 하체');
  });

  it('유닛이 없으면 빈 루틴 화면이다', () => {
    setup({ unit: null, exercises: [] });
    expect(screen.getByText('할 수 있는 운동을 찾지 못했습니다.')).toBeTruthy();
  });

  it('예상 시간이 4종목 기준으로 커진다', () => {
    // 종목 수가 3→4로 는 만큼 세션이 길어진다(설계 §3.8.4 · muscle 기준 ~32분).
    // 여기서 숫자가 안 움직이면 화면이 목록이 아니라 옛 상수를 읽고 있다는 뜻이다.
    const four = [ex('a'), ex('b'), ex('c'), ex('d')];
    setup({ unit: 'upper', exercises: four });
    // 3세트 × (작업 40초 + 복합 휴식 150초) × 4종목 = 38분
    const expected = Math.round((3 * (40 + GOALS.muscle.restCompound) * 4) / 60);
    expect(screen.getByText(new RegExp(`4개 운동 · 각 3세트 · 약 ${expected}분`))).toBeTruthy();

    cleanup();
    setup({ unit: 'upper', exercises: four.slice(0, 3) });
    const three = Math.round((3 * (40 + GOALS.muscle.restCompound) * 3) / 60);
    expect(screen.getByText(new RegExp(`3개 운동 · 각 3세트 · 약 ${three}분`))).toBeTruthy();
    expect(three).toBeLessThan(expected);
  });
});
