// @vitest-environment jsdom
// ⚠️ 전역으로 켜면 shareLinks 테스트가 죽는다 — 이유는 `screens/Onboarding.test.tsx` 머리말 참조.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { listPhotos, type BodyPhoto as Photo, type PhotoDb } from './photoStore';
import { saveGoal } from './storage';

/**
 * 화면 **배선**만 잰다. 각 화면이 무엇을 그리는지는 그 화면의 테스트가 이미 잰다 —
 * 여기서 잠그는 것은 **어느 버튼이 어느 화면을 여는가** 하나다.
 *
 * ⚠️ **이 파일이 없으면 배선은 무보증이다**(리뷰 실측). `onComparePhotos`를 촬영 화면에,
 * `onBodyPhoto`를 비교 화면에 잘못 이어도 **화면 테스트가 전부 초록이고 `tsc`도 안 걸린다**
 * (둘 다 `() => void`라 타입이 같다). 눈바디 PR C에서 진입점이 주제였는데 그 연결만
 * 아무도 안 보고 있었다.
 */
vi.mock('./photoStore', async (orig) => ({
  ...(await orig<typeof import('./photoStore')>()),
  // jsdom에는 IndexedDB가 없다. 기록 탭 카드가 「사진이 있는」 상태여야 비교 버튼이 뜬다.
  openPhotoDb: vi.fn(async () => ({ close() {} }) as unknown as PhotoDb),
  listPhotos: vi.fn(),
}));

/**
 * 운동 화면은 **스텁**이다. 완료 화면의 버튼과 저장 순서는 `screens/Workout.test.tsx`가
 * 이미 잰다 — 여기서 세션을 처음부터 끝까지 몰고 갈 이유가 없다. App이 넘긴 콜백이
 * 어디로 이어지는지만 본다.
 */
vi.mock('./screens/Workout', () => ({
  Workout: (p: { onFinish: (r: null) => void; onBodyPhoto: () => void }) => (
    <button
      onClick={() => {
        p.onFinish(null);
        p.onBodyPhoto();
      }}
    >
      완료-눈바디
    </button>
  ),
}));

afterEach(cleanup);

const photo = (date: string): Photo => ({ date, blob: new Blob([date]), capturedAt: 1, width: 720, height: 1280 });

const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  // 목적이 비어 있으면 온보딩이 앞을 막는다 — 배선을 보려면 그 뒤로 들어가야 한다.
  saveGoal('health');
  vi.mocked(listPhotos).mockResolvedValue([photo('2026-08-20')]);
  URL.createObjectURL = vi.fn(() => 'blob:thumb');
  URL.revokeObjectURL = vi.fn();
});

/** 카메라가 없는 환경이라 촬영 화면은 이 안내로 뜬다 — 「촬영 화면이 열렸다」의 관측점이다. */
const SHOOT = '이 환경에서는 카메라를 쓸 수 없어요';
const COMPARE = '눈바디 비교';

describe('App — 눈바디 진입 배선', () => {
  it('기록 탭에는 촬영 입구가 없다 — 완료 화면이 유일한 문이다', async () => {
    render(<App />);
    click('기록');

    // 사진이 있는 상태로 열어도(비교 로우가 뜨는 상태) 촬영으로 가는 버튼은 없다.
    await screen.findByRole('button', { name: '비교' });
    expect(screen.queryByRole('button', { name: '오늘 찍기' })).toBeNull();
    expect(screen.queryByText(SHOOT)).toBeNull();
  });

  it('기록 탭의 비교는 비교 화면을 연다', async () => {
    render(<App />);
    click('기록');

    fireEvent.click(await screen.findByRole('button', { name: '비교' }));

    expect(await screen.findByText(COMPARE)).toBeTruthy();
    expect(screen.queryByText(SHOOT)).toBeNull();
  });

  it('완료 화면의 눈바디는 촬영 화면을 연다 — 비교가 아니다', async () => {
    render(<App />);
    click('운동 시작');

    click('완료-눈바디');

    expect(await screen.findByText(SHOOT)).toBeTruthy();
    expect(screen.queryByText(COMPARE)).toBeNull();
  });
});

/**
 * 설정 두 페이지의 배선. 입구가 자리마다 나뉜 개편이라 **어느 입구가 어느 페이지를 여는가**가
 * 곧 개편의 내용이다 — 두 콜백이 타입까지 같아서(`() => void`) 뒤바꿔도 화면 테스트와
 * `tsc`가 전부 초록이다. 그 스왑을 잡는 것은 이 파일뿐이다.
 */
describe('App — 설정 진입 배선', () => {
  const heading = (name: string) => screen.queryByRole('heading', { name });

  it('홈의 목적 칩은 운동 목적 페이지를 연다', () => {
    render(<App />);
    click('목적 · 건강 유지 ›');

    expect(heading('운동 목적')).toBeTruthy();
    expect(heading('보유 기구')).toBeNull();
  });

  it('기구 탭의 바꾸기는 보유 기구 페이지를 연다', () => {
    render(<App />);
    click('기구');
    click('바꾸기');

    expect(heading('보유 기구')).toBeTruthy();
    expect(heading('운동 목적')).toBeNull();
  });

  it('기구 탭에서 열고 닫으면 기구 탭으로 돌아온다 — 홈이 아니다', () => {
    // 닫기가 홈으로 뱉으면 기구를 고치러 들어간 사람이 매번 탭을 다시 찾아야 한다.
    render(<App />);
    click('기구');
    click('바꾸기');
    click('닫기');

    expect(heading('기구 추천')).toBeTruthy();
    expect(heading('보유 기구')).toBeNull();
  });
});
