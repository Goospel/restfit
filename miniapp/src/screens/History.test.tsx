// @vitest-environment jsdom
// ⚠️ 전역으로 켜면 shareLinks 테스트가 죽는다 — 이유는 `Onboarding.test.tsx` 머리말 참조.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { listPhotos, type BodyPhoto as Photo } from '../photoStore';
import { todayKey } from '../storage';
import { History } from './History';

/**
 * 기록 탭의 눈바디 카드.
 *
 * **운동을 안 한 날에도 찍을 수 있는 유일한 입구**이고(완료 화면은 운동한 날만 뜬다),
 * 비교 화면으로 가는 유일한 문이다. 그래서 카드가 안 뜨는 상태가 있으면 기능 절반이 사라진다.
 *
 * ⚠️ `listPhotos`가 목인 이유는 T-232(jsdom에서 Blob이 왕복하며 정체를 잃는다) — 사유는
 * `PhotoCompare.test.tsx` 머리말과 같다.
 */
vi.mock('../photoStore', async (orig) => ({
  ...(await orig<typeof import('../photoStore')>()),
  listPhotos: vi.fn(),
}));

afterEach(cleanup);

const photo = (date: string): Photo => ({ date, blob: new Blob([date]), capturedAt: 1, width: 720, height: 1280 });
const seed = (dates: string[]) => vi.mocked(listPhotos).mockResolvedValue(dates.map(photo));

function setup() {
  const onShootPhoto = vi.fn();
  const onComparePhotos = vi.fn();
  render(
    <History
      history={[]}
      onResetOnboarding={() => {}}
      onShootPhoto={onShootPhoto}
      onComparePhotos={onComparePhotos}
      idb={new IDBFactory() as IDBFactory}
    />,
  );
  return { onShootPhoto, onComparePhotos };
}

beforeEach(() => {
  vi.clearAllMocks();
  seed([]);
  URL.createObjectURL = vi.fn(() => 'blob:thumb');
  URL.revokeObjectURL = vi.fn();
});

describe('기록 탭 — 눈바디 카드', () => {
  it('사진이 없으면 빈 상태로 권한다', async () => {
    setup();
    expect(await screen.findByText('아직 눈바디 사진이 없어요')).toBeTruthy();
    // 비교할 것이 없는데 문을 열어 두면 빈 화면으로 보내는 버튼이 된다.
    expect(screen.queryByRole('button', { name: '비교' })).toBeNull();
  });

  it('찍기를 누르면 촬영이 열린다 — 운동을 안 한 날의 유일한 입구다', async () => {
    const { onShootPhoto } = setup();

    fireEvent.click(await screen.findByRole('button', { name: '오늘 찍기' }));

    expect(onShootPhoto).toHaveBeenCalled();
  });

  it('사진이 있으면 최신 썸네일과 그 날짜를 보여준다', async () => {
    seed(['2026-08-01', '2026-08-20']);
    setup();

    const thumb = (await screen.findByAltText('최근 눈바디 사진')) as HTMLImageElement;
    expect(thumb.src).toBe('blob:thumb');
    // 카드에 걸 얼굴은 **최신**이다. 기준(가장 오래된 것)을 걸면 몇 달 전 몸이 계속 걸려 있다.
    const [blob] = vi.mocked(URL.createObjectURL).mock.calls[0] as [Blob];
    expect(await blob.text()).toBe('2026-08-20');
    expect(screen.getByText('2026-08-20')).toBeTruthy();
  });

  it('오늘 이미 찍었으면 「다시 찍기」다 — 하루 1장이라 덮어쓰는 것을 미리 알린다', async () => {
    seed([todayKey()]);
    setup();

    expect(await screen.findByRole('button', { name: '오늘 다시 찍기' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '오늘 찍기' })).toBeNull();
  });

  it('사진이 있으면 비교로 들어간다', async () => {
    seed(['2026-08-01']);
    const { onComparePhotos } = setup();

    fireEvent.click(await screen.findByRole('button', { name: '비교' }));

    expect(onComparePhotos).toHaveBeenCalled();
  });

  it('사진도 이 기기에만 남는다고 적는다 — 기록과 같은 문장', async () => {
    setup();
    expect(await screen.findByText('사진은 이 기기에만 저장되며 어디로도 전송되지 않습니다.')).toBeTruthy();
  });

  it('탭을 떠나면 썸네일 blob URL을 놓아준다', async () => {
    seed(['2026-08-20']);
    setup();
    await screen.findByAltText('최근 눈바디 사진');

    cleanup();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:thumb');
  });
});
