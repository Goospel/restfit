/**
 * 휴식 마지막 10초 준비 신호의 **판정 전부**(설계 §3.1).
 *
 * 소리(`restSound.ts`)도 화면(`Workout.tsx`)도 여기서 나온 값만 쓴다 — 판정이 두 곳으로
 * 갈라지면 「소리는 났는데 화면은 아직」이 나온다. 순수 함수라 jsdom 없이 테스트한다.
 */

export type Cue = 'warn' | 'tick' | 'go';

/** 준비 신호가 시작되는 남은 초. 이 경계를 **내려올 때** 한 번 warn이 난다. */
const WARN_AT = 10;

/** 시동 카운트다운. 각 초에 **새로 닿을 때** tick이 난다. */
const TICK_AT = [3, 2, 1];

/**
 * 타이머 숫자를 흰색으로 뒤집는 문턱. 72px bold라 WCAG large-text(3:1)가 적용되고,
 * 이 값이 그 문턱을 정확히 지킨다 — 4초에서 흰색 3.20:1, 5초에서 검정 6.35:1.
 */
const INVERT_AT = 4;

/**
 * 「다음 세트 준비」 문구가 흰색으로 뒤집는 문턱. **타이머보다 늦다** — 15px bold는
 * large-text(18.66px bold) 미만이라 본문 기준 4.5:1을 받아야 하고, 흰색은 3초에서
 * 3.89:1로 못 넘긴다. 3초에서 흰색 대신 아래 진홍이 4.73:1로 받는다.
 */
const PHRASE_INVERT_AT = 2;

/**
 * 문구의 비반전 색. ⚠️ **램프 종점(`BG_WARN`)과 같은 색을 쓰면 배경이 짙어질수록 녹는다** —
 * 그게 실제로 났다(최저 2.50:1). 대비는 눈이 아니라 `restCue.test.ts`가 전 구간을 돌며 잰다.
 */
const PHRASE_DARK = '#22050a';

/** `--text`(#14110d)의 실값. 배경이 리터럴 rgb라 글자도 같은 축으로 둬야 대비를 계산할 수 있다. */
const TEXT_DARK = '#14110d';

/** `--bg-sub`(#f2eee7)의 실값. ⚠️ index.css의 `--bg-sub`를 바꾸면 **여기도** 바꾼다 — CSS 변수는 보간할 수 없다. */
const BG_BASE = [242, 238, 231] as const;

/** 다 물든 진홍. */
const BG_WARN = [183, 28, 48] as const;

/**
 * 직전 틱의 남은 초 → 이번 틱의 남은 초로 건너올 때 낼 신호. 없으면 null.
 *
 * ⚠️ 한 틱에 여러 경계를 건넜으면(백그라운드 복귀: 12→0) **하나만** 낸다(결정 6) —
 * 우선순위 go > tick > warn. 몰아서 내면 복귀 순간에 소리가 폭발한다.
 *
 * ⚠️ `prevLeft === left`면 항상 null. 시계는 250ms마다 도는데 남은 초는 1초에 한 번만
 * 바뀌므로, 이 가드가 없으면 같은 신호가 초당 네 번 울린다.
 */
export function cueAt(prevLeft: number, left: number): Cue | null {
  if (prevLeft <= left) return null; // 같은 초 반복 · 다음 휴식 시작(상승)
  if (left === 0) return 'go';
  if (TICK_AT.includes(left)) return 'tick';
  if (prevLeft > WARN_AT && left <= WARN_AT) return 'warn';
  return null;
}

/** 붉어짐 진행도 0~1. `left >= 10`이면 0, 0초면 1. */
export function warnProgress(left: number): number {
  return Math.min(1, Math.max(0, (WARN_AT - left) / WARN_AT));
}

/**
 * V1 색 **전부**. 배경이 연속으로 변하는 화면이라 글자색을 화면 쪽에서 따로 고르면
 * 램프 중간 어딘가에서만 대비가 무너진다 — 그래서 배경과 글자를 같은 함수가 함께 돌려준다.
 */
export function warnColors(left: number): { bg: string; inverted: boolean; text: string; phrase: string } {
  const t = warnProgress(left);
  const [r, g, b] = BG_BASE.map((from, i) => Math.round(from + (BG_WARN[i] - from) * t));
  const inverted = left <= INVERT_AT;
  return {
    bg: `rgb(${r}, ${g}, ${b})`,
    inverted,
    text: inverted ? '#ffffff' : TEXT_DARK,
    phrase: left <= PHRASE_INVERT_AT ? '#ffffff' : PHRASE_DARK,
  };
}
