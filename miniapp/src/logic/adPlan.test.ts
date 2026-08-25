import { describe, expect, it } from 'vitest';

import { adPlan, MIN_REST_SECONDS } from './adPlan';

/** 정상 상태 — 미충전 이력 없음. */
const fresh = { noFillStreak: 0, slotsSinceLastTry: 0 };

describe('adPlan', () => {
  it('충분히 긴 휴식이면 튼다', () => {
    expect(adPlan(60, fresh)).toEqual({ show: true, reason: 'ok' });
  });

  it('휴식이 40초보다 짧으면 안 튼다', () => {
    // 규율이 곧 수익 구조다 — 광고가 휴식보다 길면 이탈하고, 그러면 노출 밀도 자체가 사라진다.
    expect(adPlan(39, fresh)).toEqual({ show: false, reason: 'restTooShort' });
  });

  it('휴식이 정확히 40초면 튼다', () => {
    expect(MIN_REST_SECONDS).toBe(40);
    expect(adPlan(40, fresh).show).toBe(true);
  });

  it('휴식이 0이거나 음수여도 크래시하지 않고 안 튼다', () => {
    expect(adPlan(0, fresh).show).toBe(false);
    expect(adPlan(-10, fresh).show).toBe(false);
  });

  it('직전이 미충전이면 다음 슬롯은 건너뛴다', () => {
    expect(adPlan(90, { noFillStreak: 1, slotsSinceLastTry: 0 })).toEqual({ show: false, reason: 'backoff' });
  });

  it('한 슬롯 쉬었으면 다시 시도한다', () => {
    expect(adPlan(90, { noFillStreak: 1, slotsSinceLastTry: 1 })).toEqual({ show: true, reason: 'ok' });
  });

  it('연속 미충전이 쌓이면 쉬는 슬롯도 늘어난다', () => {
    // 2회 연속 미충전이면 2슬롯을 쉰다. 광고 서버를 계속 두드려봐야 소용없다.
    expect(adPlan(90, { noFillStreak: 2, slotsSinceLastTry: 1 }).show).toBe(false);
    expect(adPlan(90, { noFillStreak: 2, slotsSinceLastTry: 2 }).show).toBe(true);
  });

  it('3회 연속 미충전이면 남은 세션은 포기한다', () => {
    // frequency cap에 걸린 상태. 사용자에게 광고 실패를 보이지 않고 타이머만 돌린다.
    expect(adPlan(90, { noFillStreak: 3, slotsSinceLastTry: 99 })).toEqual({ show: false, reason: 'givenUp' });
  });

  it('포기한 뒤에도 짧은 휴식 판정이 우선한다', () => {
    // 이유가 뒤섞이면 로그를 못 믿는다. 휴식 길이가 가장 바깥 규칙이다.
    expect(adPlan(10, { noFillStreak: 5, slotsSinceLastTry: 0 }).reason).toBe('restTooShort');
  });

  it('입력을 바꾸지 않는다', () => {
    const state = { noFillStreak: 1, slotsSinceLastTry: 0 };
    adPlan(90, state);
    expect(state).toEqual({ noFillStreak: 1, slotsSinceLastTry: 0 });
  });
});
