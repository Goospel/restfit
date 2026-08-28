// @vitest-environment jsdom
// ⚠️ 전역으로 켜면 shareLinks 테스트가 죽는다 — 이유는 `Onboarding.test.tsx` 머리말 참조.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { listPhotos, savePhoto, type BodyPhoto as Photo } from '../photoStore';
import { BodyPhoto } from './BodyPhoto';

/**
 * 눈바디 촬영 화면.
 *
 * 브라우저만 가진 것을 목으로 갈아 끼운다 — `getUserMedia`(jsdom에 없다) · 캔버스 프레임
 * 캡처(2D 컨텍스트가 없다) · 사진 목록과 저장.
 *
 * ⚠️ **`listPhotos`까지 목인 이유는 게을러서가 아니다.** jsdom + fake-indexeddb에서는 Blob이
 * 왕복하며 **평범한 객체로 바뀌어**(구조화 복제가 jsdom의 Blob을 모른다) 저장소의 어휘 검증에
 * 통째로 걸린다 — 진짜 왕복을 태우면 목록이 **항상 빈다**(T-232). 저장소 자체는
 * `photoStore.test.ts`가 node 환경에서 진짜로 잰다. **`openPhotoDb`는 진짜를 쓴다** —
 * 「IDB가 없으면 안내로 빠진다」는 이 화면의 분기라서 그렇다.
 *
 * 여기서 잠그는 것: **첫 촬영과 이후 촬영이 다른 화면이다**(실루엣 ↔ 고스트) ·
 * **실패 세 갈래가 각각 다른 안내다**(심사자가 권한 거부부터 눌러 본다) · **닫으면 카메라가
 * 꺼진다** · **저장 실패는 원인별로 다른 문구다**(쿼터에 「다시 시도」는 거짓말이다).
 */
vi.mock('../photoStore', async (orig) => ({
  ...(await orig<typeof import('../photoStore')>()),
  listPhotos: vi.fn(),
  savePhoto: vi.fn(),
}));

afterEach(cleanup);

const OK = (s: MediaStream) => async () => s;
const DENIED = async () => {
  throw Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });
};

/** 트랙 하나짜리 가짜 스트림. `stop`이 불렸는지가 「카메라가 꺼졌는가」의 유일한 관측점이다. */
function fakeStream() {
  const stop = vi.fn();
  return { stream: { getTracks: () => [{ stop }] } as unknown as MediaStream, stop };
}

const shot = { blob: new Blob(['jpeg'], { type: 'image/jpeg' }), width: 720, height: 1280 };

function setup(over: Partial<Parameters<typeof BodyPhoto>[0]> = {}) {
  const onClose = vi.fn();
  const capture = vi.fn(async () => shot);
  const props = {
    onClose,
    capture,
    media: { getUserMedia: OK(fakeStream().stream) },
    idb: new IDBFactory() as IDBFactory,
    ...over,
  };
  const view = render(<BodyPhoto {...props} />);
  return { onClose, capture, ...view };
}

/**
 * 이미 저장돼 있는 사진들. **`listPhotos`가 주는 순서 그대로 준다**(날짜 오름차순 —
 * 저장소가 스펙으로 보장하고 `photoStore.test.ts`가 잰다). 이 화면이 그 중 **어느 것을**
 * 고르는지가 여기서 잴 것이다.
 */
function seed(dates: string[]) {
  const list: Photo[] = dates.map((date) => ({
    date,
    blob: new Blob([date]),
    capturedAt: 1,
    width: 720,
    height: 1280,
  }));
  vi.mocked(listPhotos).mockResolvedValue(list);
}

const btn = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

beforeEach(() => {
  vi.mocked(savePhoto).mockResolvedValue('ok');
  // 기본값은 「아직 한 장도 없음」 — 첫 촬영이 기본 상태다.
  vi.mocked(listPhotos).mockResolvedValue([]);
  // jsdom에는 없다. 만든 URL을 도로 놓아주는지(revoke)가 이 화면의 누수 검증점이다.
  URL.createObjectURL = vi.fn(() => 'blob:ghost');
  URL.revokeObjectURL = vi.fn();
});

describe('촬영 화면 — 카메라 실패 세 갈래', () => {
  it('카메라가 없는 웹뷰는 「쓸 수 없어요」다', async () => {
    setup({ media: undefined });
    expect(await screen.findByText('이 환경에서는 카메라를 쓸 수 없어요')).toBeTruthy();
  });

  it('권한 거부는 「설정에서 허용해 주세요」다 — 심사자가 가장 먼저 눌러 보는 경로', async () => {
    // 「잠시 후 다시 시도」로 뭉개면 사용자가 영영 안 되는 재시도만 반복한다.
    setup({ media: { getUserMedia: DENIED } });
    expect(await screen.findByText('카메라 권한이 꺼져 있어요. 토스 앱 설정에서 허용해 주세요')).toBeTruthy();
  });

  it('무응답(타임아웃)은 「잠시 후 다시 시도」다', async () => {
    vi.useFakeTimers();
    // 토스 웹뷰가 권한 프롬프트를 삼켜 영영 pending인 실패 모드가 실제로 있다.
    setup({ media: { getUserMedia: () => new Promise<MediaStream>(() => {}) } });

    await vi.advanceTimersByTimeAsync(10000);
    vi.useRealTimers();

    expect(await screen.findByText('카메라를 여는 데 실패했어요. 잠시 후 다시 시도해 주세요')).toBeTruthy();
  });

  it('어느 실패든 원문을 작은 글씨로 병기한다 — 문의 대응의 유일한 단서', async () => {
    setup({ media: { getUserMedia: DENIED } });
    expect(await screen.findByText(/NotAllowedError: Permission denied/)).toBeTruthy();
  });

  it('실패해도 닫기로 멀쩡히 돌아간다 — 앱이 죽지 않는다', async () => {
    const { onClose } = setup({ media: undefined });
    // ⚠️ 안내가 뜬 **뒤에** 눌러야 한다 — 「켜는 중」 화면의 버튼을 잡으면 그 노드는
    // 리렌더에서 떨어져 나가 클릭이 아무 데도 안 닿는다(초록으로 보이는 공허한 클릭).
    await screen.findByText('이 환경에서는 카메라를 쓸 수 없어요');

    fireEvent.click(screen.getByRole('button', { name: '닫기' }));

    expect(onClose).toHaveBeenCalled();
  });
});

describe('촬영 화면 — 첫 촬영(사진 0장)', () => {
  it('실루엣 가이드를 그리고 고스트는 없다', async () => {
    const { container } = setup();

    expect(await screen.findByRole('img', { name: '실루엣 가이드' })).toBeTruthy();
    // 겹칠 기준 사진이 아직 없다. 빈 고스트를 그리면 화면만 어두워진다.
    expect(screen.queryByAltText('기준 사진')).toBeNull();
    expect(container.querySelector('[data-grid]')).toBeTruthy();
  });

  it('이 구도가 기준이 된다고 미리 알린다', async () => {
    setup();
    expect(await screen.findByText(/이 구도가 기준이 됩니다/)).toBeTruthy();
  });

  it('사진이 이 기기를 안 떠난다고 화면에 적는다 — 심사·사용자에게 같은 문장', async () => {
    setup();
    expect(await screen.findByText('사진은 이 기기에만 저장되며 어디로도 전송되지 않습니다.')).toBeTruthy();
  });
});

describe('촬영 화면 — 고스트(사진 1장 이상)', () => {
  it('가장 오래된 사진이 고스트다 — 직전 사진이면 어긋남이 누적된다', async () => {
    // 셋 중 **첫 장**이어야 한다. 최신(마지막)을 겹치면 하루 1~2px의 어긋남이 누적돼
    // 한 달 뒤 구도가 처음과 딴판이 된다(복사기의 복사본을 다시 복사하는 문제).
    seed(['2025-01-05', '2025-02-01', '2025-03-02']);
    setup();

    const ghost = (await screen.findByAltText('기준 사진')) as HTMLImageElement;
    expect(ghost.src).toBe('blob:ghost');
    const [blob] = vi.mocked(URL.createObjectURL).mock.calls[0] as [Blob];
    expect(await blob.text()).toBe('2025-01-05');
  });

  it('사진이 있으면 실루엣은 안 그린다 — 고스트가 그 일을 더 잘한다', async () => {
    seed(['2025-01-05']);
    setup();

    await screen.findByAltText('기준 사진');
    expect(screen.queryByRole('img', { name: '실루엣 가이드' })).toBeNull();
  });

  it('토글로 잠깐 끌 수 있다 — 정렬 중에 내 몸이 안 보이는 순간이 있다', async () => {
    seed(['2025-01-05']);
    setup();

    fireEvent.click(await screen.findByRole('button', { name: '고스트 끄기' }));

    expect(screen.queryByAltText('기준 사진')).toBeNull();
    expect(btn('고스트 켜기')).toBeTruthy();
  });

  it('닫으면 고스트 blob URL을 놓아준다 — 안 놓으면 조용히 메모리만 자란다', async () => {
    seed(['2025-01-05']);
    const { unmount } = setup();
    await screen.findByAltText('기준 사진');

    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:ghost');
  });
});

describe('촬영 화면 — 카메라 수명', () => {
  it('프리뷰는 거울상이다 — 저장본도 같은 방향이라야 고스트가 맞는다', async () => {
    const { container } = setup();
    await screen.findByRole('button', { name: '촬영' });

    expect(container.querySelector('video')!.style.transform).toBe('scaleX(-1)');
  });

  it('화면을 닫으면 카메라가 꺼진다', async () => {
    const { stream, stop } = fakeStream();
    const { unmount } = setup({ media: { getUserMedia: OK(stream) } });
    await screen.findByRole('button', { name: '촬영' });

    unmount();

    // 안 끄면 촬영 화면을 나온 뒤에도 **카메라가 켜진 채로 남는다.**
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('열리기 전에 닫아도 뒤늦게 온 스트림을 꺼서 놓아준다', async () => {
    const { stream, stop } = fakeStream();
    let allow!: (s: MediaStream) => void;
    const { unmount } = setup({ media: { getUserMedia: () => new Promise<MediaStream>((r) => (allow = r)) } });

    unmount();
    allow(stream);
    await waitFor(() => expect(stop).toHaveBeenCalledTimes(1));
  });
});

describe('촬영 화면 — 3초 타이머', () => {
  it('카운트다운을 3·2·1로 보여준 뒤 찍는다 — 전신 촬영의 유일한 경로다', async () => {
    // 폰을 세우고 물러서면 버튼에 손이 안 닿는다. 타이머는 장식이 아니다.
    const { capture } = setup();
    await screen.findByRole('button', { name: '3초 후 촬영' });

    vi.useFakeTimers();
    fireEvent.click(btn('3초 후 촬영'));
    expect(screen.getByText('3')).toBeTruthy();

    await vi.advanceTimersByTimeAsync(1000);
    expect(screen.getByText('2')).toBeTruthy();
    await vi.advanceTimersByTimeAsync(1000);
    expect(screen.getByText('1')).toBeTruthy();
    expect(capture).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    vi.useRealTimers();

    expect(capture).toHaveBeenCalledTimes(1);
  });

  it('즉시 촬영은 기다리지 않는다', async () => {
    const { capture } = setup();
    fireEvent.click(await screen.findByRole('button', { name: '촬영' }));

    await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
  });
});

describe('촬영 화면 — 확인과 저장', () => {
  async function shoot(over: Partial<Parameters<typeof BodyPhoto>[0]> = {}) {
    const r = setup(over);
    fireEvent.click(await screen.findByRole('button', { name: '촬영' }));
    await screen.findByRole('button', { name: '저장' });
    return r;
  }

  it('찍은 사진을 보여주고 저장/다시 찍기를 묻는다', async () => {
    await shoot();
    expect(screen.getByAltText('방금 찍은 사진')).toBeTruthy();
    expect(btn('다시 찍기')).toBeTruthy();
  });

  it('다시 찍기를 누르면 프리뷰로 돌아간다', async () => {
    await shoot();
    fireEvent.click(btn('다시 찍기'));

    expect(btn('촬영')).toBeTruthy();
    expect(screen.queryByAltText('방금 찍은 사진')).toBeNull();
  });

  it('다시 찍기 뒤에도 프리뷰에 스트림이 붙어 있다 — 안 붙이면 까만 화면이다', async () => {
    // 확인 화면으로 갈 때 `<video>`가 통째로 사라졌다가 새 노드로 돌아온다 —
    // 스트림을 처음 한 번만 붙이면 **돌아온 프리뷰는 영영 까맣다.** 사용자는 카메라가
    // 고장 난 줄 알고, 다시 찍기는 사실상 못 쓰는 버튼이 된다.
    const { stream } = fakeStream();
    const { container } = await shoot({ media: { getUserMedia: OK(stream) } });

    fireEvent.click(btn('다시 찍기'));

    await waitFor(() => expect(container.querySelector('video')!.srcObject).toBe(stream));
  });

  it('저장하면 오늘 날짜로 넣고 화면을 닫는다', async () => {
    const { onClose } = await shoot();

    fireEvent.click(btn('저장'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [, saved] = vi.mocked(savePhoto).mock.calls[0];
    // 날짜가 키다 — 같은 날 다시 찍으면 교체된다. 캡처가 준 치수를 그대로 들고 간다.
    expect(saved.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect({ w: saved.width, h: saved.height }).toEqual({ w: 720, h: 1280 });
    expect(saved.blob).toBe(shot.blob);
  });

  it('쿼터 초과는 「공간이 부족해요」다 — 화면은 안 닫힌다', async () => {
    vi.mocked(savePhoto).mockResolvedValue('quota');
    const { onClose } = await shoot();

    fireEvent.click(btn('저장'));

    expect(await screen.findByText('공간이 부족해요 — 오래된 사진을 지워 주세요')).toBeTruthy();
    // 닫아 버리면 방금 찍은 사진이 그대로 증발한다. 다시 시도할 기회를 남긴다.
    expect(onClose).not.toHaveBeenCalled();
  });

  it('그 밖의 실패는 「다시 시도해 주세요」다 — 쿼터와 문구가 갈린다', async () => {
    // 공간이 멀쩡한 사람에게 사진을 지우라고 시키면 그건 우리 잘못을 사용자에게 떠넘기는 것이다.
    vi.mocked(savePhoto).mockResolvedValue('fail');
    await shoot();

    fireEvent.click(btn('저장'));

    expect(await screen.findByText('저장하지 못했어요. 다시 시도해 주세요')).toBeTruthy();
    expect(screen.queryByText('공간이 부족해요 — 오래된 사진을 지워 주세요')).toBeNull();
  });

  it('캡처가 실패하면 확인 화면으로 안 넘어가고 안내한다', async () => {
    // 2D 컨텍스트가 없거나 프레임이 아직 0×0인 경우다. 빈 사진을 저장하는 것보다 낫다.
    setup({ capture: vi.fn(async () => null) });
    fireEvent.click(await screen.findByRole('button', { name: '촬영' }));

    expect(await screen.findByText('사진을 찍지 못했어요. 다시 시도해 주세요')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '저장' })).toBeNull();
  });

  it('닫으면 방금 찍은 사진의 blob URL도 놓아준다', async () => {
    const { unmount } = await shoot();
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
});

describe('촬영 화면 — 저장할 수 없는 환경', () => {
  it('IDB가 없으면 찍기 전에 알린다 — 찍고 나서 못 넣는 것보다 낫다', async () => {
    // 프라이빗 모드·구형 웹뷰. 여기서 앱이 죽지 않고 사진 기능만 접힌다.
    setup({ idb: undefined });

    expect(await screen.findByText('이 기기에서는 사진을 저장할 수 없어요')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '촬영' })).toBeNull();
  });
});
