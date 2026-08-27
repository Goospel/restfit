// @vitest-environment jsdom
// ⚠️ 전역으로 켜면 shareLinks 테스트가 죽는다 — 이유는 `Onboarding.test.tsx` 머리말 참조.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Profile } from '../logic/profile';
import { Settings } from './Settings';

afterEach(cleanup);

function setup(profile: Profile | null) {
  const onProfileChange = vi.fn();
  render(
    <Settings
      owned={[]}
      spec={{}}
      onChange={() => {}}
      onSpecChange={() => {}}
      goal="health"
      onGoalChange={() => {}}
      profile={profile}
      onProfileChange={onProfileChange}
      onBack={() => {}}
    />,
  );
  return onProfileChange;
}

// 경험 버튼은 설명 줄을 함께 담아 접근성 이름이 「초급 운동을 시작한 지…」가 된다 — 부분 일치로 잡는다.
const btn = (name: string | RegExp) => screen.getByRole('button', { name }) as HTMLButtonElement;
const click = (name: string | RegExp) => fireEvent.click(btn(name));

describe('설정 — 운동 경험 · 불편한 부위', () => {
  it('경험 3단계를 모두 보여준다', () => {
    // 상급은 온보딩 질문으로 못 얻지만 **승급으로 도달한다.** 여기 안 그리면
    // 승급한 사람에게 자기 상태가 안 보이고, 되돌릴 방법도 없다.
    setup({ experience: 'advanced', avoid: [] });
    expect(btn(/초급/).getAttribute('aria-pressed')).toBe('false');
    expect(btn(/중급/).getAttribute('aria-pressed')).toBe('false');
    expect(btn(/상급/).getAttribute('aria-pressed')).toBe('true');
  });

  it('경험을 바꾸면 불편 부위를 유지한 채 저장한다', () => {
    // 한 축을 건드렸다고 다른 축이 날아가면 사용자가 눈치채지 못한 채 필터가 풀린다.
    const save = setup({ experience: 'beginner', avoid: ['knee'] });
    click(/중급/);
    expect(save).toHaveBeenCalledWith({ experience: 'intermediate', avoid: ['knee'] });
  });

  it('불편 부위를 고르면 경험을 유지한 채 저장한다', () => {
    const save = setup({ experience: 'intermediate', avoid: [] });
    click('허리');
    expect(save).toHaveBeenCalledWith({ experience: 'intermediate', avoid: ['lowerBack'] });
  });

  it('「없음」을 누르면 부위를 전부 비운다', () => {
    const save = setup({ experience: 'intermediate', avoid: ['knee', 'shoulder'] });
    click('없음');
    expect(save).toHaveBeenCalledWith({ experience: 'intermediate', avoid: [] });
  });

  it('면책 문구는 온보딩과 같은 문장이다', () => {
    setup({ experience: 'beginner', avoid: [] });
    expect(screen.getByText('불편한 부위를 많이 쓰는 운동을 뺍니다.')).toBeTruthy();
    expect(screen.getByText('통증이 있다면 전문가와 상담해 주세요.')).toBeTruthy();
  });

  describe('프로필이 없는 기존 사용자', () => {
    it('아무 경험도 선택돼 있지 않다', () => {
      // 기본값을 대신 칠해 두면 「안 고른 사람」이 「초급을 고른 사람」으로 둔갑한다.
      setup(null);
      for (const k of [/초급/, /중급/, /상급/]) expect(btn(k).getAttribute('aria-pressed')).toBe('false');
    });

    it('경험을 고르면 빈 부위 목록과 함께 프로필이 생긴다', () => {
      const save = setup(null);
      click(/초급/);
      expect(save).toHaveBeenCalledWith({ experience: 'beginner', avoid: [] });
    });

    it('경험을 고르기 전에는 부위를 못 고른다', () => {
      // 경험 없이 부위만 저장할 방법이 없다 — 프로필은 경험이 있어야 성립한다.
      // 여기서 아무 경험이나 대신 채우면 그게 바로 「반쪽 프로필」이다.
      const save = setup(null);
      expect(btn('무릎').disabled).toBe(true);
      click('무릎');
      expect(save).not.toHaveBeenCalled();
    });
  });
});
