// @vitest-environment jsdom
// ⚠️ 전역으로 켜면 shareLinks 테스트가 죽는다 — 이유는 `Onboarding.test.tsx` 머리말 참조.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { awaitAdEvent } from '../adProbe';
import type { Exercise } from '../data/exercises';
import { loadInstructions } from '../data/instructions';
import type { Profile } from '../logic/profile';
import { warnColors } from '../logic/restCue';
import { SETS_PER_EXERCISE, startSession, type Session } from '../logic/session';
import { playCue, primeSound } from '../restSound';
import type { WorkoutRecord } from '../storage';
import { Workout } from './Workout';

// 소리는 스파이로만 본다 — 웹 오디오는 jsdom에 없고, 판정은 전부 `restCue.ts`에 있다(설계 §3.4).
vi.mock('../restSound', () => ({ playCue: vi.fn(), primeSound: vi.fn() }));
// 단계 설명은 스파이로 갈아 끼운다 — 이 화면의 책임은 **언제 무엇을 부르고 그 결과를 어떻게 그리는지**이지
// 260KB짜리 실제 번역이 아니다. 기본값은 빈 배열이라 다른 describe의 시트는 사진만 뜬다.
vi.mock('../data/instructions', () => ({ loadInstructions: vi.fn(async () => []) }));
// 광고 SDK는 토스 앱 안에만 있다. 그리고 로드·노출이 **언제 끝나는지**를 테스트가 직접 쥐어야
// 「3초 전에는 안 띄운다」를 잴 수 있으므로, `awaitAdEvent`도 스파이로 갈아 끼운다.
vi.mock('@apps-in-toss/web-framework', () => ({ loadFullScreenAd: vi.fn(), showFullScreenAd: vi.fn() }));
vi.mock('../adProbe', () => ({ awaitAdEvent: vi.fn() }));

afterEach(cleanup);

/** 세 번째 인자는 그 테스트가 실제로 보는 필드만 덮어쓴다 — 시트는 이름·근육·기구·난이도·사진을 다 읽는다. */
const ex = (id: string, requires: Exercise['requires'] = [], more: Partial<Exercise> = {}): Exercise => ({
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
  ...more,
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
  const el = (session: Session) => (
    <Workout
      session={session}
      group="upper"
      onChange={() => {}}
      onFinish={onFinish}
      onBodyPhoto={onBodyPhoto}
      history={o.history ?? []}
      spec={{}}
      date="2026-08-27"
      profile={o.profile === undefined ? { experience: 'beginner', avoid: [] } : o.profile}
      onProfileChange={onProfileChange}
    />
  );
  const r = render(el(o.session ?? finished()));
  /** 세션만 갈아 끼운 리렌더 — 언마운트가 아니라 **살아 있는 화면**에 다음 운동이 들어와야 화면 상태가 잠긴다. */
  return { onFinish, onProfileChange, onBodyPhoto, rerenderWith: (s: Session) => r.rerender(el(s)) };
}

/** 세션을 실제로 들고 도는 하네스 — `onChange`가 죽어 있으면 「건너뛰기」가 화면을 못 바꾼다. */
function Harness({ initial }: { initial: Session }) {
  const [s, setS] = useState(initial);
  return (
    <Workout
      session={s}
      group="upper"
      onChange={setS}
      onFinish={() => {}}
      onBodyPhoto={() => {}}
      history={[]}
      spec={{}}
      date="2026-08-29"
      profile={{ experience: 'beginner', avoid: [] }}
      onProfileChange={() => {}}
    />
  );
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
    // ★ 이 한 줄은 **두 가지를 동시에** 잠근다. 24는 health 상단(15) 초과이자 하단(8) 이상이라
    //   ① 맨몸엔 초과 안내가 없다(hi+1~24 회색지대 — 「맨몸 초과 부재」 단언이 40회뿐이면
    //      사다리 구간 위에서만 잠겨서, 회색지대에만 열리는 변조가 살아남는다) ②미달도 아니다.
    expect(screen.queryByText(/목표\(.*\)보다/)).toBeNull();
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
    expect(why()!.parentElement!.style.color).toBe('var(--accent-strong)');
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
    expect(screen.getByText('무게를 올려야 효과가 계속 늘어요').parentElement!.style.color).toBe('var(--accent-strong)');
  });

  it('상단 초과면 횟수 입력칸 테두리가 파랑으로 바뀐다', () => {
    // ★ `border`가 shorthand라 `borderColor`만 덮으면 리렌더에서 색이 풀린다(ui.ts 주석).
    //   shorthand 전체를 갈아 끼웠는지를 여기서 잠근다.
    setup({ session: gym() });
    typeReps('15');
    expect(repsInput().style.border).toBe('1px solid var(--accent)');
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

  it('맨몸 운동에는 상단 초과 안내가 안 뜬다 — 얹을 무게가 없다', () => {
    // 맨몸의 진행 수단은 무게가 아니라 동작이라, 「무게를 올려볼 때」는 줄 수 없는 조언이다.
    // (하단 미달은 다르다 — 맨몸에도 나눠서 채우는 길이 있어서 뜬다. 「맨몸 미달 안내」 describe.)
    setup({ session: startSession([ex('push')], 'muscle') });
    typeReps('40');
    expect(screen.queryByText(/목표\(.*\)보다/)).toBeNull();
  });

  it('기구 미달에는 맨몸 줄2가 섞이지 않는다 — 두 문구는 남남이다', () => {
    // 맨몸 미달 안내가 줄1을 공유하면서 줄2까지 딸려 오면 「무게를 낮추라」가 사라진다.
    setup({ session: gym() });
    typeReps('4');
    expect(screen.getByText('힘들면 무게를 낮춰서 횟수를 채워보세요')).toBeTruthy();
    expect(screen.queryByText('힘들면 조금 쉬었다가 나눠서 채워보세요')).toBeNull();
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

describe('세트 진행 — 맨몸 미달 안내', () => {
  // 사다리(≥25)는 「너무 많이 했다」 쪽이라 맨몸에서 모자란 사람에겐 아무 말도 안 걸렸다.
  // 경계 규칙은 기구 미달과 같다(목표 하단 미만) — 다른 건 줄2뿐이다: 맨몸엔 낮출 무게가 없다.
  const repsInput = () => screen.getByLabelText('횟수') as HTMLInputElement;
  const typeReps = (v: string) => fireEvent.change(repsInput(), { target: { value: v } });
  const bw = (goal: Parameters<typeof startSession>[1] = 'health') => startSession([ex('push')], goal);
  const why = () => screen.queryByText('목표(8~15회)보다 적어요');
  const what = () => screen.queryByText('힘들면 조금 쉬었다가 나눠서 채워보세요');

  it('하단에 못 미치면 두 줄이 온전히 뜬다', () => {
    setup({ session: bw() }); // health 8~15
    typeReps('5');
    // 줄마다 별도 요소다(기구·사다리 안내와 같은 규율) — 375px에서 어중간한 자리에 꺾이지 않게.
    expect(why()).toBeTruthy();
    expect(what()).toBeTruthy();
  });

  it('하단 경계에는 안 뜬다 — 경계는 범위 안이다', () => {
    setup({ session: bw() });
    typeReps('8');
    expect(why()).toBeNull();
    expect(what()).toBeNull();
  });

  it('색은 회색이고 자리는 입력칸 아래다', () => {
    // ★ 색은 문구와 **따로** 잠근다 — 파랑이면 「잘했다」로 읽혀서 더 채우라는 말과 신호가 어긋난다.
    // ★ 위치도 잠근다 — 존재만 보면 안내가 헤더 밑으로 이사해도 초록이다(맨몸 사다리 describe의 교훈).
    setup({ session: bw() });
    typeReps('5');
    expect(what()!.parentElement!.style.color).toBe('var(--text-sub)');
    expect(repsInput().compareDocumentPosition(what()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // ★ 입력칸은 **안 건드린다.** 파란 테두리는 「무게 칸을 봐라」와 묶인 초과 전용 신호인데,
    //   맨몸엔 무게 칸이 없다. 강조 조건이 `repOff === 'over'`에서 `repOff`로 느슨해지면 여기서 죽는다.
    expect(repsInput().style.border).toBe('1px solid var(--line-strong)');
  });

  it('미달이어도 세트 완료는 막지 않는다 — 안내지 검문이 아니다', () => {
    setup({ session: bw() });
    typeReps('5');
    expect((screen.getByRole('button', { name: '세트 완료' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('25회 이상이면 미달이 아니라 사다리 안내다 — 화면의 안내는 하나뿐이다', () => {
    setup({ session: bw() });
    typeReps('30');
    expect(screen.getByText('다음엔 더 어려운 동작으로 바꿔보세요')).toBeTruthy();
    expect(screen.queryByText(/목표\(.*\)보다/)).toBeNull();
    expect(what()).toBeNull();
  });

  it('구간 숫자는 목적을 따라간다 — 하드코딩이 아니다', () => {
    setup({ session: bw('fatLoss') }); // 12~20
    typeReps('5');
    expect(screen.getByText('목표(12~20회)보다 적어요')).toBeTruthy();
  });
});

describe('세트 진행 — 동작 보기', () => {
  // 추천 풀이 640개라 **이름만으로 모르는 운동**이 자주 나온다(사용자 제보 2026-09-02).
  // 설명을 늘 펼쳐 두면 세트 카드가 화면 밖으로 밀리므로, 필요한 사람만 여는 시트다(설계 §2).
  const curl = ex('curl', ['dumbbell'], {
    name: '조트만 컬',
    primaryMuscles: ['biceps'],
    level: 'intermediate',
    images: ['Zottman_Curl/0.jpg', 'Zottman_Curl/1.jpg'],
  });
  const running = (e: Exercise = curl) => startSession([e], 'health');
  const open = () => click('동작 보기');
  const dialog = () => screen.queryByRole('dialog');
  const shots = () => Array.from(dialog()!.querySelectorAll('img')).map((i) => i.getAttribute('src') ?? '');

  it('세트 화면에만 있다 — 휴식 화면·완료 화면에는 없다', () => {
    // 휴식은 광고 자리이고 완료는 기록 자리다. 입구가 세 곳이면 어느 화면의 물건인지 흐려진다(설계 §2#8).
    setup({ session: running() });
    expect(screen.getByRole('button', { name: '동작 보기' })).toBeTruthy();

    cleanup();
    const s = running();
    setup({ session: { ...s, done: [[{ weight: 0, reps: 10 }]], restEndsAt: Date.now() + 20000 } });
    expect(screen.queryByRole('button', { name: '동작 보기' })).toBeNull();

    cleanup();
    setup(); // 완료 화면
    expect(screen.queryByRole('button', { name: '동작 보기' })).toBeNull();
  });

  it('누르기 전에는 시트가 없다 — 열림 상태를 버튼이 말한다', () => {
    setup({ session: running() });
    expect(dialog()).toBeNull();
    expect(screen.getByRole('button', { name: '동작 보기' }).getAttribute('aria-expanded')).toBe('false');
    open();
    expect(screen.getByRole('button', { name: '동작 보기' }).getAttribute('aria-expanded')).toBe('true');
  });

  it('누르면 그 운동 이름의 시트가 뜨고 시작·끝 사진 두 장이 들어 있다', () => {
    // `images[1]`(끝 자세)은 이 기능이 처음 쓴다 — 한 장만 그리면 「동작」이 아니라 「자세」다.
    setup({ session: running() });
    open();
    const d = screen.getByRole('dialog', { name: '조트만 컬' });
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(shots()).toHaveLength(2);
    expect(shots()[0].endsWith('Zottman_Curl/0.jpg')).toBe(true);
    expect(shots()[1].endsWith('Zottman_Curl/1.jpg')).toBe(true);
    expect(within(d).getByText('시작')).toBeTruthy();
    expect(within(d).getByText('끝')).toBeTruthy();
  });

  it('「닫기」로 닫힌다', () => {
    setup({ session: running() });
    open();
    click('닫기');
    expect(dialog()).toBeNull();
  });

  it('배경(dim)을 눌러도 닫힌다 — 닫는 길이 하나뿐이면 막힌 것처럼 느껴진다', () => {
    // ★ 시트가 「세트 완료」를 가리는 것은 의도다(설계 §7). 그래서 닫는 길이 둘이어야 한다.
    setup({ session: running() });
    open();
    fireEvent.click(document.querySelector('[data-dim]')!);
    expect(dialog()).toBeNull();
  });

  it('열어 둔 채로 운동이 바뀌면 저절로 닫힌다', () => {
    // ★ 안 닫으면 다음 운동 화면에 **이전 운동 설명**이 떠 있다 — 틀린 정보가 화면에 남는 유일한 경로다.
    const next = ex('squat', [], { name: '스쿼트', images: ['Squat/0.jpg', 'Squat/1.jpg'] });
    const s = startSession([curl, next], 'health');
    const { rerenderWith } = setup({ session: s });
    open();
    expect(dialog()).toBeTruthy();
    rerenderWith({ ...s, index: 1 });
    expect(dialog()).toBeNull();
  });

  it('부제는 주동근 · 기구 · 난이도다', () => {
    setup({ session: running() });
    open();
    expect(within(dialog()!).getByText('이두 · 덤벨 · 중급')).toBeTruthy();
  });

  it('기구가 없으면 「맨몸」이라고 적는다 — 빈칸이 아니다', () => {
    setup({ session: running(ex('push', [], { name: '푸시업', images: ['Pushup/0.jpg'] })) });
    open();
    expect(within(dialog()!).getByText('가슴 · 맨몸 · 초급')).toBeTruthy();
  });

  it('사진이 한 장뿐인 운동은 한 장만 그린다 — 데이터 방어다', () => {
    setup({ session: running(ex('push', [], { name: '푸시업', images: ['Pushup/0.jpg'] })) });
    open();
    expect(shots()).toHaveLength(1);
    // `<img>` 개수만 세면 둘째 칸에 대체 표시(이름 첫 글자)를 그리는 회귀가 통과한다 — 「끝」 라벨이 그 빈 칸의 증거다.
    expect(within(dialog()!).queryByText('끝')).toBeNull();
  });

  it('사진이 아예 없어도 시트는 열리고 닫힌다', () => {
    // 사진 블록이 통째로 없어도 이름·부제·닫기는 남는다. 빈 상자를 그리지 않는다.
    setup({ session: running(ex('push', [], { name: '푸시업' })) });
    open();
    expect(shots()).toHaveLength(0);
    expect(within(dialog()!).getByText('푸시업')).toBeTruthy();
    click('닫기');
    expect(dialog()).toBeNull();
  });

  describe('단계 목록', () => {
    beforeEach(() => {
      vi.mocked(loadInstructions).mockReset();
      vi.mocked(loadInstructions).mockResolvedValue([]);
    });

    it('열면 그 운동의 단계를 받아 번호 목록으로 그린다', async () => {
      // 사진 두 장이 「무엇을」이라면 단계는 「어떻게」다 — 시트를 여는 이유의 절반이다.
      vi.mocked(loadInstructions).mockResolvedValue(['덤벨을 양손에 들고 바로 선다.', '위팔은 고정한 채 팔을 굽힌다.']);
      setup({ session: running() });
      open();
      expect(loadInstructions).toHaveBeenCalledWith('curl');
      const list = await within(dialog()!).findByRole('list');
      // 번호를 지우고 비교하면 `<ol>`이 `<ul>`이 되거나 번호 `<span>`이 사라져도 통과한다 —
      // 목록 요소와 번호 텍스트를 그대로 단언한다.
      expect(dialog()!.querySelector('ol')).toBe(list);
      const items = within(list).getAllByRole('listitem').map((li) => li.textContent ?? '');
      expect(items).toEqual(['1덤벨을 양손에 들고 바로 선다.', '2위팔은 고정한 채 팔을 굽힌다.']);
    });

    it('단계가 없으면 목록 요소 자체가 없다 — 사진과 닫기는 그대로다', async () => {
      // ★ 로딩 중과 「설명이 없는 운동 5개」가 같은 화면이다(설계 §3.3). 스피너도 빈 상자도 그리지 않는다.
      setup({ session: running() });
      open();
      await act(async () => {});
      expect(within(dialog()!).queryByRole('list')).toBeNull();
      expect(shots()).toHaveLength(2);
      click('닫기');
      expect(dialog()).toBeNull();
    });

    it('늦게 도착한 이전 운동의 단계가 다음 운동 시트에 뜨지 않는다', async () => {
      // ★ 비동기라서 **닫힌 뒤·운동이 바뀐 뒤에** 결과가 온다. 그대로 넣으면 스쿼트 시트에
      // 조트만 컬 설명이 뜬다 — 틀린 정보가 화면에 남는다.
      let late!: (v: string[]) => void;
      vi.mocked(loadInstructions).mockReturnValueOnce(new Promise((r) => (late = r)));
      const next = ex('squat', [], { name: '스쿼트', images: ['Squat/0.jpg'] });
      const s = startSession([curl, next], 'health');
      const { rerenderWith } = setup({ session: s });
      open(); // 조트만 컬 — 아직 안 끝났다
      rerenderWith({ ...s, index: 1 });
      open(); // 스쿼트 — 이쪽은 단계가 없다
      await act(async () => late(['조트만 컬 단계']));
      expect(screen.getByRole('dialog', { name: '스쿼트' })).toBeTruthy();
      expect(screen.queryByText('조트만 컬 단계')).toBeNull();
    });

    // 한 테스트가 세 규칙을 한꺼번에 잠근다 — **열 때만 · 지금 운동의 id로 · 이전 결과를 비우고**.
    // 셋 중 하나만 빠져도 「다음 운동 시트에 이전 운동 설명」이라는 같은 증상으로 새기 때문이다.
    it('운동이 바뀐 뒤 다시 열면 이전 운동 단계가 남지 않는다', async () => {
      vi.mocked(loadInstructions).mockImplementation((id: string) =>
        id === 'curl' ? Promise.resolve(['컬 단계']) : new Promise<string[]>(() => {}), // 스쿼트 결과는 안 온다
      );
      const next = ex('squat', [], { name: '스쿼트', images: ['Squat/0.jpg'] });
      const s = startSession([curl, next], 'health');
      const { rerenderWith } = setup({ session: s });
      expect(loadInstructions).not.toHaveBeenCalled(); // 열기 전엔 청크를 안 받는다 (§2#6 첫 로드 그대로)
      open();
      await act(async () => {});
      expect(screen.getByText('컬 단계')).toBeTruthy();
      rerenderWith({ ...s, index: 1 });
      await act(async () => {});
      open();
      await act(async () => {});
      expect(loadInstructions).toHaveBeenLastCalledWith('squat'); // 그 운동의 id로
      expect(screen.queryByText('컬 단계')).toBeNull(); // 이전 운동 단계가 안 남는다
    });
  });
});

describe('휴식 — 마지막 10초 준비 신호', () => {
  // 폰을 내려놓고 쉬는 사람이 다음 세트 시작을 놓치지 않게 하는 신호다(설계 2026-08-29).
  // 시간은 fake timers로 민다 — `restEndsAt`이 절대 시각이라 시계만 옮기면 남은 초가 따라온다.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(playCue).mockClear();
    vi.mocked(primeSound).mockClear();
  });
  afterEach(() => vi.useRealTimers());

  /** 휴식 길이는 40초 미만으로 둔다 — 40 이상이면 광고 effect가 깨어나 이 테스트가 광고까지 겸한다. */
  function resting(seconds: number): Session {
    const s = startSession([ex('push'), ex('pull')], 'health');
    return { ...s, done: [[{ weight: 0, reps: 10 }], []], restEndsAt: Date.now() + seconds * 1000 };
  }

  const enterRest = (seconds: number) => render(<Harness initial={resting(seconds)} />);
  /**
   * 시계를 250ms **한 틱씩** 민다.
   *
   * ⚠️ 한 `act`에 12초를 통째로 밀면 React가 48번의 갱신을 하나로 합쳐, 12→0으로 **한 번에**
   * 건너뛴 것이 된다(그건 백그라운드 복귀 시나리오다 — 아래에 따로 있다). 실제 앱의 시간
   * 흐름은 틱마다 커밋되므로 여기서도 틱마다 민다.
   */
  const tick = (ms: number) => {
    for (let i = 0; i < ms; i += 250) act(() => void vi.advanceTimersByTime(250));
  };
  /** 화면이 멈춰 있는 동안 시간만 흐른 경우(백그라운드 스로틀) — 갱신이 한 번에 몰린다. */
  const jump = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
  const restMain = () => screen.getByText('휴식').closest('main')!;
  const timer = (sec: number) => screen.getByText(`0:${String(sec).padStart(2, '0')}`);
  const cues = () => vi.mocked(playCue).mock.calls.map((c) => c[0]);

  it('10초 밖에서는 아무것도 달라지지 않는다 — 신호는 마지막 10초에만 산다', () => {
    enterRest(30);
    expect(screen.queryByText('다음 세트 준비')).toBeNull();
    // ★ 트랜지션 걸린 속성이라 computed style은 못 믿는다(글로벌 원칙) — 인라인 목표값을 본다.
    expect(restMain().style.background).toBe(warnColors(30).bg);
    expect(cues()).toEqual([]);
  });

  it('문구는 정확히 10초부터다 — 11초엔 아직 없다', () => {
    // ★ 「30초에 없다」만으로는 조건이 10→12로 느슨해져도 안 죽는다(변이 실측). 경계 바로
    //   바깥에서 부재를, 안에서 존재를 잠근다.
    enterRest(12);
    tick(1000);
    expect(screen.queryByText('다음 세트 준비')).toBeNull(); // 11초
    tick(1000);
    expect(screen.getByText('다음 세트 준비')).toBeTruthy(); // 10초
  });

  it('8초에는 문구가 뜨고 배경이 그만큼 물든다', () => {
    enterRest(12);
    tick(4000);
    expect(timer(8)).toBeTruthy();
    expect(screen.getByText('다음 세트 준비')).toBeTruthy();
    expect(restMain().style.background).toBe(warnColors(8).bg);
    // 램프여야 눈에 계단이 안 보인다 — 1초 단위 갱신을 트랜지션이 메운다.
    expect(restMain().style.transition).toBe('background 1s linear');
  });

  it('경계마다 한 번씩만 울린다 — 딩동 · 틱틱틱 · 시작음', () => {
    // ★ 250ms 틱이 초당 네 번 도는데 반복 가드가 없으면 같은 신호가 네 번씩 겹친다.
    //   순서와 개수를 통째로 단언해 「중복」과 「누락」을 한 줄에서 잠근다.
    enterRest(12);
    tick(12000);
    expect(cues()).toEqual(['warn', 'tick', 'tick', 'tick', 'go']);
  });

  it('백그라운드에 다녀와 12초가 통째로 지났으면 시작음 하나만 낸다', () => {
    // 결정 6 — 놓친 신호를 몰아서 내면 복귀하는 순간 소리가 폭발한다.
    enterRest(12);
    jump(12000);
    expect(cues()).toEqual(['go']);
  });

  it('휴식을 건너뛰면 그 뒤로는 아무 신호도 없다', () => {
    // 나간 화면의 타이머가 계속 울면 세트를 하는 도중에 시작음이 난다.
    enterRest(12);
    click('휴식 건너뛰기');
    tick(12000);
    expect(cues()).toEqual([]);
  });

  it('4초부터는 글자가 흰색으로 뒤집힌다 — 5초엔 아직 검정이다', () => {
    // 배경이 어두워진 뒤에도 검정 글자면 숫자가 안 읽힌다. 문턱은 `warnColors`가 혼자 쥔다.
    enterRest(12);
    tick(7000);
    // 색 값은 `warnColors`가 혼자 쥔다 — 대비를 계산하려면 CSS 변수가 아니라 실값이어야 한다.
    expect(timer(5).style.color).toBe('rgb(20, 17, 13)');
    tick(1000);
    expect(timer(4).style.color).toBe('rgb(255, 255, 255)'); // jsdom이 hex를 rgb로 정규화한다
    // 건너뛰기 버튼도 함께 뒤집힌다 — 붉은 배경 위에 회색 버튼만 남으면 그것만 안 읽힌다.
    // ⚠️ `border`는 shorthand라 통째로 갈아 끼워야 리렌더에서 안 풀린다(ui.ts 주석).
    const skip = screen.getByRole('button', { name: '휴식 건너뛰기' });
    expect(skip.style.color).toBe('rgb(255, 255, 255)'); // jsdom이 hex를 rgb로 정규화한다
    expect(skip.style.border).toBe('1px solid rgba(255, 255, 255, 0.45)');
  });

  it('마지막 3초는 숫자가 초마다 한 번 뛴다 — 8초엔 안 뛴다', () => {
    // 초당 1회다(결정 7 · 3Hz 이상 점멸 금지). `key`가 없으면 리마운트가 없어 첫 초만 뛴다.
    enterRest(12);
    tick(4000);
    expect(timer(8).className).toBe('');
    // ★ 4초에서 부재를 잠근다 — 없으면 창이 3→5로 넓어져도 안 죽는다(변이 실측).
    tick(4000);
    expect(timer(4).className).toBe('');
    tick(1000);
    expect(timer(3).className).toBe('cue-pulse');
    // ★ 클래스만 보면 `key`를 지워도 초록이다(돌연변이 실측) — 클래스는 3·2·1 내내 붙어 있고,
    //   CSS 애니메이션은 **리마운트될 때만** 다시 재생되기 때문이다. jsdom은 애니메이션을 안
    //   돌리므로 관측 가능한 것은 **노드 교체**뿐이다: 초가 바뀌면 다른 DOM 노드여야 한다.
    const at3 = timer(3);
    tick(1000);
    expect(timer(2).className).toBe('cue-pulse');
    expect(timer(2)).not.toBe(at3);
  });

  it('「세트 완료」를 누르면 소리를 깨운다 — 브라우저 오디오는 제스처 뒤에만 열린다', () => {
    // ★ 미배선이면 휴식 내내 소리가 통째로 안 난다. 화면은 멀쩡해서 눈으로는 절대 안 잡힌다.
    setup({ session: startSession([ex('push')], 'health') });
    click('세트 완료');
    expect(primeSound).toHaveBeenCalled();
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

describe('광고 예고 — 오기 전에 미리 말한다', () => {
  // 4차 검수 반려 사유가 「예상하기 어려운 시점의 광고」였다(T-245). 광고는 그대로 자동으로
  // 뜨되, **뜨기 전에 화면이 먼저 말한다** — 세트 화면에서 한 번, 휴식 화면에서 또 한 번.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(awaitAdEvent).mockReset();
  });
  afterEach(() => vi.useRealTimers());

  /** `health` + compound는 휴식 90초라 40초 컷을 넘긴다 — 광고가 실제로 나오는 슬롯이다. */
  const AD_REST = 90;

  function restingAt(seconds: number): Session {
    const s = startSession([ex('push'), ex('pull')], 'health');
    return { ...s, done: [[{ weight: 0, reps: 10 }], []], restEndsAt: Date.now() + seconds * 1000 };
  }

  /**
   * `awaitAdEvent`의 **끝나는 시점을 테스트가 쥔다.** 돌려받은 배열의 [0]이 로드, [1]이 노출이다.
   * 실제 SDK처럼 「언젠가 끝나는 약속」이라야 「3초 전에는 아직 안 띄운다」를 잴 수 있다.
   */
  function adQueue() {
    const resolvers: ((r: { ok: boolean; detail: string }) => void)[] = [];
    vi.mocked(awaitAdEvent).mockImplementation(
      () =>
        new Promise((res) => {
          resolvers.push(res);
        }),
    );
    return resolvers;
  }

  /** 마이크로태스크만 흘린다 — 동적 import와 promise 체인이 다음 단계까지 가도록. */
  const flush = async () => {
    for (let i = 0; i < 4; i++) await act(async () => {});
  };
  /** 가짜 시계를 밀고 그 뒤 promise까지 흘린다. */
  const advance = async (ms: number) => {
    await act(async () => void vi.advanceTimersByTime(ms));
    await flush();
  };

  const NOTICE = '잠시 후 광고가 나와요 · 휴식 시간은 그대로 흘러요';
  const SET_NOTICE = '세트를 마치면 휴식 중에 광고가 나와요';
  const notice = () => screen.queryByText(NOTICE);

  it('휴식 화면이 먼저 말하고, 3초가 지나야 광고가 뜬다', async () => {
    // ★ 유예가 이 반려의 핵심이다. 로드는 즉시 시작하되(수익을 늦추지 않는다) **노출만** 늦춘다.
    const q = adQueue();
    render(<Harness initial={restingAt(AD_REST)} />);
    await flush();

    expect(notice()).toBeTruthy();
    expect(awaitAdEvent).toHaveBeenCalledTimes(1); // 로드는 즉시

    q[0]({ ok: true, detail: 'loaded' });
    await flush();
    expect(awaitAdEvent).toHaveBeenCalledTimes(1); // 받아 놓고도 3초 전에는 안 띄운다

    await advance(3000);
    expect(awaitAdEvent).toHaveBeenCalledTimes(2); // 노출

    q[1]({ ok: true, detail: 'impression' });
    await flush();
    expect(notice()).toBeNull(); // 할 말이 끝났으면 문구도 사라진다
  });

  it('40초 미만 휴식에는 예고도 광고도 없다', async () => {
    // 안 나올 광고를 예고하면 그건 거짓말이다 — 판단은 `adPlan` 하나가 한다.
    adQueue();
    render(<Harness initial={restingAt(30)} />);
    await flush();

    expect(notice()).toBeNull();
    expect(awaitAdEvent).not.toHaveBeenCalled();
  });

  it('세트 화면은 다음 휴식에 광고가 나올 때만 미리 말한다', async () => {
    // ★ 조건 없이 늘 띄우면 광고가 안 나오는 휴식에도 예고가 남아 같은 거짓말이 된다.
    //   음성 케이스는 **백오프**로 만든다 — 미충전 1회 뒤에는 다음 슬롯을 쉬기 때문이다.
    const q = adQueue();
    render(<Harness initial={restingAt(AD_REST)} />);
    await flush();

    q[0]({ ok: false, detail: 'timeout' }); // 미충전 → noFillStreak 1
    await flush();
    click('휴식 건너뛰기');

    expect(screen.getByRole('button', { name: '세트 완료' })).toBeTruthy();
    expect(screen.queryByText(SET_NOTICE)).toBeNull(); // 백오프 슬롯이라 예고도 없다
  });

  it('광고가 나올 세션이면 세트 화면에서 미리 말한다', () => {
    render(<Harness initial={startSession([ex('push'), ex('pull')], 'health')} />);
    expect(screen.getByText(SET_NOTICE)).toBeTruthy();
  });

  it('마지막 운동의 마지막 세트에는 예고가 없다 — 그 뒤엔 휴식이 없다', () => {
    // ★ 마치는 순간 `completeSet`이 휴식 없이 `finished`로 보낸다. 여기서 예고하면
    //   「휴식 중에 광고가 나와요」를 읽고 완료 화면을 보게 된다 — 안 나올 광고의 예고다.
    const s = startSession([ex('push')], 'health');
    const lastSet = { ...s, done: [Array(SETS_PER_EXERCISE - 1).fill({ weight: 0, reps: 10 })] };
    render(<Harness initial={lastSet} />);
    expect(screen.queryByText(SET_NOTICE)).toBeNull();
  });

  it('마지막 운동이라도 마지막 세트가 아니면 예고가 있다', () => {
    // 위 조건이 「마지막 운동」까지만 보면 남은 두 세트의 휴식 광고를 통째로 안 알리게 된다.
    const s = startSession([ex('push')], 'health');
    render(<Harness initial={{ ...s, done: [[{ weight: 0, reps: 10 }]] }} />);
    expect(screen.getByText(SET_NOTICE)).toBeTruthy();
  });

  it('예고를 읽는 사이 휴식을 건너뛰면 광고를 띄우지 않는다', async () => {
    // ★ 휴식이 끝난 뒤에 전면 광고가 덮으면 **세트를 하는 도중에** 화면이 가려진다 —
    //   반려 사유가 말하는 「예상하기 어려운 시점」 그 자체다.
    const q = adQueue();
    render(<Harness initial={restingAt(AD_REST)} />);
    await flush();
    q[0]({ ok: true, detail: 'loaded' });
    await flush();

    click('휴식 건너뛰기');
    await advance(5000);

    expect(awaitAdEvent).toHaveBeenCalledTimes(1); // 노출 호출이 없다
    expect(notice()).toBeNull();
  });

  it('로드가 3초보다 오래 걸리면 추가 대기가 없다 — 유예는 휴식 시작 기준이다', async () => {
    // ★ 「로드 완료 뒤 3초」로 재면 로드가 오래 걸린 날 사용자는 예고를 13초쯤 읽고 있게 된다.
    //   유예는 **예고를 띄운 시각**부터다 — 그 사이 이미 3초가 지났으면 곧바로 띄운다.
    const q = adQueue();
    render(<Harness initial={restingAt(AD_REST)} />);
    await flush();

    await advance(10000); // 로드가 10초 걸렸다
    q[0]({ ok: true, detail: 'loaded' });
    await flush(); // 시계를 **더 밀지 않는다**

    expect(awaitAdEvent).toHaveBeenCalledTimes(2);
  });

  it('휴식 중에 화면이 사라지면 광고를 띄우지 않는다', async () => {
    // ★ 「휴식 중인가」는 렌더에서만 갱신된다 — 언마운트되면 마지막 값이 true로 얼어붙어,
    //   화면이 없는데도 전면 광고가 뜬다.
    const q = adQueue();
    const { unmount } = render(<Harness initial={restingAt(AD_REST)} />);
    await flush();
    q[0]({ ok: true, detail: 'loaded' });
    await flush();

    unmount();
    await advance(5000);

    expect(awaitAdEvent).toHaveBeenCalledTimes(1);
  });

  it('이전 휴식의 늦은 광고가 다음 휴식에 뜨지 않는다', async () => {
    // ★ 「휴식 중인가」만 보면 **어느 휴식인지**를 못 본다. 슬롯 N의 로드가 늦게 도착하면
    //   N+1에 얹혀 뜨고, N+1 것까지 오면 **한 휴식에 전면 광고가 두 개** 겹친다.
    const q = adQueue();
    render(<Harness initial={restingAt(AD_REST)} />);
    await flush(); // 슬롯 N 로드 대기 중

    click('휴식 건너뛰기');
    await advance(1000); // 슬롯이 같은 `restEndsAt`으로 겹치지 않게 시각을 벌린다
    click('세트 완료'); // 슬롯 N+1 시작
    await flush();
    expect(awaitAdEvent).toHaveBeenCalledTimes(2); // 로드 둘(N · N+1)

    q[0]({ ok: true, detail: 'loaded' }); // 이제야 도착한 N의 로드
    await advance(3000);
    expect(awaitAdEvent).toHaveBeenCalledTimes(2); // N은 자기 휴식이 끝났으니 포기한다

    q[1]({ ok: true, detail: 'loaded' });
    await advance(3000);
    expect(awaitAdEvent).toHaveBeenCalledTimes(3); // 이 휴식의 광고 하나만 뜬다
  });

  it('광고를 못 받으면 예고도 조용히 사라진다', async () => {
    // 실패는 사용자에게 안 보인다 — 광고는 수익이지 기능이 아니다. 남는 건 예고 문구뿐이라 그것만 걷는다.
    const q = adQueue();
    render(<Harness initial={restingAt(AD_REST)} />);
    await flush();
    expect(notice()).toBeTruthy();

    q[0]({ ok: false, detail: 'timeout' });
    await flush();

    expect(notice()).toBeNull();
    await advance(5000);
    expect(awaitAdEvent).toHaveBeenCalledTimes(1);
  });
});
