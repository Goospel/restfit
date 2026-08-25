export type ReturnEvent = {
  /** 돌아온 시각 (epoch ms) */
  at: number;
  /** 숨겨져 있던 시간 (ms) */
  hiddenMs: number;
};

/**
 * 외부 앱(토스쇼핑)에 다녀온 "복귀"를 센다.
 *
 * 미니앱이 백그라운드로 밀리면 `visibilitychange`가 hidden으로, 돌아오면 visible로 온다.
 * 그 왕복 한 쌍을 복귀 1건으로 본다.
 *
 * `now`를 주입받는 이유는 테스트에서 시각을 통제하기 위해서다.
 */
export function createReturnTracker(now: () => number = Date.now) {
  let hiddenAt: number | null = null;
  const events: ReturnEvent[] = [];

  return {
    onVisibilityChange(state: 'hidden' | 'visible') {
      if (state === 'hidden') {
        // 연속 hidden은 첫 번째를 유지한다 — 알고 싶은 건 실제로 숨겨져 있던 총 시간이다.
        if (hiddenAt === null) hiddenAt = now();
        return;
      }
      // 숨겨진 적 없이 온 visible은 복귀가 아니다 (최초 진입·중복 이벤트).
      if (hiddenAt === null) return;

      const at = now();
      events.push({ at, hiddenMs: at - hiddenAt });
      hiddenAt = null;
    },

    get events(): ReturnEvent[] {
      return [...events];
    },
  };
}
