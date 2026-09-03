// @vitest-environment jsdom
// ⚠️ 전역으로 켜면 shareLinks 테스트가 죽는다 — 이유는 `Onboarding.test.tsx` 머리말 참조.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EquipKey } from '../data/exercises';
import { ExercisePicker } from './ExercisePicker';

afterEach(cleanup);

function setup(picked: string[] = [], owned: EquipKey[] = []) {
  const onChange = vi.fn();
  const onBack = vi.fn();
  render(<ExercisePicker picked={picked} owned={owned} onChange={onChange} onBack={onBack} />);
  return { onChange, onBack };
}

/** 검색창에 친다. 별칭 표가 실제로 도는지 보는 유일한 통로다. */
function search(q: string) {
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: q } });
}

/** 목록에 실린 줄들 — 위에서부터. 부위 칩도 `aria-pressed`라 목록 안에서만 센다. */
const rows = () => within(screen.getByRole('group', { name: '운동 목록' })).getAllByRole('button');

describe('내 운동 고르기', () => {
  it('제목이 「내 운동」이다 — 홈의 입구 라벨과 같아야 제자리인 줄 안다', () => {
    setup();
    expect(screen.getByRole('heading', { name: '내 운동' })).toBeTruthy();
  });

  /**
   * ★ **이 화면이 생긴 이유다.** 데이터의 이름은 원어 음차(「풀업」)인데 사람은 우리말로
   * 찾는다 — 「턱걸이」로 0건이면 그 운동은 앱에 없는 것과 같고, 사용자는 다시 「고를 수가
   * 없다」로 돌아온다(제보 2026-09-03).
   */
  it('「턱걸이」로 풀업과 친업을 찾는다', () => {
    setup();
    search('턱걸이');
    expect(screen.getByText('풀업')).toBeTruthy();
    expect(screen.getByText('친업')).toBeTruthy();
  });

  it('「푸쉬업」·「팔굽혀펴기」로도 푸시업을 찾는다 — 표기가 갈리는 자리다', () => {
    setup();
    search('푸쉬업');
    expect(screen.getByText('푸시업')).toBeTruthy();
    search('팔굽혀펴기');
    expect(screen.getByText('푸시업')).toBeTruthy();
  });

  /**
   * 별칭 하나가 7종을 물어 온다. 이름순으로만 두면 정작 「풀업」이 다섯째 줄이라
   * 폰에서는 스크롤을 해야 나온다 — 찾은 것과 못 찾은 것의 차이가 거기서 갈린다.
   */
  it('찾던 그 운동이 맨 위 두 줄이다 — 별칭이 물어 온 변형들보다 앞', () => {
    setup();
    search('턱걸이');
    const top = rows().slice(0, 2).map((b) => b.textContent ?? '');
    expect(top.some((t) => t.startsWith('풀업'))).toBe(true);
    expect(top.some((t) => t.startsWith('친업'))).toBe(true);
  });

  it('별칭을 다 치기 전에도 찾는다 — 한 글자씩 치는 동안 0건이면 지운다', () => {
    setup();
    search('턱걸');
    expect(screen.getByText('풀업')).toBeTruthy();
  });

  it('부위 이름으로도 찾는다', () => {
    setup();
    search('광배근');
    expect(screen.getByText('풀업')).toBeTruthy();
  });

  it('스트레칭은 없다 — 세트와 휴식이 없으면 광고 자리도 루틴도 없다', () => {
    setup();
    search('햄스트링');
    // 근력은 나오고(레그 컬 계열), 같은 근육의 스트레칭 항목은 안 나온다.
    expect(screen.queryByText('90/90 햄스트링')).toBeNull();
  });

  it('운동을 누르면 목록 끝에 더해진다 — 고른 순서가 곧 루틴 순서다', () => {
    const { onChange } = setup(['Pushups']);
    search('턱걸이');
    fireEvent.click(screen.getByText('풀업'));
    expect(onChange).toHaveBeenCalledWith(['Pushups', 'Pullups']);
  });

  it('이미 고른 것을 누르면 빠진다', () => {
    const { onChange } = setup(['Pushups', 'Pullups']);
    search('턱걸이');
    fireEvent.click(screen.getByText('풀업'));
    expect(onChange).toHaveBeenCalledWith(['Pushups']);
  });

  it('전체 해제는 빈 목록을 준다 — 그게 추천으로 돌아가는 문이다', () => {
    const { onChange } = setup(['Pushups', 'Pullups']);
    fireEvent.click(screen.getByRole('button', { name: '전체 해제' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('아무것도 안 골랐으면 전체 해제가 없다', () => {
    setup();
    expect(screen.queryByRole('button', { name: '전체 해제' })).toBeNull();
  });

  it('부위 칩을 누르면 그 부위만 보인다', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: '다리' }));
    expect(screen.getByText('맨몸 스쿼트')).toBeTruthy();
    expect(screen.queryByText('푸시업')).toBeNull();
  });

  /**
   * 안 가진 기구를 **막지 않고 말만 한다.** 막으면 「풀업바를 안 골랐다」는 이유로 풀업이
   * 또 사라져서, 이 화면을 만든 이유가 그대로 재발한다.
   */
  it('안 가진 기구는 알려 주되 고를 수 있다', () => {
    const { onChange } = setup([], []);
    search('턱걸이');
    expect(screen.getAllByText('풀업바 필요').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('풀업'));
    expect(onChange).toHaveBeenCalledWith(['Pullups']);
  });

  /**
   * 막지 않는 대신 **순서로** 답한다. 기구가 하나도 없는 사람의 가슴 목록은 초급·이름순으로만
   * 두면 첫 다섯 줄이 전부 「덤벨 필요」라, 정작 푸시업을 찾으려고 한참 내려야 했다.
   */
  it('기구가 없으면 맨몸 운동이 먼저 온다', () => {
    setup([], []);
    expect(rows()[0].textContent ?? '').not.toMatch(/필요/);
  });

  it('가진 기구면 「필요」 딱지가 없다', () => {
    setup([], ['pullupBar']);
    search('턱걸이');
    expect(screen.queryByText('풀업바 필요')).toBeNull();
  });

  it('닫기는 onBack을 부른다', () => {
    const { onBack } = setup();
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(onBack).toHaveBeenCalled();
  });
});
