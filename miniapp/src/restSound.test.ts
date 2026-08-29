import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { NOTES, playCue } from './restSound';

/**
 * S1 음표는 **순수 데이터**다 — 웹 오디오 없이 읽을 수 있고, 그래서 잠글 수 있다.
 * 재생 자체(웹 오디오)는 jsdom에 없어서 테스트하지 않는다(설계 §3.4).
 */
describe('S1 음표', () => {
  it('웹 오디오가 없는 환경에서도 import 된다 — 모듈 최상위에 부수효과가 없다', () => {
    // AudioContext를 모듈 로드 시점에 만들면 구형 웹뷰에서 **앱 전체가** 안 뜬다.
    // 이 파일이 jsdom 없이(= `window` 없이) 도는 것 자체가 그 단언이다.
    expect(typeof window).toBe('undefined');
    expect(Object.keys(NOTES)).toEqual(['warn', 'tick', 'go']);
  });

  it('세 신호가 서로 다른 소리다 — 값은 [주파수, 시작 지연, 길이, 게인]', () => {
    // ★ 「소리가 난다」만 보면 go에 warn 음표를 넣어도 초록이다(리뷰가 심어 실측).
    //   미리 알림(딩–동)과 시작음이 같은 소리면 −10초에 세트를 시작하는 사람이 생긴다.
    expect(NOTES.warn).toEqual([
      [880, 0, 0.16, 0.16],
      [660, 0.18, 0.22, 0.16],
    ]);
    expect(NOTES.tick).toEqual([[1046, 0, 0.07, 0.14]]);
    expect(NOTES.go).toEqual([
      [1318, 0, 0.1, 0.18],
      [1318, 0.14, 0.18, 0.18],
    ]);
  });

  it('게인은 0.2를 안 넘는다 — 조용한 방에서 도는 앱이다', () => {
    for (const notes of Object.values(NOTES)) for (const [, , , gain] of notes) expect(gain).toBeLessThanOrEqual(0.2);
  });
});

/**
 * 표를 잠그는 것만으로는 **표를 안 쓰는 구현**을 못 잡는다 — `playCue` 본문을 통째로 비워도
 * 위 단언은 전부 초록이고, 앱은 소리 없이 조용히 돈다(리뷰가 심어 실측). 그래서 최소 스피커를
 * 물려 「무엇이 울렸나」를 본다. 웹 오디오 자체를 검증하는 게 아니라 **배선**을 본다.
 */
describe('playCue — 표를 실제로 울린다', () => {
  type Osc = { type: string; frequency: { value: number }; started: number; stopped: number; connect: () => { connect: () => void } };

  // ⚠️ AudioContext는 모듈 싱글턴이라 **처음 만든 것 하나만** 산다 — 테스트마다 새로 만들면
  //    두 번째부터 빈 배열을 보게 된다. 컨텍스트는 하나로 두고 기록만 비운다.
  const oscs: Osc[] = [];
  const peaks: number[] = [];
  const ctx = {
    currentTime: 0,
    state: 'running',
    destination: {},
    createOscillator(): Osc & { start: (t: number) => void; stop: (t: number) => void } {
      const o = {
        type: '',
        frequency: { value: 0 },
        started: -1,
        stopped: -1,
        connect: () => ({ connect: () => {} }),
        start: (t: number) => void (o.started = t),
        stop: (t: number) => void (o.stopped = t),
      };
      oscs.push(o);
      return o;
    },
    createGain: () => ({
      gain: { setValueAtTime: () => {}, linearRampToValueAtTime: (v: number) => void (v > 0 && peaks.push(v)) },
      connect: () => ({}),
    }),
  };

  beforeEach(() => {
    oscs.length = 0;
    peaks.length = 0;
    // ⚠️ 화살표 함수는 `new`로 못 부른다 — 구현이 `new C()`라 여기선 일반 함수여야 한다.
    (globalThis as { window?: unknown }).window = { AudioContext: function () { return ctx; } };
  });
  afterEach(() => delete (globalThis as { window?: unknown }).window);

  it('go는 시작음 두 방이다 — 미리 알림(딩–동)과 다른 소리여야 한다', () => {
    // ★ go에 warn 음표를 꽂아도, 본문을 통째로 비워도 「표」 단언은 전부 초록이다.
    //   −10초에 시작음이 울리면 사람이 10초 일찍 세트를 시작한다.
    playCue('go');
    expect(oscs.map((o) => o.frequency.value)).toEqual([1318, 1318]);
    expect(oscs.map((o) => o.started)).toEqual([0, 0.14]);
    expect(peaks).toEqual([0.18, 0.18]);
  });

  it('warn은 두 음이 이어진다 — 880 뒤에 660', () => {
    playCue('warn');
    expect(oscs.map((o) => o.frequency.value)).toEqual([880, 660]);
    expect(oscs.map((o) => o.started)).toEqual([0, 0.18]);
  });
});
