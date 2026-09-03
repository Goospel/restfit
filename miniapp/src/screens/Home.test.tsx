// @vitest-environment jsdom
// ⚠️ 전역으로 켜면 shareLinks 테스트가 죽는다 — 이유는 `Onboarding.test.tsx` 머리말 참조.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Exercise } from '../data/exercises';
import { GOALS } from '../logic/goal';
import type { Profile } from '../logic/profile';
import type { Routine } from '../logic/routine';
import type { WorkoutRecord } from '../storage';
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

const DONE: WorkoutRecord[] = [
  { date: '2026-09-01', group: 'upper', entries: [{ id: 'a', name: 'a', sets: [{ weight: 0, reps: 10 }] }] },
];

function setup(
  routine: Routine,
  {
    history = [],
    profile = null,
    customCount = 0,
  }: { history?: WorkoutRecord[]; profile?: Profile | null; customCount?: number } = {},
) {
  const onOpenEquipment = vi.fn();
  const onOpenGoal = vi.fn();
  const onOpenCustom = vi.fn();
  render(
    <Home
      routine={routine}
      history={history}
      goal="muscle"
      profile={profile}
      doneToday={false}
      customCount={customCount}
      onStart={() => {}}
      onOpenEquipment={onOpenEquipment}
      onOpenGoal={onOpenGoal}
      onOpenCustom={onOpenCustom}
    />,
  );
  return { onOpenEquipment, onOpenGoal, onOpenCustom };
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

  it('빈 루틴 화면은 불편 부위 설정도 짚어 준다', () => {
    // 부상 제외는 **하드 필터**라 폴백으로 되살리지 않는다(설계 §3.2) — 전부 걸러진
    // 병리적 조합에서 화면이 기구만 탓하면 사용자가 원인을 영영 못 찾는다.
    setup({ unit: null, exercises: [] });
    expect(screen.getByText(/불편 부위/)).toBeTruthy();
  });

  it('빈 루틴 화면의 두 버튼이 각각 제 페이지로 간다', () => {
    // 짚어 준 원인이 둘인데 갈 곳이 하나면, 나머지 하나는 짚어만 주고 못 고치게 두는 셈이다.
    const { onOpenEquipment, onOpenGoal } = setup({ unit: null, exercises: [] });

    fireEvent.click(screen.getByRole('button', { name: '보유 기구 확인' }));
    expect(onOpenEquipment).toHaveBeenCalled();
    expect(onOpenGoal).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '불편한 부위 확인' }));
    expect(onOpenGoal).toHaveBeenCalled();
    expect(onOpenEquipment).toHaveBeenCalledTimes(1);
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

describe('홈 — 목적 칩', () => {
  const routine: Routine = { unit: 'upper', exercises: [ex('a')] };

  it('무엇을 여는 버튼인지 접두어가 말한다', () => {
    // 목적 이름만 있으면 라벨이 내용의 4분의 1만 말한다 — 「목적 ·」이 정체를, ›가 눌림을 말한다.
    setup(routine);
    expect(screen.getByRole('button', { name: '목적 · 근육 키우기 ›' })).toBeTruthy();
  });

  it('칩은 운동 목적 페이지만 연다', () => {
    const { onOpenEquipment, onOpenGoal } = setup(routine);
    fireEvent.click(screen.getByRole('button', { name: /목적 · / }));
    expect(onOpenGoal).toHaveBeenCalled();
    expect(onOpenEquipment).not.toHaveBeenCalled();
  });
});

describe('홈 — 프로필 안내 칩', () => {
  const CHIP = '경험을 알려주시면 난이도를 맞춰드려요';
  const routine: Routine = { unit: 'upper', exercises: [ex('a'), ex('b')] };

  it('프로필이 없고 기록이 있으면 칩이 뜬다', () => {
    // 이 화면이 생기기 전부터 쓰던 사람 — 물어본 적이 없으니 개인화가 꺼져 있다.
    setup(routine, { history: DONE });
    expect(screen.getByText(CHIP)).toBeTruthy();
  });

  it('칩을 누르면 운동 목적 페이지가 열린다', () => {
    // 안내만 하고 갈 곳을 안 주면 「그래서 어디서 하는데」로 끝난다.
    // 경험은 운동 목적 페이지에 있다 — 기구 페이지로 보내면 도착해서 답을 못 찾는다.
    const { onOpenEquipment, onOpenGoal } = setup(routine, { history: DONE });
    fireEvent.click(screen.getByText(CHIP));
    expect(onOpenGoal).toHaveBeenCalled();
    expect(onOpenEquipment).not.toHaveBeenCalled();
  });

  it('프로필을 채우면 칩이 사라진다', () => {
    // **설정 전까지 상시 노출**이라 dismiss 상태를 안 둔다(설계 §6 · 결정 4) — 프로필이
    // 채워지는 순간 자연히 사라지는 것이 유일한 소멸 경로다.
    setup(routine, { history: DONE, profile: { experience: 'beginner', avoid: [] } as Profile });
    expect(screen.queryByText(CHIP)).toBeNull();
  });

  it('기록이 없으면 칩이 안 뜬다', () => {
    // 신규 사용자는 **온보딩에서 이미 물어봤다.** 방금 답한 걸 또 조르면 안내가 아니라 잔소리다.
    setup(routine, { history: [] });
    expect(screen.queryByText(CHIP)).toBeNull();
  });
});

describe('홈 — 내 운동 입구', () => {
  const routine: Routine = { unit: 'upper', exercises: [ex('a'), ex('b')] };

  it('안 골랐으면 고르러 가자고 말한다 — 추천을 쓰는 중이라는 뜻이다', () => {
    const { onOpenCustom } = setup(routine);
    fireEvent.click(screen.getByRole('button', { name: '하고 싶은 운동 직접 고르기' }));
    expect(onOpenCustom).toHaveBeenCalled();
  });

  it('골랐으면 몇 개인지 말한다 — 오늘 목록이 왜 이건지가 그 한 줄로 설명된다', () => {
    setup(routine, { customCount: 2 });
    expect(screen.getByRole('button', { name: '내 운동 2개 · 바꾸기' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '하고 싶은 운동 직접 고르기' })).toBeNull();
  });

  it('직접 고른 사람에게는 「그건 정해뒀습니다」가 안 뜬다 — 자기가 정한 목록 위의 딴소리다', () => {
    const line = '제일 어려운 건 뭘 할지 정하는 거고, 그건 정해뒀습니다. 아래대로만 하시면 됩니다.';
    setup(routine, { history: [], customCount: 2 });
    expect(screen.queryByText(line)).toBeNull();

    cleanup();
    setup(routine, { history: [] });
    expect(screen.getByText(line)).toBeTruthy();
  });

  it('빈 루틴 화면에도 출구가 있다 — 설정만 짚어 주면 하고 싶은 게 정해진 사람은 앱을 닫는다', () => {
    const { onOpenCustom } = setup({ unit: null, exercises: [] });
    fireEvent.click(screen.getByRole('button', { name: '운동 직접 고르기' }));
    expect(onOpenCustom).toHaveBeenCalled();
  });
});
