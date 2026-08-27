// @vitest-environment jsdom
// ⚠️ 전역으로 켜면 shareLinks 테스트가 죽는다 — 이유는 `Onboarding.test.tsx` 머리말 참조.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Exercise } from '../data/exercises';
import type { Profile } from '../logic/profile';
import { startSession, type Session } from '../logic/session';
import type { WorkoutRecord } from '../storage';
import { Workout } from './Workout';

afterEach(cleanup);

const ex = (id: string, requires: Exercise['requires'] = []): Exercise => ({
  id,
  name: id,
  nameEn: id,
  requires,
  category: 'strength',
  level: 'beginner',
  force: null,
  mechanic: 'compound',
  primaryMuscles: ['chest'],
  secondaryMuscles: [],
  images: [],
});

/** 세트 하나를 마친 채로 끝난 세션 — 기록이 남을 최소 조건이다. */
function finished(): Session {
  const s = startSession([ex('push')], 'health');
  return { ...s, done: [[{ weight: 0, reps: 10 }]], finished: true };
}

const feelRec = (date: string, feel?: WorkoutRecord['feel']): WorkoutRecord => ({
  date,
  group: 'upper',
  entries: [],
  ...(feel ? { feel } : null),
});

function setup(o: { profile?: Profile | null; history?: WorkoutRecord[]; session?: Session } = {}) {
  const onFinish = vi.fn();
  const onProfileChange = vi.fn();
  render(
    <Workout
      session={o.session ?? finished()}
      group="upper"
      onChange={() => {}}
      onFinish={onFinish}
      history={o.history ?? []}
      spec={{}}
      date="2026-08-27"
      profile={o.profile === undefined ? { experience: 'beginner', avoid: [] } : o.profile}
      onProfileChange={onProfileChange}
    />,
  );
  return { onFinish, onProfileChange };
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const save = () => click('기록 저장하고 끝내기');

describe('운동 완료 — 세션 피드백', () => {
  it('고른 feel이 기록에 함께 저장된다', () => {
    const { onFinish } = setup();
    click('힘듦');
    save();
    expect(onFinish.mock.calls[0][0].feel).toBe('hard');
  });

  it('안 고르고 저장하면 feel 없이 저장된다 — 1문항은 선택 사항이다', () => {
    // ★ 필수로 만들면 응답률이 아니라 **기록 저장률**이 깎인다. 무응답은 무응답으로 남긴다.
    const { onFinish } = setup();
    save();
    expect(onFinish.mock.calls[0][0].feel).toBeUndefined();
    expect(onFinish.mock.calls[0][0].entries).toHaveLength(1);
  });

  it('고른 것을 다시 누르면 선택이 풀린다', () => {
    // 잘못 누른 답을 되돌릴 길이 없으면 사용자는 틀린 답을 그대로 저장한다.
    const { onFinish } = setup();
    click('쉬움');
    click('쉬움');
    save();
    expect(onFinish.mock.calls[0][0].feel).toBeUndefined();
  });

  it('승급이 나면 안내 한 줄을 보여주고 프로필을 옮긴다', () => {
    // 제안-승인형은 탭을 하나 더 요구해 피드백 응답률 자체를 깎는다(설계 §3.6) — 자동 반영이다.
    const { onProfileChange } = setup({ history: [feelRec('2026-08-25', 'easy'), feelRec('2026-08-26', 'easy')] });
    expect(screen.queryByText(/어려운 동작/)).toBeNull(); // 고르기 전에는 안내가 없다
    click('쉬움');
    expect(screen.getByText(/어려운 동작/)).toBeTruthy();
    save();
    expect(onProfileChange).toHaveBeenCalledWith({ experience: 'intermediate', avoid: [] });
  });

  it('강등 문구는 부드럽다 — 실패를 통보하지 않는다', () => {
    const { onProfileChange } = setup({
      profile: { experience: 'advanced', avoid: ['knee'] },
      history: [feelRec('2026-08-26', 'hard')],
    });
    click('힘듦');
    expect(screen.getByText(/가볍게/)).toBeTruthy();
    save();
    // 불편 부위는 그대로 들고 간다 — 승급이 다른 축을 조용히 지우면 안 된다.
    expect(onProfileChange).toHaveBeenCalledWith({ experience: 'intermediate', avoid: ['knee'] });
  });

  it('오늘 답이 스트릭의 맨 앞이다 — 3연속 easy 뒤에 「힘듦」이면 승급이 아니다', () => {
    // ★ 오늘 것을 목록 **끝**에 붙이면 정반대가 된다: 직전 3세션이 쉬웠던 사람이 오늘
    //   「힘듦」을 골랐는데 승급한다. 균일한 feel만 넣은 케이스는 앞뒤가 같은 답을 내서
    //   이 뒤집기를 못 잡는다 — 비대칭 기록이 있어야 순서가 잠긴다.
    const { onProfileChange } = setup({
      history: [feelRec('2026-08-24', 'easy'), feelRec('2026-08-25', 'easy'), feelRec('2026-08-26', 'easy')],
    });
    click('힘듦');
    expect(screen.queryByText(/어려운 동작/)).toBeNull();
    save();
    expect(onProfileChange).not.toHaveBeenCalled();
  });

  it('스트릭이 안 찼으면 안내도 없고 프로필도 안 건드린다', () => {
    const { onProfileChange } = setup({ history: [feelRec('2026-08-26', 'easy')] });
    click('쉬움');
    expect(screen.queryByText(/어려운 동작/)).toBeNull();
    save();
    expect(onProfileChange).not.toHaveBeenCalled();
  });

  it('프로필이 없으면 feel은 저장하되 수준 판정은 안 한다', () => {
    // ★ 승급이 프로필을 대신 만들어 버리면 「경험을 안 고른 사람」이 조용히 사라진다 —
    //   반쪽 프로필은 반쪽 개인화다. 안내 문구도 뜨면 안 된다(바꿀 값이 없다).
    const { onFinish, onProfileChange } = setup({
      profile: null,
      history: [feelRec('2026-08-25', 'easy'), feelRec('2026-08-26', 'easy')],
    });
    click('쉬움');
    expect(screen.queryByText(/어려운 동작/)).toBeNull();
    save();
    expect(onFinish.mock.calls[0][0].feel).toBe('easy');
    expect(onProfileChange).not.toHaveBeenCalled();
  });

  it('한 세트도 안 했으면 안내도 없고 수준도 안 옮긴다', () => {
    // 저장될 기록이 없으니 판정 근거도 없다 — 기록 없는 승급은 다음 세션에 재현되지 않는다.
    //
    // ★ **안내 문구까지 함께 잠근다.** 「반영은 안 하는데 문구는 뜬다」가 실제로 났다:
    //   전 종목을 건너뛰면(마지막에 `skipExercise`가 finished를 세운다) 세트가 하나도 없는
    //   채로 이 화면에 닿는데, 판정과 반영의 조건이 갈라져 있으면 사용자는 「어려운 동작을
    //   드릴게요」를 읽고도 아무 일도 안 일어난다. 호출 0회만 보면 이 반쪽을 못 잡는다.
    const s = startSession([ex('push')], 'health');
    const { onFinish, onProfileChange } = setup({
      session: { ...s, finished: true },
      history: [feelRec('2026-08-25', 'easy'), feelRec('2026-08-26', 'easy')],
    });
    click('쉬움');
    expect(screen.queryByText(/어려운 동작/)).toBeNull();
    save();
    expect(onFinish).toHaveBeenCalledWith(null);
    expect(onProfileChange).not.toHaveBeenCalled();
  });
});

describe('세트 진행 — 졸업 프리필 (§3.7)', () => {
  /** 그 운동을 지난번에 이렇게 했다는 기록. 세트 수·횟수가 졸업 판정의 전부다. */
  const did = (id: string, weight: number, reps: number[]): WorkoutRecord[] => [
    { date: '2026-08-26', group: 'upper', entries: [{ id, name: id, sets: reps.map((r) => ({ weight, reps: r })) }] },
  ];
  // health는 8~15회. 상단 15에 닿았는지로 갈린다.
  const running = (e: Exercise) => startSession([e], 'health');
  const repsInput = () => screen.getByLabelText('횟수') as HTMLInputElement;
  const weightInput = () => screen.getByLabelText('무게 (kg)') as HTMLInputElement;

  it('기구 운동에서 전 세트가 상단이면 무게를 올리고 횟수는 하단으로 채운다', () => {
    const e = ex('bench', ['barbell']);
    setup({ session: running(e), history: did('bench', 20, [15, 15, 15]) });
    expect(weightInput().value).toBe('22.5');
    expect(repsInput().value).toBe('8');
  });

  it('한 세트라도 모자라면 지난 마지막 세트 값이 그대로 뜬다', () => {
    const e = ex('bench', ['barbell']);
    setup({ session: running(e), history: did('bench', 20, [15, 14, 15]) });
    expect(weightInput().value).toBe('20');
    expect(repsInput().value).toBe('15');
  });

  it('맨몸 25회면 다음 동작 힌트가 뜬다', () => {
    // 반복 25~30회를 넘기면 근비대 효율이 급락한다 — 무게를 못 얹으니 동작을 바꿀 때다.
    setup({ session: running(ex('push')), history: did('push', 0, [25, 25, 25]) });
    expect(screen.getByText(/더 어려운 동작/)).toBeTruthy();
  });

  it('맨몸 24회면 아직 안 뜬다 — 경계는 25다', () => {
    setup({ session: running(ex('push')), history: did('push', 0, [24, 24, 24]) });
    expect(screen.queryByText(/더 어려운 동작/)).toBeNull();
    // 힌트는 없어도 프리필은 진행한다 — 둘은 다른 규칙이다.
    expect(repsInput().value).toBe('25');
  });

  it('기구 운동은 25회를 넘겨도 힌트가 없다 — 무게를 얹을 데가 있다', () => {
    setup({ session: running(ex('bench', ['barbell'])), history: did('bench', 20, [26, 26, 26]) });
    expect(screen.queryByText(/더 어려운 동작/)).toBeNull();
  });
});
