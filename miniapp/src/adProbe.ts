export type AdEventHandlers = {
  onEvent: (e: { type: string }) => void;
  onError: (e: Error) => void;
};

/** 앱인토스 광고 API(`loadFullScreenAd` / `showFullScreenAd`)의 공통 모양. 정리 함수를 돌려준다. */
export type AdCall = (h: AdEventHandlers) => () => void;

export type ProbeResult = {
  ok: boolean;
  /** 성공이면 이벤트 타입, 실패면 에러 메시지 또는 'timeout' */
  detail: string;
};

/**
 * 콜백 기반 광고 호출을 한 번의 Promise로 감싼다.
 *
 * 이 앱은 광고를 **반복해서** 요청하므로 누수와 중복 처리가 그대로 쌓인다. 그래서 셋을 보장한다:
 * 한 번만 끝난다 · 어떤 경로로 끝나든 정리 함수를 호출한다 · 무응답이면 타임아웃으로 끝난다.
 */
export function awaitAdEvent(call: AdCall, opts: { resolveOn: string[]; timeoutMs: number }): Promise<ProbeResult> {
  return new Promise((resolve) => {
    let done = false;
    let cleanup: (() => void) | undefined;

    const timer = setTimeout(() => finish({ ok: false, detail: 'timeout' }), opts.timeoutMs);

    function finish(result: ProbeResult) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      cleanup?.();
      resolve(result);
    }

    try {
      const c = call({
        onEvent: (e) => {
          if (opts.resolveOn.includes(e.type)) finish({ ok: true, detail: e.type });
        },
        onError: (err) => finish({ ok: false, detail: err.message }),
      });
      cleanup = c;
      // SDK가 콜백을 동기로 발화했다면 위 finish는 cleanup이 비어 있는 상태로 지나갔다. 여기서 마저 정리한다.
      if (done) c();
    } catch (err) {
      finish({ ok: false, detail: err instanceof Error ? err.message : String(err) });
    }
  });
}
