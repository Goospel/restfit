// @vitest-environment jsdom
// ⚠️ 전역으로 켜면 shareLinks 테스트가 죽는다 — 이유는 `Onboarding.test.tsx` 머리말 참조.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EquipKey } from '../data/exercises';
import { PICKABLE } from '../logic/equipSpec';
import { Shop } from './Shop';

afterEach(cleanup);

function setup(owned: EquipKey[]) {
  const onEditEquipment = vi.fn();
  render(<Shop owned={owned} spec={{}} onEditEquipment={onEditEquipment} />);
  return onEditEquipment;
}

describe('기구 탭 — 내 보유 기구 요약 카드', () => {
  it('개수와 이름을 함께 말한다', () => {
    // 개수는 제목이, 무엇인지는 아랫줄이 말한다 — 이름이 잘려도 개수는 안 사라진다.
    setup(['dumbbell', 'bench']);
    expect(screen.getByText('내 보유 기구 2개')).toBeTruthy();
    expect(screen.getByText('덤벨 · 벤치')).toBeTruthy();
  });

  it('하나도 없으면 맨몸으로 돌고 있다고 말한다', () => {
    // 「0개」는 고장으로 읽힌다 — 지금도 루틴이 나온다는 사실을 함께 적는다.
    setup([]);
    expect(screen.getByText('내 보유 기구 없음')).toBeTruthy();
    expect(screen.getByText('맨몸 운동만으로 루틴을 만들고 있어요')).toBeTruthy();
  });

  it('바꾸기를 누르면 보유 기구 페이지로 간다', () => {
    const open = setup(['dumbbell']);
    fireEvent.click(screen.getByRole('button', { name: '바꾸기' }));
    expect(open).toHaveBeenCalled();
  });

  it('더 권할 기구가 없어도 카드는 남는다', () => {
    // 기구를 **줄이는** 정리도 이 입구로 한다 — 추천이 소진됐다고 입구까지 사라지면 안 된다.
    setup([...PICKABLE]);
    expect(screen.getByText('더 권할 기구가 없습니다.')).toBeTruthy();
    expect(screen.getByRole('button', { name: '바꾸기' })).toBeTruthy();
  });
});
