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
  const onBodyPhoto = vi.fn();
  render(
    <Workout
      session={o.session ?? finished()}
      group="upper"
      onChange={() => {}}
      onFinish={onFinish}
      onBodyPhoto={onBodyPhoto}
      history={o.history ?? []}
      spec={{}}
      date="2026-08-27"
      profile={o.profile === undefined ? { experience: 'beginner', avoid: [] } : o.profile}
      onProfileChange={onProfileChange}
    />,
  );
  return { onFinish, onProfileChange, onBodyPhoto };
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

  it('지난 기록이 25회여도 사다리 안내는 화면에 하나뿐이다', () => {
    // ★ 옛 「지난번 기록 기준」 상단 안내는 없앴다(실시간 안내로 통합). 프리필이 지난 기록에서
    //   오므로 지난 기록이 25 이상이면 입력값도 25 이상이라 실시간 안내가 그 경우를 덮는다 —
    //   둘 다 두면 같은 문구가 한 화면에 두 번 뜬다. 그 중복을 여기서 잠근다.
    setup({ session: running(ex('push')), history: did('push', 0, [25, 25, 25]) });
    expect(repsInput().value).toBe('26');
    // 정규식으로 느슨하게 잡으면 완료 화면의 승급 문구(NOTE_UP)까지 걸린다 — 정확 문자열로 센다.
    expect(screen.getAllByText('다음엔 더 어려운 동작으로 바꿔보세요')).toHaveLength(1);
  });

  it('맨몸 24회면 프리필이 25로 올라간다', () => {
    // 24회는 health 상단(15)을 전 세트가 넘긴 것이라 졸업이다 — 맨몸은 무게 대신 횟수를 +1 한다.
    // (사다리 안내의 경계 판정은 이제 **입력값** 기준이라 「맨몸 사다리 안내」 describe로 옮겼다.)
    setup({ session: running(ex('push')), history: did('push', 0, [24, 24, 24]) });
    expect(repsInput().value).toBe('25');
  });
});

describe('세트 진행 — 맨몸 사다리 안내', () => {
  // 지난번 기록이 아니라 **지금 타이핑한 값**에 반응한다. 실기기에서 맨몸 런지에 30을 넣고도
  // 아무 문구가 안 떴던 것이 이 describe가 생긴 이유다 — 기록 기준이면 오늘 넘긴 사람은 못 본다.
  const repsInput = () => screen.getByLabelText('횟수') as HTMLInputElement;
  const typeReps = (v: string) => fireEvent.change(repsInput(), { target: { value: v } });
  // 두 줄이다 — 줄1이 이유(왜 횟수를 더 늘려도 소용없나), 줄2가 행동(뭘 하라는 건가).
  // 옛 한 줄 「더 어려운 동작에 도전할 때예요」는 응원인지 경고인지 모호하다는 제보를 받았다.
  const why = () => screen.queryByText('여기서 횟수를 더 늘려도 효과가 잘 안 늘어요');
  const what = () => screen.queryByText('다음엔 더 어려운 동작으로 바꿔보세요');

  it('25회를 넣으면 횟수칸 **바로 아래**에 두 줄이 온전히 뜬다 — 경계는 포함이다', () => {
    setup({ session: startSession([ex('push')], 'health') });
    typeReps('25');
    // 줄마다 별도 요소다(기구 안내와 같은 규율) — 375px에서 어중간한 자리에 꺾이지 않게.
    expect(why()).toBeTruthy();
    expect(what()).toBeTruthy();
    // ★ 존재만 보면 안내가 헤더 밑으로 이사해도 초록이다(리뷰가 심어 462건 통과를 실측).
    //   제보가 「입력했는데 반응이 안 보인다」 계열이라 **입력칸에서 떨어지는 회귀**를 잡아야 한다.
    expect(repsInput().compareDocumentPosition(why()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('옛 한 줄 문구는 어디에도 안 남는다 — 교체지 추가가 아니다', () => {
    // 두 줄을 새로 넣고 옛 줄을 지우는 걸 잊으면 세 줄이 뜬다. 존재 단언만으론 그걸 못 잡는다.
    // 완료 화면의 승급 문구(NOTE_UP)에 오탐하지 않게 **정확 문자열**로 센다.
    setup({ session: startSession([ex('push')], 'health') });
    typeReps('30');
    expect(screen.queryByText('더 어려운 동작에 도전할 때예요')).toBeNull();
  });

  it('24회에는 안 뜬다 — 컷은 25다', () => {
    setup({ session: startSession([ex('push')], 'health') });
    typeReps('24');
    expect(why()).toBeNull();
    expect(what()).toBeNull();
  });

  it('30을 넣었다가 10으로 고치면 사라진다', () => {
    // 뜨는 것만 잠그면 「한 번 뜨면 안 사라지는」 구현이 통과한다.
    setup({ session: startSession([ex('push')], 'health') });
    typeReps('30');
    expect(why()).toBeTruthy();
    typeReps('10');
    expect(why()).toBeNull();
    expect(what()).toBeNull();
  });

  it('색은 파랑이고 어절 중간에서 안 꺾인다', () => {
    // ★ 색은 문구와 **따로** 잠근다(PR #56 리뷰 지적). 회색이면 나무라는 말로 읽힌다.
    // ★ `keep-all`도 잠근다 — 기구와 스타일 상수(`GUIDE`)를 공유하게 되면서 오염 반경이
    //   두 배가 됐는데, 375px 개행(사용자 명시 요청)을 지탱하는 게 이 속성이다.
    //   두 줄이 되면서 스타일은 줄을 감싼 부모가 쥔다 — 기구 안내와 같은 자리.
    setup({ session: startSession([ex('push')], 'health') });
    typeReps('30');
    expect(why()!.parentElement!.style.color).toBe('var(--blue-dark)');
    expect(why()!.parentElement!.style.wordBreak).toBe('keep-all');
  });

  it('25회를 넘겨도 세트 완료는 막지 않는다 — 안내지 검문이 아니다', () => {
    setup({ session: startSession([ex('push')], 'health') });
    typeReps('30');
    expect((screen.getByRole('button', { name: '세트 완료' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('빈 입력에는 안 뜬다 — 지우는 중인 사람에게 말을 걸지 않는다', () => {
    setup({ session: startSession([ex('push')], 'health') });
    typeReps('30');
    typeReps('');
    expect(why()).toBeNull();
    expect(what()).toBeNull();
  });

  it('기구 운동에는 안 뜬다 — 무게를 얹을 데가 있다', () => {
    setup({ session: startSession([ex('bench', ['barbell'])], 'health') });
    typeReps('30');
    expect(why()).toBeNull();
    expect(what()).toBeNull();
    // 기구는 이 자리를 범위 이탈 안내가 쓴다.
    expect(screen.getByText('무게를 올려야 효과가 계속 늘어요')).toBeTruthy();
  });
});

describe('세트 진행 — 목표 반복 범위 이탈 안내', () => {
  const repsInput = () => screen.getByLabelText('횟수') as HTMLInputElement;
  const typeReps = (v: string) => fireEvent.change(repsInput(), { target: { value: v } });
  const gym = (goal: Parameters<typeof startSession>[1] = 'muscle') => startSession([ex('bench', ['barbell'])], goal);

  it('상단을 넘기면 두 줄이 온전히 뜬다 — 어중간한 자리에서 꺾이지 않게 줄마다 별도 요소다', () => {
    setup({ session: gym() }); // muscle 6~12
    typeReps('15');
    expect(screen.getByText('목표(6~12회)보다 많아요')).toBeTruthy();
    expect(screen.getByText('무게를 올려야 효과가 계속 늘어요')).toBeTruthy();
    // 어절 중간 꺾임 방지는 맨몸 안내와 공유하는 `GUIDE` 상수가 쥐고 있다 — 양쪽에서 잠근다.
    expect(screen.getByText('무게를 올려야 효과가 계속 늘어요').parentElement!.style.wordBreak).toBe('keep-all');
    // ★ 색은 문구와 **따로** 잠근다 — 색상 삼항을 정반대로 뒤집어도 문구 단언은 전부 초록이다(리뷰 실측).
    //   초과가 파랑인 것은 「무게를 올릴 때가 왔다」는 긍정 신호라서다. 회색이면 지적으로 읽힌다.
    expect(screen.getByText('무게를 올려야 효과가 계속 늘어요').parentElement!.style.color).toBe('var(--blue-dark)');
  });

  it('상단 초과면 횟수 입력칸 테두리가 파랑으로 바뀐다', () => {
    // ★ `border`가 shorthand라 `borderColor`만 덮으면 리렌더에서 색이 풀린다(ui.ts 주석).
    //   shorthand 전체를 갈아 끼웠는지를 여기서 잠근다.
    setup({ session: gym() });
    typeReps('15');
    expect(repsInput().style.border).toBe('1px solid var(--blue)');
  });

  it('하단에 못 미치면 미달 문구 두 줄이 뜬다', () => {
    setup({ session: gym() });
    typeReps('4');
    expect(screen.getByText('목표(6~12회)보다 적어요')).toBeTruthy();
    expect(screen.getByText('힘들면 무게를 낮춰서 횟수를 채워보세요')).toBeTruthy();
    // 미달은 **회색이어야 한다.** 파랑은 「잘했다」로 읽혀서, 무게를 낮추라는 말과 신호가 어긋난다.
    expect(screen.getByText('힘들면 무게를 낮춰서 횟수를 채워보세요').parentElement!.style.color).toBe('var(--text-sub)');
  });

  it('범위 안이면 아무 안내도 없다 — 경계는 포함이다', () => {
    setup({ session: gym() });
    typeReps('12');
    expect(screen.queryByText(/목표\(.*\)보다/)).toBeNull();
    typeReps('6');
    expect(screen.queryByText(/목표\(.*\)보다/)).toBeNull();
    expect(repsInput().style.border).toBe('1px solid var(--line-strong)');
  });

  it('맨몸 운동에는 절대 안 뜬다 — 얹을 무게가 없다', () => {
    // 맨몸의 진행 수단은 무게가 아니라 동작이라, 「무게를 올려볼 때」는 줄 수 없는 조언이다.
    setup({ session: startSession([ex('push')], 'muscle') });
    typeReps('40');
    expect(screen.queryByText(/목표\(.*\)보다/)).toBeNull();
    typeReps('2');
    expect(screen.queryByText(/목표\(.*\)보다/)).toBeNull();
  });

  it('구간 숫자는 목적을 따라간다 — 하드코딩이 아니다', () => {
    setup({ session: gym('fatLoss') }); // 12~20
    typeReps('25');
    expect(screen.getByText('목표(12~20회)보다 많아요')).toBeTruthy();
  });

  it('범위를 벗어나도 세트 완료는 막지 않는다 — 안내지 검문이 아니다', () => {
    setup({ session: gym() });
    typeReps('30');
    expect((screen.getByRole('button', { name: '세트 완료' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('빈 입력에는 안내를 안 낸다 — 지우는 중인 사람을 나무라지 않는다', () => {
    setup({ session: gym() });
    typeReps('');
    expect(screen.queryByText(/목표\(.*\)보다/)).toBeNull();
  });
});

describe('운동 완료 — 눈바디 제안', () => {
  it('기록을 먼저 저장한 뒤에 촬영을 연다 — 사진 때문에 기록이 뒤로 밀리지 않는다', () => {
    // 순서가 스펙이다(설계 §3.1). 촬영을 먼저 열면 그 화면에서 앱이 죽거나 사용자가
    // 뒤로 가는 순간 **방금 한 운동이 통째로 사라진다.** 기록은 사진보다 귀하다.
    const { onFinish, onBodyPhoto } = setup();

    click(/눈바디/);

    expect(onFinish.mock.calls[0][0].entries).toHaveLength(1);
    expect(onBodyPhoto).toHaveBeenCalled();
    expect(onFinish.mock.invocationCallOrder[0]).toBeLessThan(onBodyPhoto.mock.invocationCallOrder[0]);
  });

  it('고른 체감도 함께 저장된다 — 저장 버튼과 같은 기록이다', () => {
    // 두 버튼이 서로 다른 기록을 남기면, 눈바디를 누른 날만 피드백이 조용히 빠진다.
    const { onFinish } = setup();
    click('힘듦');

    click(/눈바디/);

    expect(onFinish.mock.calls[0][0].feel).toBe('hard');
  });
});
