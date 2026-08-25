import { describe, expect, it } from 'vitest';

import { createReturnTracker } from './returnTracker';

/**
 * 복귀 감지 로직 — 이 검증 앱의 유일한 계측기다.
 *
 * 실기기에서 "복귀 이벤트가 안 찍혔다"는 관측이 나왔을 때, 그게 **실제 복귀 실패**인지
 * **감지 로직 버그**인지 구분하지 못하면 검증 자체가 무의미해진다. 그래서 감지기를 먼저 못 박는다.
 */
describe('createReturnTracker', () => {
  /**
   * 시각을 직접 세팅하는 시계.
   * `now()` 호출 "횟수"에 기대는 시계를 쓰면 구현이 시계를 몇 번 부르는지에 테스트가 묶여
   * 리팩터만 해도 깨진다. 여기선 시각 자체를 통제한다.
   */
  function fakeClock() {
    const state = { t: 0 };
    return { at: (t: number) => (state.t = t), now: () => state.t };
  }

  it('숨겨졌다가 돌아오면 복귀 1건을 숨어 있던 시간과 함께 기록한다', () => {
    const c = fakeClock();
    const t = createReturnTracker(c.now);

    c.at(1000);
    t.onVisibilityChange('hidden');
    c.at(4500);
    t.onVisibilityChange('visible');

    expect(t.events).toEqual([{ at: 4500, hiddenMs: 3500 }]);
  });

  it('숨겨진 적 없이 visible만 오면 복귀로 세지 않는다', () => {
    const c = fakeClock();
    const t = createReturnTracker(c.now);

    c.at(2000);
    t.onVisibilityChange('visible');

    expect(t.events).toEqual([]);
  });

  it('hidden이 연속으로 와도 첫 hidden을 기준으로 숨어 있던 시간을 잰다', () => {
    // 알고 싶은 값은 "실제로 숨겨져 있던 총 시간"이다. 두 번째 hidden으로 기준을 옮기면 짧게 나온다.
    const c = fakeClock();
    const t = createReturnTracker(c.now);

    c.at(1000);
    t.onVisibilityChange('hidden');
    c.at(2000);
    t.onVisibilityChange('hidden');
    c.at(5000);
    t.onVisibilityChange('visible');

    expect(t.events).toEqual([{ at: 5000, hiddenMs: 4000 }]);
  });

  it('왕복을 두 번 하면 복귀 2건이 쌓인다', () => {
    const c = fakeClock();
    const t = createReturnTracker(c.now);

    c.at(1000);
    t.onVisibilityChange('hidden');
    c.at(2000);
    t.onVisibilityChange('visible');
    c.at(3000);
    t.onVisibilityChange('hidden');
    c.at(4500);
    t.onVisibilityChange('visible');

    expect(t.events).toEqual([
      { at: 2000, hiddenMs: 1000 },
      { at: 4500, hiddenMs: 1500 },
    ]);
  });

  it('events는 복사본이라 밖에서 밀어 넣어도 내부가 오염되지 않는다', () => {
    const c = fakeClock();
    const t = createReturnTracker(c.now);

    c.at(1000);
    t.onVisibilityChange('hidden');
    c.at(2000);
    t.onVisibilityChange('visible');
    t.events.push({ at: 9999, hiddenMs: 9999 });

    expect(t.events).toHaveLength(1);
  });
});
