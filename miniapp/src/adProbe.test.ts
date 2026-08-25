import { describe, expect, it, vi } from 'vitest';

import { awaitAdEvent } from './adProbe';

/**
 * 광고 SDK는 콜백(`onEvent`/`onError`) + 정리 함수 형태다. 이걸 Promise로 감싸는 자리에
 * 전형적인 버그가 산다 — 정리 함수 미호출, 중복 resolve, 타임아웃 누락.
 *
 * Phase 0.5 실측뿐 아니라 Phase 3 광고 통합에서도 그대로 쓸 코드라 못 박아 둔다.
 */
describe('awaitAdEvent', () => {
  /** SDK 호출을 흉내 낸다 — 핸들러를 붙잡아 뒀다가 테스트가 원할 때 발화시킨다. */
  function fakeSdk() {
    const cleanup = vi.fn();
    let handlers: { onEvent: (e: { type: string }) => void; onError: (e: Error) => void } | null = null;
    const call = (h: typeof handlers) => {
      handlers = h;
      return cleanup;
    };
    return {
      call: call as (h: NonNullable<typeof handlers>) => () => void,
      cleanup,
      emit: (type: string) => handlers?.onEvent({ type }),
      fail: (msg: string) => handlers?.onError(new Error(msg)),
    };
  }

  const opts = (over: Partial<Parameters<typeof awaitAdEvent>[1]> = {}) => ({
    resolveOn: ['loaded'],
    timeoutMs: 5000,
    ...over,
  });

  it('기다리던 이벤트가 오면 성공으로 끝난다', async () => {
    const sdk = fakeSdk();
    const p = awaitAdEvent(sdk.call, opts());

    sdk.emit('loaded');

    await expect(p).resolves.toEqual({ ok: true, detail: 'loaded' });
  });

  it('관심 없는 이벤트는 무시하고 계속 기다린다', async () => {
    vi.useFakeTimers();
    const sdk = fakeSdk();
    const p = awaitAdEvent(sdk.call, opts({ resolveOn: ['impression'] }));

    sdk.emit('clicked');
    await vi.advanceTimersByTimeAsync(1000);
    sdk.emit('impression');

    await expect(p).resolves.toEqual({ ok: true, detail: 'impression' });
    vi.useRealTimers();
  });

  it('onError가 오면 실패로 끝나고 메시지를 담는다', async () => {
    const sdk = fakeSdk();
    const p = awaitAdEvent(sdk.call, opts());

    sdk.fail('no fill');

    await expect(p).resolves.toEqual({ ok: false, detail: 'no fill' });
  });

  it('시간 안에 아무것도 안 오면 타임아웃으로 실패한다', async () => {
    vi.useFakeTimers();
    const sdk = fakeSdk();
    const p = awaitAdEvent(sdk.call, opts({ timeoutMs: 3000 }));

    await vi.advanceTimersByTimeAsync(3000);

    await expect(p).resolves.toEqual({ ok: false, detail: 'timeout' });
    vi.useRealTimers();
  });

  it('끝나면 SDK 정리 함수를 반드시 호출한다', async () => {
    const sdk = fakeSdk();
    const p = awaitAdEvent(sdk.call, opts());

    sdk.emit('loaded');
    await p;

    expect(sdk.cleanup).toHaveBeenCalledTimes(1);
  });

  it('타임아웃으로 끝났을 때도 정리 함수를 호출한다', async () => {
    vi.useFakeTimers();
    const sdk = fakeSdk();
    const p = awaitAdEvent(sdk.call, opts({ timeoutMs: 1000 }));

    await vi.advanceTimersByTimeAsync(1000);
    await p;

    expect(sdk.cleanup).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('끝난 뒤 늦게 온 이벤트는 결과를 바꾸지 못한다', async () => {
    const sdk = fakeSdk();
    const p = awaitAdEvent(sdk.call, opts());

    sdk.emit('loaded');
    const first = await p;
    sdk.fail('늦게 온 에러');

    // 같은 Promise를 다시 await 해도 첫 결과 그대로다
    await expect(p).resolves.toEqual(first);
    expect(sdk.cleanup).toHaveBeenCalledTimes(1);
  });

  it('SDK가 콜백을 동기로 발화해도 정리 함수를 놓치지 않는다', async () => {
    // 정리 함수가 변수에 할당되기 **전에** 끝나는 경우다. 순진하게 짜면 여기서 정리가 통째로 새고,
    // 광고를 반복 요청하는 이 앱에서는 그 누수가 그대로 쌓인다.
    const cleanup = vi.fn();
    const p = awaitAdEvent((h) => {
      h.onEvent({ type: 'loaded' });
      return cleanup;
    }, opts());

    await expect(p).resolves.toEqual({ ok: true, detail: 'loaded' });
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('SDK 호출 자체가 던져도 실패로 끝난다', async () => {
    const p = awaitAdEvent(
      () => {
        throw new Error('SDK 미지원');
      },
      opts(),
    );

    await expect(p).resolves.toEqual({ ok: false, detail: 'SDK 미지원' });
  });
});
