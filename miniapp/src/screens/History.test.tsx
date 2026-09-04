// @vitest-environment jsdom
// ⚠️ 전역으로 켜면 shareLinks 테스트가 죽는다 — 이유는 `Onboarding.test.tsx` 머리말 참조.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { listPhotos, type BodyPhoto as Photo } from '../photoStore';
import { todayKey, type WorkoutRecord } from '../storage';
import { History } from './History';

/**
 * 기록 탭 — 월간 캘린더.
 *
 * 화면의 주인이 리스트가 아니라 **달력**이다. 내용 조회는 날짜를 눌러야 뜨는 플로팅 카드가
 * 담당한다 — 그래서 「눌러도 안 뜨는 날」과 「안 눌리는 날」의 구분이 기능의 절반이다.
 *
 * ⚠️ `listPhotos`가 목인 이유는 T-232(jsdom에서 Blob이 왕복하며 정체를 잃는다) — 사유는
 * `PhotoCompare.test.tsx` 머리말과 같다.
 *
 * ⚠️ 날짜는 **오늘이 속한 달에서 만든다.** 달력은 이번 달로 열리므로 `2026-08-26` 같은 고정
 * 키를 쓰면 9월이 되는 순간 테스트가 전부 빨개진다 — 시계에 매달린 테스트는 계측기가 아니다.
 */
vi.mock('../photoStore', async (orig) => ({
  ...(await orig<typeof import('../photoStore')>()),
  listPhotos: vi.fn(),
}));

afterEach(cleanup);

const [THIS_Y, THIS_M] = todayKey().split('-').map(Number);
const PREV = THIS_M === 1 ? { y: THIS_Y - 1, m: 12 } : { y: THIS_Y, m: THIS_M - 1 };

/** `YYYY-MM-DD`. 달력 셀 · 기록 · 사진이 전부 이 문자열 하나로 만난다. */
const key = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
/** 이번 달 D일. */
const day = (d: number) => key(THIS_Y, THIS_M, d);

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 달력을 특정 달로 몰고 간다. **요일 단언은 고정 날짜로만 할 수 있어서** 필요하다 —
 * 오늘 기준으로 만든 날짜의 요일을 테스트가 다시 계산하면 구현과 같은 식을 베낀
 * 자기참조가 되고, 그 단언은 무엇도 못 잡는다(리뷰 실측).
 */
function goTo(year: number, month: number) {
  const steps = (THIS_Y - year) * 12 + (THIS_M - month);
  const name = steps > 0 ? '지난달' : '다음달';
  for (let i = 0; i < Math.abs(steps); i += 1) fireEvent.click(screen.getByRole('button', { name }));
}

const photo = (date: string): Photo => ({ date, blob: new Blob([date]), capturedAt: 1, width: 720, height: 1280 });
const seed = (dates: string[]) => vi.mocked(listPhotos).mockResolvedValue(dates.map(photo));

const rec = (
  date: string,
  group: WorkoutRecord['group'] = 'upper',
  entries: { name: string; sets: { weight: number; reps: number }[] }[] = [
    { name: '벤치프레스', sets: [{ weight: 20, reps: 10 }, { weight: 20, reps: 10 }] },
  ],
): WorkoutRecord => ({ date, group, entries: entries.map((e, i) => ({ id: `${date}-${i}`, ...e })) });

function setup(history: WorkoutRecord[] = []) {
  const onComparePhotos = vi.fn();
  const view = render(
    <History
      history={history}
      onResetOnboarding={() => {}}
      onComparePhotos={onComparePhotos}
      idb={new IDBFactory() as IDBFactory}
    />,
  );
  return { ...view, onComparePhotos };
}

/** 달력의 그 날 칸. 빈 날도 칸은 있다 — 「칸이 있는가」와 「누를 수 있는가」는 다른 질문이다. */
const cellOf = (container: HTMLElement, k: string) => container.querySelector(`[data-day="${k}"]`) as HTMLElement;
const marksOf = (cell: HTMLElement) => [...cell.querySelectorAll('[data-mark]')].map((m) => m.getAttribute('data-mark'));
/**
 * 사진은 IndexedDB에서 **비동기로** 온다 — 도착 전에 단언하면 「사진이 없다」를 보게 된다.
 * 도착 신호로 비교 로우의 썸네일을 쓴다(사진이 0장이면 로우 자체가 없으므로 신호가 명확하다).
 */
const photosLoaded = () => screen.findByAltText('최근 눈바디 사진');

beforeEach(() => {
  vi.clearAllMocks();
  seed([]);
  URL.createObjectURL = vi.fn(() => 'blob:thumb');
  URL.revokeObjectURL = vi.fn();
});

describe('기록 탭 — 달력', () => {
  it('이번 달로 열린다', () => {
    setup();
    expect(screen.getByText(`${THIS_Y}년 ${THIS_M}월`)).toBeTruthy();
  });

  it('요일 헤더는 일요일로 시작한다 — 국내 달력 관례', () => {
    const { container } = setup();
    const heads = [...container.querySelectorAll('[data-weekday]')].map((e) => e.textContent);
    expect(heads).toEqual(WEEKDAY);
  });

  it('기록이 0건이어도 달력은 그린다 — 마커만 없다', () => {
    const { container } = setup([]);
    expect(cellOf(container, day(1))).toBeTruthy();
    expect(marksOf(cellOf(container, day(1)))).toEqual([]);
  });

  it('오늘 칸에만 파란 테두리를 두른다', () => {
    const { container } = setup();
    // ⚠️ 테두리는 shorthand를 통째로 갈아 끼운다(`ui.ts` 머리말) — `borderColor`만 덮으면
    // 리렌더에서 색이 풀린다. 그래서 잠그는 것도 shorthand 문자열이다.
    // ⚠️ jsdom은 `border: … var(--accent)`를 longhand로 못 펼친다 — `style.borderColor`는
    // **빈 문자열**이다(실측). shorthand로 쓴 값은 shorthand로만 읽힌다.
    expect(cellOf(container, todayKey()).style.border).toBe('2px solid var(--accent)');
    const other = todayKey() === day(1) ? day(2) : day(1);
    expect(cellOf(container, other).style.border).not.toBe('2px solid var(--accent)');
  });

  it('오늘 운동했으면 — 버튼이 된 오늘 칸에도 테두리가 남는다', () => {
    // 활성 칸은 스타일을 한 겹 더 덮는다(`background: none`). 기록 0건으로만 재면 그 분기는
    // 어떤 테스트도 안 지나는데, 정작 **오늘 운동한 사람**에게는 그쪽이 항상 지나는 길이다.
    const { container } = setup([rec(todayKey())]);
    expect(cellOf(container, todayKey()).tagName).toBe('BUTTON');
    expect(cellOf(container, todayKey()).style.border).toBe('2px solid var(--accent)');
  });
});

describe('기록 탭 — 마커', () => {
  it('운동한 날에는 파란 운동 마커가 뜬다', () => {
    const { container } = setup([rec(day(3))]);
    const marks = cellOf(container, day(3)).querySelectorAll('[data-mark]');
    expect([...marks].map((m) => m.getAttribute('data-mark'))).toEqual(['workout']);
    expect((marks[0] as HTMLElement).style.backgroundColor).toBe('var(--accent)');
  });

  it('눈바디를 찍은 날에는 초록 눈바디 마커가 뜬다', async () => {
    seed([day(4)]);
    const { container } = setup([]);

    await photosLoaded();
    const marks = cellOf(container, day(4)).querySelectorAll('[data-mark]');
    expect([...marks].map((m) => m.getAttribute('data-mark'))).toEqual(['photo']);
    expect((marks[0] as HTMLElement).style.backgroundColor).toBe('var(--green)');
  });

  it('둘 다 있는 날은 「운동 왼쪽 · 눈바디 오른쪽」 순서가 고정이다', async () => {
    seed([day(5)]);
    const { container } = setup([rec(day(5))]);

    await photosLoaded();
    expect(marksOf(cellOf(container, day(5)))).toEqual(['workout', 'photo']);
  });

  it('아무것도 없는 날에는 마커가 없다', () => {
    const { container } = setup([rec(day(3))]);
    expect(marksOf(cellOf(container, day(6)))).toEqual([]);
  });

  it('색에만 기대지 않는다 — 범례가 무슨 점인지 말해 준다', () => {
    setup();
    expect(screen.getByText('운동')).toBeTruthy();
    expect(screen.getByText('눈바디')).toBeTruthy();
  });
});

describe('기록 탭 — 누를 수 있는 날', () => {
  it('기록이 있는 날은 버튼이다', () => {
    const { container } = setup([rec(day(7))]);
    expect(cellOf(container, day(7)).tagName).toBe('BUTTON');
  });

  it('사진만 있는 날도 버튼이다', async () => {
    seed([day(8)]);
    const { container } = setup([]);
    await photosLoaded();
    expect(cellOf(container, day(8)).tagName).toBe('BUTTON');
  });

  it('빈 날은 버튼이 아니다 — 눌러도 아무 일 없는 버튼을 만들지 않는다', () => {
    const { container } = setup([rec(day(7))]);
    expect(cellOf(container, day(9)).tagName).not.toBe('BUTTON');
  });
});

describe('기록 탭 — 플로팅 카드', () => {
  const open = (container: HTMLElement, k: string) => fireEvent.click(cellOf(container, k));

  it('날짜를 누르면 그날 부위·운동명·세트가 뜬다', () => {
    const { container } = setup([rec(day(10), 'upper')]);

    open(container, day(10));

    const sheet = container.querySelector('[data-sheet]') as HTMLElement;
    // 요일 값 자체는 아래 「2026년 8월 20일은 목요일이다」가 고정 날짜로 잠근다.
    expect(within(sheet).getByText(new RegExp(`^${THIS_M}월 10일 [일월화수목금토]요일$`))).toBeTruthy();
    expect(within(sheet).getByText('상체')).toBeTruthy();
    expect(within(sheet).getByText('벤치프레스')).toBeTruthy();
    // 표기는 기존 리스트 그대로 — 맨몸이면 `10회`, 무게가 있으면 `20×10`.
    expect(within(sheet).getByText('20×10 · 20×10')).toBeTruthy();
  });

  it('2026년 8월 20일은 목요일이다 — 요일을 리터럴로 잠근다', () => {
    const { container } = setup([rec('2026-08-20')]);

    // 오늘이 언제든 그 달로 몰고 간다. 기대값은 계산하지 않고 박아 둔다 —
    // 테스트가 구현과 같은 식으로 요일을 구하면 둘이 함께 틀려도 초록이다.
    goTo(2026, 8);
    fireEvent.click(cellOf(container, '2026-08-20'));

    expect(screen.getByText('8월 20일 목요일')).toBeTruthy();
  });

  it('맨몸 세트는 회수로 적는다', () => {
    const { container } = setup([
      rec(day(11), 'upper', [{ name: '푸시업', sets: [{ weight: 0, reps: 15 }] }]),
    ]);

    open(container, day(11));

    expect(screen.getByText('15회')).toBeTruthy();
  });

  it('누르기 전에는 안 떠 있다', () => {
    const { container } = setup([rec(day(10))]);
    expect(container.querySelector('[data-sheet]')).toBeNull();
  });

  it('같은 날 레코드가 둘이면 둘 다 보여준다 — 저장이 날짜로 합치지 않는다', () => {
    const { container } = setup([
      rec(day(12), 'upper', [{ name: '벤치프레스', sets: [{ weight: 20, reps: 10 }] }]),
      rec(day(12), 'lower', [{ name: '스쿼트', sets: [{ weight: 40, reps: 8 }] }]),
    ]);

    open(container, day(12));

    const sheet = container.querySelector('[data-sheet]') as HTMLElement;
    expect(within(sheet).getByText('벤치프레스')).toBeTruthy();
    expect(within(sheet).getByText('스쿼트')).toBeTruthy();
    expect(within(sheet).getByText('상체')).toBeTruthy();
    expect(within(sheet).getByText('하체')).toBeTruthy();
  });

  it('구 어휘 기록도 라벨이 뜬다 — 2분할 이전 기록이 영어 키로 새지 않는다', () => {
    const { container } = setup([rec(day(13), 'chest')]);

    open(container, day(13));

    expect(screen.getByText('가슴')).toBeTruthy();
  });

  it('그날 눈바디가 있으면 사진도 함께 뜬다', async () => {
    seed([day(14)]);
    const { container } = setup([rec(day(14))]);
    await photosLoaded();

    open(container, day(14));

    const sheet = container.querySelector('[data-sheet]') as HTMLElement;
    const img = within(sheet).getByAltText(`${day(14)} 눈바디 사진`) as HTMLImageElement;
    expect(img.src).toBe('blob:thumb');
    expect(within(sheet).getByText('벤치프레스')).toBeTruthy();
  });

  it('사진만 있는 날은 사진만 뜬다', async () => {
    seed([day(15)]);
    const { container } = setup([]);
    await photosLoaded();

    open(container, day(15));

    const sheet = container.querySelector('[data-sheet]') as HTMLElement;
    expect(within(sheet).getByAltText(`${day(15)} 눈바디 사진`)).toBeTruthy();
    expect(within(sheet).queryByText('벤치프레스')).toBeNull();
  });

  it('✕로 닫는다', () => {
    const { container } = setup([rec(day(16))]);
    open(container, day(16));

    fireEvent.click(screen.getByRole('button', { name: '닫기' }));

    expect(container.querySelector('[data-sheet]')).toBeNull();
  });

  it('딤을 눌러도 닫힌다', () => {
    const { container } = setup([rec(day(17))]);
    open(container, day(17));

    fireEvent.click(container.querySelector('[data-dim]') as HTMLElement);

    expect(container.querySelector('[data-sheet]')).toBeNull();
  });
});

describe('기록 탭 — 월 이동', () => {
  it('‹ 를 누르면 지난달로 간다 — 지난달 기록의 마커까지', () => {
    const { container } = setup([rec(key(PREV.y, PREV.m, 20))]);

    fireEvent.click(screen.getByRole('button', { name: '지난달' }));

    expect(screen.getByText(`${PREV.y}년 ${PREV.m}월`)).toBeTruthy();
    expect(marksOf(cellOf(container, key(PREV.y, PREV.m, 20)))).toEqual(['workout']);
    // 이번 달 셀은 더 이상 그려지지 않는다.
    expect(cellOf(container, todayKey())).toBeNull();
  });

  it('› 로 되돌아온다 — 기록이 없는 달도 막지 않는다', () => {
    setup([]);

    fireEvent.click(screen.getByRole('button', { name: '지난달' }));
    fireEvent.click(screen.getByRole('button', { name: '다음달' }));

    expect(screen.getByText(`${THIS_Y}년 ${THIS_M}월`)).toBeTruthy();
  });
});

describe('기록 탭 — 월 요약', () => {
  it('세는 단위는 **날**이다 — 같은 날 두 번 해도 하루다', async () => {
    seed([day(1), day(2)]);
    setup([rec(day(1)), rec(day(1)), rec(day(2))]);

    expect(await screen.findByText(`${THIS_M}월 · 2일 운동 · 눈바디 2장`)).toBeTruthy();
  });

  it('보는 달만 센다 — 지난달 기록·사진은 이번 달 요약에 안 들어간다', async () => {
    // 사진 쪽도 지난달 것을 섞어 둔다. 안 섞으면 「이번 달 사진 수」를 「전체 사진 수」로
    // 바꿔도 0 == 0이라 통과한다 — 범위가 아니라 우연을 재는 테스트가 된다.
    seed([day(2), key(PREV.y, PREV.m, 20)]);
    setup([rec(day(1)), rec(key(PREV.y, PREV.m, 20))]);

    expect(await screen.findByText(`${THIS_M}월 · 1일 운동 · 눈바디 1장`)).toBeTruthy();
  });
});

describe('기록 탭 — 눈바디 입구', () => {
  it('촬영 입구가 없다 — 완료 화면 제안이 유일한 문이다', async () => {
    seed([todayKey()]);
    setup([]);

    await screen.findByRole('button', { name: '비교' });
    expect(screen.queryByRole('button', { name: '오늘 찍기' })).toBeNull();
    expect(screen.queryByRole('button', { name: '오늘 다시 찍기' })).toBeNull();
    expect(screen.queryByText(/찍기/)).toBeNull();
  });

  it('사진이 없으면 비교 로우 자체가 없다 — 빈 화면으로 보내는 버튼을 만들지 않는다', async () => {
    setup([]);
    expect(await screen.findByText(/기록은 이 기기에만/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: '비교' })).toBeNull();
  });

  it('사진이 있으면 장수와 최근 날짜를 걸고 비교로 보낸다', async () => {
    seed([day(1), day(2)]);
    const { onComparePhotos } = setup([]);

    fireEvent.click(await screen.findByRole('button', { name: '비교' }));

    expect(screen.getByText(`눈바디 2장 · 최근 ${THIS_M}/2`)).toBeTruthy();
    expect(onComparePhotos).toHaveBeenCalled();
  });

  it('사진도 이 기기에만 남는다고 적는다 — 기록과 같은 문장', async () => {
    seed([day(1)]);
    setup([]);

    expect(await screen.findByText('사진은 이 기기에만 저장되며 어디로도 전송되지 않습니다.')).toBeTruthy();
  });

  it('로우에 거는 얼굴은 최신이다', async () => {
    seed([day(1), day(2)]);
    setup([]);

    const thumb = (await screen.findByAltText('최근 눈바디 사진')) as HTMLImageElement;
    expect(thumb.src).toBe('blob:thumb');
    const [blob] = vi.mocked(URL.createObjectURL).mock.calls[0] as [Blob];
    expect(await blob.text()).toBe(day(2));
  });

  it('탭을 떠나면 썸네일 blob URL을 놓아준다', async () => {
    seed([day(2)]);
    setup([]);
    await screen.findByAltText('최근 눈바디 사진');

    cleanup();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:thumb');
  });
});

describe('기록 탭 — 유지되는 것', () => {
  it('기록이 이 기기에만 남는다고 계속 적는다', () => {
    setup([]);
    expect(screen.getByText('기록은 이 기기에만 저장됩니다. 앱을 지우거나 기기를 바꾸면 사라집니다.')).toBeTruthy();
  });

  it('기록이 하나도 없으면 어디서 시작하는지 알려준다', () => {
    setup([]);
    expect(screen.getByText('아직 기록이 없습니다.')).toBeTruthy();
  });

  it('기록이 있으면 빈 안내는 사라진다', () => {
    setup([rec(day(1))]);
    expect(screen.queryByText('아직 기록이 없습니다.')).toBeNull();
  });

  it('온보딩 다시 보기는 개발 빌드의 유일한 입구라 남는다', () => {
    setup([]);
    expect(screen.getByRole('button', { name: '온보딩 다시 보기' })).toBeTruthy();
  });
});
