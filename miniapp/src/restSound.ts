import type { Cue } from './logic/restCue';

/**
 * 준비 신호의 **스피커**(설계 §3.2). 판정은 전부 `logic/restCue.ts`에 있고 여기엔 로직이 없다.
 *
 * 음원 파일은 없다 — 합성음이라 번들이 0바이트 는다. **전 구간 조용히 실패한다**: 웹 오디오가
 * 없는 환경(구형 웹뷰·jsdom)에서도 앱은 그대로 돈다. 소리는 기능이 아니라 얹은 것이고,
 * 같은 정보를 화면이 전부 전달한다(결정 4).
 */

/** AudioContext는 하나만 만든다 — 휴식마다 새로 만들면 모바일에서 곧 상한다. */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    const C = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx ??= new C();
    // 탭이 백그라운드에 다녀오면 suspended로 남는다 — 깨우지 않으면 소리가 조용히 사라진다.
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/**
 * 오디오를 미리 연다. **사용자 제스처 직후에만 의미가 있다** — 브라우저는 탭·클릭 뒤에만
 * 오디오를 허용한다. 휴식은 항상 「세트 완료」 탭 직후라 그 자리에서 부르면 조건이 저절로 맞다.
 */
export function primeSound(): void {
  audio();
}

/** S1 음표: [주파수(Hz), 시작 지연(s), 길이(s), 게인]. */
const NOTES: Record<Cue, [number, number, number, number][]> = {
  // 미리 알림 「딩–동」. 두 음이라 기기 알림과 안 헷갈린다.
  warn: [
    [880, 0, 0.16, 0.16],
    [660, 0.18, 0.22, 0.16],
  ],
  // 시동 카운트. 짧고 작다 — 세션당 열두 번 도는 소리라 조금만 커도 시끄럽다.
  tick: [[1046, 0, 0.07, 0.14]],
  // 시작음. 두 번 울려 「지금이다」가 된다.
  go: [
    [1318, 0, 0.1, 0.18],
    [1318, 0.14, 0.18, 0.18],
  ],
};

export function playCue(cue: Cue): void {
  try {
    const ac = audio();
    if (!ac) return;
    const t0 = ac.currentTime;
    for (const [freq, at, dur, peak] of NOTES[cue]) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      // 계단으로 켜고 끄면 「틱」 하는 클릭 잡음이 붙는다 — 짧게 램프한다.
      gain.gain.setValueAtTime(0, t0 + at);
      gain.gain.linearRampToValueAtTime(peak, t0 + at + 0.01);
      gain.gain.linearRampToValueAtTime(0, t0 + at + dur);
      osc.connect(gain).connect(ac.destination);
      osc.start(t0 + at);
      osc.stop(t0 + at + dur + 0.02);
    }
  } catch {
    // 소리는 조용히 포기한다 — 화면이 같은 정보를 다 말한다.
  }
}
