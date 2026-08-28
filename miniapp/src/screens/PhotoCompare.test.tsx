// @vitest-environment jsdom
// ⚠️ 전역으로 켜면 shareLinks 테스트가 죽는다 — 이유는 `Onboarding.test.tsx` 머리말 참조.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearPhotos,
  deletePhoto,
  listPhotos,
  openPhotoDb,
  type BodyPhoto as Photo,
  type PhotoDb,
} from '../photoStore';
import { PhotoCompare } from './PhotoCompare';

/**
 * 눈바디 비교 화면.
 *
 * ⚠️ **`listPhotos`가 목인 이유는 T-232다** — jsdom + fake-indexeddb에서는 Blob이 왕복하며
 * 평범한 객체로 바뀌어 저장소의 어휘 검증에 통째로 걸리고, 목록이 **항상 빈다**. 저장소의
 * 진짜 왕복은 node 환경의 `photoStore.test.ts`가 잰다. **`openPhotoDb`는 진짜를 쓴다** —
 * 「IDB가 없으면 안내」가 이 화면의 분기라서 그렇다.
 *
 * 여기서 잠그는 것: **기준은 고정이고 오른쪽만 움직인다**(무엇 대비 무엇인지가 흐려지면
 * 비교가 아니다) · **삭제한 뒤에는 목록을 다시 읽어 보여 준다**(조용한 삭제 실패가 화면에
 * 「지워진 것처럼」 보이면 사용자는 지워졌다고 믿는다) · **전체 삭제는 확인을 거친다.**
 */
vi.mock('../photoStore', async (orig) => {
  const actual = await orig<typeof import('../photoStore')>();
  return {
    ...actual,
    // 기본값은 **진짜**다 — 「IDB가 없으면 안내」 분기를 재려면 진짜가 열려야 한다.
    // 늦게 도착하는 DB 하나만 테스트가 `mockReturnValueOnce`로 갈아 끼운다.
    openPhotoDb: vi.fn(actual.openPhotoDb),
    listPhotos: vi.fn(),
    deletePhoto: vi.fn(),
    clearPhotos: vi.fn(),
  };
});

afterEach(cleanup);

/**
 * blob → URL 대응표. **한 장 한 장을 구별할 수 있어야 한다** — 모든 사진에 같은 가짜 URL을
 * 주면 「어느 사진이 어느 자리에 걸렸는가」를 못 재고, 기준이 선택을 따라 움직여도 날짜
 * 글씨만 보고 통과시킨다(돌연변이 실측으로 잡힌 공허함이다).
 */
const urls = new Map<Blob, string>();

function photo(date: string): Photo {
  const blob = new Blob([date]);
  urls.set(blob, `blob:${date}`);
  return { date, blob, capturedAt: 1, width: 720, height: 1280 };
}

const srcOf = (alt: string) => (screen.getByAltText(alt) as HTMLImageElement).src;

/** `listPhotos`가 주는 순서 그대로(날짜 오름차순) 준다 — 이 화면이 그 중 무엇을 고르는지가 잴 것이다. */
const seed = (dates: string[]) => vi.mocked(listPhotos).mockResolvedValue(dates.map(photo));

function setup(over: Partial<Parameters<typeof PhotoCompare>[0]> = {}) {
  const onClose = vi.fn();
  const view = render(<PhotoCompare onClose={onClose} idb={new IDBFactory() as IDBFactory} {...over} />);
  return { onClose, ...view };
}

const btn = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

beforeEach(() => {
  // ⚠️ 목이 **모듈 수준**이라 호출 기록이 파일 전체에 누적된다 — 안 지우면 「몇 번 불렸나」를
  // 재는 테스트가 앞선 테스트의 호출까지 세서 통과·실패가 실행 순서에 달린다.
  vi.clearAllMocks();
  seed([]);
  vi.mocked(deletePhoto).mockResolvedValue(undefined);
  vi.mocked(clearPhotos).mockResolvedValue(undefined);
  // jsdom에는 없다. 만든 URL을 도로 놓아주는지(revoke)가 이 화면의 누수 검증점이다.
  URL.createObjectURL = vi.fn((b: Blob) => urls.get(b) ?? 'blob:모르는사진');
  URL.revokeObjectURL = vi.fn();
});

describe('비교 화면 — 사진 수에 따른 분기', () => {
  it('한 장도 없으면 비교 대신 안내다', async () => {
    setup();
    expect(await screen.findByText('아직 눈바디 사진이 없어요')).toBeTruthy();
    expect(screen.queryByAltText('기준 사진')).toBeNull();
  });

  it('한 장이면 그 장만 보여주고 내일을 권한다 — 비교가 성립하지 않는다', async () => {
    seed(['2026-08-01']);
    setup();

    expect(await screen.findByText('내일 또 찍으면 비교할 수 있어요')).toBeTruthy();
    // 같은 사진을 좌우에 두 번 걸면 「변화가 없다」는 거짓말이 된다.
    expect(screen.queryByAltText('기준 사진')).toBeNull();
    expect(screen.getByText('2026-08-01')).toBeTruthy();
  });

  it('여러 장이면 기준(가장 오래된)과 최신을 나란히 놓는다', async () => {
    seed(['2026-08-01', '2026-08-10', '2026-08-20']);
    setup();

    expect(await screen.findByAltText('기준 사진')).toBeTruthy();
    // 날짜 글씨가 아니라 **걸린 사진**을 잰다 — 둘이 어긋나는 것이 이 화면의 실패 모드다.
    expect(srcOf('기준 사진')).toBe('blob:2026-08-01');
    expect(screen.getByText('2026-08-01')).toBeTruthy();
    // 기본 오른쪽은 **최신**이다 — 열자마자 보고 싶은 것은 지금의 몸이다.
    expect(srcOf('비교 사진')).toBe('blob:2026-08-20');
    expect(screen.getByText('2026-08-20')).toBeTruthy();
    expect(screen.queryByText('2026-08-10')).toBeNull();
  });

  it('IDB를 못 쓰는 기기에서는 안내로 접힌다', async () => {
    setup({ idb: undefined });
    expect(await screen.findByText('이 기기에서는 사진을 불러올 수 없어요')).toBeTruthy();
  });

  it('닫기로 돌아간다', async () => {
    const { onClose } = setup();
    await screen.findByText('아직 눈바디 사진이 없어요');

    fireEvent.click(btn('닫기'));

    expect(onClose).toHaveBeenCalled();
  });
});

describe('비교 화면 — 날짜 이동', () => {
  it('오른쪽만 움직이고 기준은 고정이다', async () => {
    seed(['2026-08-01', '2026-08-10', '2026-08-20']);
    setup();
    await screen.findByAltText('기준 사진');

    fireEvent.click(btn('이전 날짜'));

    expect(srcOf('비교 사진')).toBe('blob:2026-08-10');
    expect(screen.getByText('2026-08-10')).toBeTruthy();
    // 왼쪽까지 움직이면 「무엇 대비 무엇인가」가 흐려진다. **날짜 글씨는 그대로인데 사진만
    // 따라 움직이는** 어긋남이 실제로 가능하므로 둘 다 잰다.
    expect(srcOf('기준 사진')).toBe('blob:2026-08-01');
    expect(screen.getByText('2026-08-01')).toBeTruthy();
    expect(screen.queryByText('2026-08-20')).toBeNull();
  });

  it('기준까지 되돌아와도 좌우에 같은 사진을 걸지 않는다', async () => {
    // 같은 사진 두 장은 「변화가 없다」는 거짓말이다. 왼쪽이 접히고 라벨이 그 자리를 말한다.
    seed(['2026-08-01', '2026-08-10', '2026-08-20']);
    setup();
    await screen.findByAltText('기준 사진');

    fireEvent.click(btn('이전 날짜'));
    fireEvent.click(btn('이전 날짜'));

    expect(screen.queryByAltText('기준 사진')).toBeNull();
    expect(srcOf('비교 사진')).toBe('blob:2026-08-01');
    expect(screen.getByText('이 사진이 기준입니다')).toBeTruthy();
    // ⚠️ **이 자리를 「이전 날짜 비활성」으로 막으면 안 된다** — 기준을 바꾸는 유일한 길이
    // 기준을 골라 지우는 것이라(설계 §4.2), 못 오게 하면 기준이 영영 고정된다.
    expect(btn('이 사진 삭제')).toBeTruthy();
    expect(btn('다음 날짜').disabled).toBe(false);
  });

  it('양 끝에서는 더 못 넘긴다', async () => {
    seed(['2026-08-01', '2026-08-10']);
    setup();
    await screen.findByAltText('기준 사진');

    // 최신에서 시작한다 — 다음은 없다.
    expect(btn('다음 날짜').disabled).toBe(true);
    fireEvent.click(btn('이전 날짜'));
    expect(btn('이전 날짜').disabled).toBe(true);
    expect(btn('다음 날짜').disabled).toBe(false);
  });
});

describe('비교 화면 — 삭제', () => {
  it('이 사진 삭제는 선택한 날짜를 지운다', async () => {
    seed(['2026-08-01', '2026-08-10', '2026-08-20']);
    setup();
    await screen.findByAltText('기준 사진');

    fireEvent.click(btn('이 사진 삭제'));

    await waitFor(() => expect(vi.mocked(deletePhoto).mock.calls[0][1]).toBe('2026-08-20'));
  });

  it('삭제 뒤에는 목록을 다시 읽어 보여 준다 — 화면이 지레 지웠다고 하지 않는다', async () => {
    // 저장소가 조용히 실패해도 화면은 저장소가 실제로 가진 것만 보여야 한다.
    // 그래서 지운 뒤의 화면은 **재조회 결과**여야 하고, 로컬 배열에서 한 장 뺀 것이면 안 된다.
    seed(['2026-08-01', '2026-08-10', '2026-08-20']);
    setup();
    await screen.findByAltText('기준 사진');

    // 재조회가 「한 장만 남았다」고 답한다 — 로컬 필터로는 만들 수 없는 결과다.
    seed(['2026-08-01']);
    fireEvent.click(btn('이 사진 삭제'));

    expect(await screen.findByText('내일 또 찍으면 비교할 수 있어요')).toBeTruthy();
    expect(vi.mocked(listPhotos)).toHaveBeenCalledTimes(2);
  });

  it('모두 삭제는 확인을 거친다 — 취소하면 아무 일도 없다', async () => {
    seed(['2026-08-01', '2026-08-10']);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    setup();
    await screen.findByAltText('기준 사진');

    fireEvent.click(btn('사진 모두 삭제'));

    expect(confirm).toHaveBeenCalled();
    expect(clearPhotos).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('확인하면 전부 지우고 빈 화면을 다시 읽어 보여 준다', async () => {
    seed(['2026-08-01', '2026-08-10']);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    setup();
    await screen.findByAltText('기준 사진');

    seed([]);
    fireEvent.click(btn('사진 모두 삭제'));

    expect(await screen.findByText('아직 눈바디 사진이 없어요')).toBeTruthy();
    expect(clearPhotos).toHaveBeenCalled();
    confirm.mockRestore();
  });
});

describe('비교 화면 — 수명', () => {
  it('닫으면 blob URL을 놓아준다 — 날짜를 넘길 때마다 새면 조용히 메모리만 자란다', async () => {
    seed(['2026-08-01', '2026-08-10']);
    const { unmount } = setup();
    await screen.findByAltText('기준 사진');

    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(vi.mocked(URL.createObjectURL).mock.calls.length);
  });

  it('닫으면 DB 연결도 닫는다 — 촬영 화면과 같은 규칙이다', async () => {
    // 프로토타입에 건다 — 화면이 연 연결의 핸들은 밖에서 잡을 수 없다(`BodyPhoto.test.tsx`와 같은 수법).
    const db = await openPhotoDb(new IDBFactory() as IDBFactory);
    const close = vi.spyOn(Object.getPrototypeOf(db!) as IDBDatabase, 'close');
    seed(['2026-08-01']);
    const { unmount } = setup();
    await screen.findByText('내일 또 찍으면 비교할 수 있어요');

    unmount();

    expect(close).toHaveBeenCalled();
    close.mockRestore();
  });

  it('열리기 전에 닫아도 뒤늦게 온 DB를 닫는다 — 붙일 화면도 없는 연결이 살아남는다', async () => {
    let arrive!: (db: PhotoDb) => void;
    vi.mocked(openPhotoDb).mockReturnValueOnce(new Promise((r) => (arrive = r)));
    const { unmount } = setup();

    unmount();
    const close = vi.fn();
    arrive({ close } as unknown as PhotoDb);

    await waitFor(() => expect(close).toHaveBeenCalled());
  });
});
