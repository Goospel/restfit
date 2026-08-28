import { describe, expect, it, vi } from 'vitest';

import { probeCamera } from './cameraProbe';

/**
 * 눈바디 사진의 이상적 UX(라이브 프리뷰 위에 이전 사진을 겹치기)는 **토스 웹뷰가
 * `getUserMedia`를 허용하는가**에 통째로 달려 있는데 문서로는 확답이 없다. 그래서 실기기에
 * 찔러 볼 프로브를 먼저 넣는다 — 여기서 잠그는 것은 그 프로브의 **실패 모드**다.
 *
 * 셋이 다 다른 답을 요구한다: mediaDevices가 아예 없는 웹뷰 · 권한 거절 · 프롬프트를
 * 삼켜 영영 pending. 마지막 것이 특히 고약해서, 늦게 도착한 stream을 안 끄면 **카메라가
 * 켜진 채로 남는다.**
 */
describe('probeCamera', () => {
  /** 트랙 하나짜리 가짜 스트림. `stop`이 불렸는지가 누수 검증의 유일한 관측점이다. */
  function fakeStream() {
    const stop = vi.fn();
    return { stream: { getTracks: () => [{ stop }] } as unknown as MediaStream, stop };
  }

  const md = (getUserMedia: (c: MediaStreamConstraints) => Promise<MediaStream>) => ({ getUserMedia });

  it('mediaDevices가 없는 웹뷰는 unsupported로 끝난다', async () => {
    // 「거절」과 구별돼야 한다 — 권한 문제가 아니라 API 자체가 없다는 뜻이라 대책이 다르다.
    await expect(probeCamera(undefined, { timeoutMs: 1000 })).resolves.toEqual({ ok: false, detail: 'unsupported' });
  });

  it('허용되면 스트림을 그대로 돌려준다', async () => {
    const { stream } = fakeStream();
    await expect(probeCamera(md(async () => stream), { timeoutMs: 1000 })).resolves.toEqual({ ok: true, stream });
  });

  it('거절되면 에러 이름과 메시지를 원문 그대로 담는다', async () => {
    // 실기기 화면에서 이 문자열을 **눈으로 읽는 것**이 프로브의 목적이다. 「실패했습니다」로
    // 뭉개면 NotAllowedError(권한)와 NotFoundError(카메라 없음)를 구별할 수단이 사라진다.
    const err = Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });
    await expect(probeCamera(md(async () => { throw err; }), { timeoutMs: 1000 })).resolves.toEqual({
      ok: false,
      detail: 'NotAllowedError: Permission denied',
    });
  });

  it('응답이 없으면 타임아웃으로 끝난다', async () => {
    vi.useFakeTimers();
    const p = probeCamera(md(() => new Promise<MediaStream>(() => {})), { timeoutMs: 10000 });

    await vi.advanceTimersByTimeAsync(10000);

    await expect(p).resolves.toEqual({ ok: false, detail: 'timeout' });
    vi.useRealTimers();
  });

  it('타임아웃 뒤에 도착한 스트림은 트랙을 꺼서 카메라를 놓아준다', async () => {
    // 결과는 이미 나갔으니 이 스트림을 화면에 붙일 사람이 없다. 그냥 두면 **판정이 끝난
    // 뒤에도 카메라가 켜져 있고**, 프로브를 다시 눌러도 점유가 풀리지 않는다.
    vi.useFakeTimers();
    const { stream, stop } = fakeStream();
    let allow!: (s: MediaStream) => void;
    const p = probeCamera(md(() => new Promise<MediaStream>((r) => { allow = r; })), { timeoutMs: 10000 });

    await vi.advanceTimersByTimeAsync(10000);
    expect(await p).toEqual({ ok: false, detail: 'timeout' });

    allow(stream);
    await vi.advanceTimersByTimeAsync(0);

    expect(stop).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
