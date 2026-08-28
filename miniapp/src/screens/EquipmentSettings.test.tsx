// @vitest-environment jsdom
// ⚠️ 전역으로 켜면 shareLinks 테스트가 죽는다 — 이유는 `Onboarding.test.tsx` 머리말 참조.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EquipKey } from '../data/exercises';
import type { EquipSpec } from '../logic/equipSpec';
import { EquipmentSettings } from './EquipmentSettings';

afterEach(cleanup);

function setup(owned: EquipKey[] = [], spec: EquipSpec = {}) {
  const onChange = vi.fn();
  const onBack = vi.fn();
  render(
    <EquipmentSettings
      owned={owned}
      spec={spec}
      onChange={onChange}
      onSpecChange={() => {}}
      onBack={onBack}
    />,
  );
  return { onChange, onBack };
}

/** 카운터 카드의 숫자. 「지금 할 수 있는 근력 운동」 아래 큰 글씨 하나다. */
function count(): number {
  const el = screen.getByText('지금 할 수 있는 근력 운동').nextElementSibling;
  return Number(el!.textContent!.replace('개', ''));
}

describe('보유 기구 페이지', () => {
  it('제목이 「보유 기구」다', () => {
    // 입구 라벨이 페이지 이름과 같아야 눌러서 온 사람이 제자리인지 안다.
    setup();
    expect(screen.getByRole('heading', { name: '보유 기구' })).toBeTruthy();
  });

  it('목적·경험·부위는 이 페이지에 없다 — 운동 목적 페이지로 갔다', () => {
    setup();
    expect(screen.queryByRole('heading', { name: '운동 목적' })).toBeNull();
    expect(screen.queryByRole('heading', { name: '운동 경험' })).toBeNull();
    expect(screen.queryByRole('heading', { name: '불편한 부위' })).toBeNull();
  });

  it('기구를 가지면 할 수 있는 근력 운동 수가 는다', () => {
    // 체크 하나가 곧 「할 수 있는 운동 수」로 보여야 고르는 이유가 생긴다.
    setup();
    const bare = count();
    cleanup();
    setup(['dumbbell']);
    expect(count()).toBeGreaterThan(bare);
  });

  it('기구를 누르면 선택이 바뀐다', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: /덤벨/ }));
    expect(onChange).toHaveBeenCalledWith(['dumbbell']);
  });

  it('닫기를 누르면 돌아간다', () => {
    const { onBack } = setup();
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(onBack).toHaveBeenCalled();
  });
});
