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

/** 글자를 흰색으로 뒤집는 문턱. 배경이 이만큼 어두워진 뒤라야 검정이 안 읽힌다. */
const INVERT_AT = 4;

/** `--bg-sub`(#f9fafb)의 실값. ⚠️ index.css의 `--bg-sub`를 바꾸면 **여기도** 바꾼다 — CSS 변수는 보간할 수 없다. */
const BG_BASE = [249, 250, 251] as const;

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

/** V1 색. 배경 rgb 문자열과 「글자 흰색 전환」 여부를 **한 곳에서** 정한다. */
export function warnColors(left: number): { bg: string; inverted: boolean } {
  const t = warnProgress(left);
  const [r, g, b] = BG_BASE.map((from, i) => Math.round(from + (BG_WARN[i] - from) * t));
  return { bg: `rgb(${r}, ${g}, ${b})`, inverted: left <= INVERT_AT };
}
