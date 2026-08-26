import type { CSSProperties } from 'react';

/**
 * 화면 네 개가 나눠 쓰는 스타일.
 *
 * 색·간격은 `index.css`의 CSS 변수를 참조한다 — 값을 여기에 직접 박으면
 * 화면마다 미묘하게 달라진다.
 */

/**
 * 운동 이미지 출처. **번들에 넣지 않는다** — 900장이라 번들이 수십 MB가 된다.
 *
 * ⚠️ 미니앱 CSP가 외부 이미지를 막을 수 있다. 실기기에서 확인 전까지는
 * 이미지가 안 떠도 화면이 멀쩡히 돌아가야 한다(`ExerciseImage`가 조용히 대체 표시).
 */
export const IMAGE_BASE = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/';

type S = Record<string, CSSProperties>;

export const ui: S = {
  // ── 레이아웃
  page: { padding: '16px 20px calc(var(--tab-h) + var(--tab-gap) + var(--safe-b) + 24px)', minHeight: '100vh' },
  pageFull: { padding: '16px 20px calc(var(--safe-b) + 24px)', minHeight: '100vh', display: 'flex', flexDirection: 'column' },
  h1: { fontSize: 22, fontWeight: 700, margin: '4px 0 20px' },
  h2: { fontSize: 17, fontWeight: 700, margin: '0 0 4px' },
  sub: { fontSize: 13, color: 'var(--text-sub)', margin: '0 0 16px' },
  card: { background: 'var(--bg-sub)', border: '1px solid var(--line)', borderRadius: 14, padding: 16 },
  row: { display: 'flex', gap: 8 },
  spacer: { flex: 1 },

  // ── 버튼
  primary: {
    width: '100%',
    padding: '15px 12px',
    fontSize: 16,
    fontWeight: 700,
    color: '#fff',
    background: 'var(--blue)',
    border: 0,
    borderRadius: 12,
  },
  secondary: {
    width: '100%',
    padding: '13px 12px',
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text-sub)',
    background: 'var(--bg-sub)',
    border: '1px solid var(--line)',
    borderRadius: 12,
  },
  ghost: {
    padding: '10px 12px',
    fontSize: 14,
    color: 'var(--text-weak)',
    background: 'none',
    border: 0,
    borderRadius: 8,
  },
  disabled: { background: 'var(--line-strong)', color: '#fff' },

  // ── 입력
  input: {
    width: '100%',
    padding: '13px 14px',
    fontSize: 17,
    fontWeight: 600,
    textAlign: 'center',
    color: 'var(--text)',
    background: '#fff',
    border: '1px solid var(--line-strong)',
    borderRadius: 12,
  },
  label: { fontSize: 12, color: 'var(--text-sub)', display: 'block', marginBottom: 6 },

  // ── 조각
  chip: {
    padding: '5px 10px',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-sub)',
    background: 'var(--bg-sub)',
    border: '1px solid var(--line)',
    borderRadius: 999,
  },
  empty: { padding: '48px 20px', textAlign: 'center', color: 'var(--text-weak)', fontSize: 14 },
};

/** 선택 상태의 기구 카드. */
export const pickStyle = (on: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  padding: '14px 16px',
  fontSize: 15,
  fontWeight: 600,
  textAlign: 'left',
  color: on ? 'var(--blue-dark)' : 'var(--text)',
  background: on ? '#eff6ff' : 'var(--bg-sub)',
  border: `1px solid ${on ? 'var(--blue)' : 'var(--line)'}`,
  borderRadius: 12,
});

/** 선택 상태의 목적 카드. 기구 카드보다 크고 테두리가 두껍다 — 하나만 고르는 자리다. */
export const goalStyle = (on: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  width: '100%',
  padding: 16,
  textAlign: 'left',
  background: on ? '#eff6ff' : 'var(--bg-sub)',
  border: `${on ? 2 : 1}px solid ${on ? 'var(--blue)' : 'var(--line)'}`,
  borderRadius: 14,
});

/** 기구 상세용 작은 칩. 한 줄에 여러 개가 들어가야 해서 `pickStyle`보다 작다. */
export const specChipStyle = (on: boolean): CSSProperties => ({
  padding: '7px 11px',
  fontSize: 13,
  fontWeight: 600,
  color: on ? 'var(--blue-dark)' : 'var(--text-sub)',
  background: on ? '#eff6ff' : '#fff',
  border: `1px solid ${on ? 'var(--blue)' : 'var(--line)'}`,
  borderRadius: 999,
});

/** 초 → `M:SS`. */
export function mmss(sec: number): string {
  const m = Math.floor(sec / 60);
  return `${m}:${String(sec - m * 60).padStart(2, '0')}`;
}
