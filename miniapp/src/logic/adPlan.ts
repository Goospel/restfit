/**
 * 광고를 이번 휴식에 틀지 말지. **이 앱의 심장이다.**
 *
 * 광고를 못 틀어도 앱은 정상 동작해야 한다 — 광고는 수익이지 기능이 아니다.
 * 그래서 이 함수는 절대 throw하지 않고, 판단 근거를 `reason`으로 남겨 로그로 확인할 수 있게 한다.
 */

/**
 * 앱인토스 콘솔의 광고 지면. **전면 광고 하나뿐이라 상수로 박는다.**
 *
 * ⚠️ 23일 연속 노출이 없으면 콘솔이 이 지면을 「삭제 예정」으로 넘긴다. 그때는 지면을
 * 새로 만들고 이 값을 갈아야 한다 — 코드에 남은 옛 ID로는 광고가 안 나온다.
 */
export const AD_GROUP_ID = 'ait.v2.live.f491615603f04220';

/** 이보다 짧은 휴식에는 광고를 틀지 않는다. 휴식 길이는 운동이 정하지 광고가 정하지 않는다. */
export const MIN_REST_SECONDS = 40;

/** 이만큼 연속으로 미충전이면 남은 세션을 포기한다. frequency cap은 미충전으로 나타난다. */
export const GIVE_UP_AFTER = 3;

export type AdState = {
  /** 연속 미충전 횟수. 노출에 성공하면 0으로 되돌린다. */
  noFillStreak: number;
  /** 마지막 **시도** 이후 지나간 휴식 슬롯 수. 시도할 때 0으로 되돌리고, 건너뛸 때마다 1 올린다. */
  slotsSinceLastTry: number;
};

export type AdDecision = { show: boolean; reason: 'ok' | 'restTooShort' | 'backoff' | 'givenUp' };

export function adPlan(restSeconds: number, state: AdState): AdDecision {
  // 휴식 길이가 가장 바깥 규칙이다. 다른 이유와 뒤섞이면 로그를 못 믿는다.
  if (restSeconds < MIN_REST_SECONDS) return { show: false, reason: 'restTooShort' };
  if (state.noFillStreak >= GIVE_UP_AFTER) return { show: false, reason: 'givenUp' };
  // 백오프 — 연속 미충전 n회면 n슬롯을 쉰다. 미충전이 없으면(0) 이 조건은 절대 걸리지 않는다.
  if (state.slotsSinceLastTry < state.noFillStreak) return { show: false, reason: 'backoff' };
  return { show: true, reason: 'ok' };
}

/** 한 슬롯이 어떻게 끝났는가. `skipped`는 `adPlan`이 안 튼다고 판단한 슬롯이다. */
export type AdOutcome = 'shown' | 'noFill' | 'skipped';

/**
 * 슬롯 하나가 끝난 뒤의 상태.
 *
 * ⚠️ 미충전이어도 `slotsSinceLastTry`는 **0으로 되돌린다** — 시도는 했기 때문이다.
 * 여기서 안 되돌리면 백오프가 즉시 풀려 다음 휴식에 또 광고 서버를 두드린다.
 */
export function nextAdState(state: AdState, outcome: AdOutcome): AdState {
  if (outcome === 'shown') return { noFillStreak: 0, slotsSinceLastTry: 0 };
  if (outcome === 'noFill') return { noFillStreak: state.noFillStreak + 1, slotsSinceLastTry: 0 };
  return { ...state, slotsSinceLastTry: state.slotsSinceLastTry + 1 };
}
