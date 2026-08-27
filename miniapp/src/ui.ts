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
  // 하단 패딩은 탭바가 실제로 차지하는 높이(캡슐 + 띄운 거리)를 그대로 따라간다 — 한쪽만 고치면
  // 콘텐츠 끝이 탭바에 조용히 가린다. 그래서 `--tab-lift`를 양쪽이 같은 출처로 본다.
  page: { padding: '16px 20px calc(var(--tab-h) + var(--tab-lift) + 24px)', minHeight: '100vh' },
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
  /**
   * ⚠️ 테두리를 **shorthand(`border`)로 쓰지 않는다.** 쓰는 쪽이 `borderColor`만 덮으면
   * React가 리렌더에서 그 non-shorthand 값을 지워 버린다("Removing borderColor") —
   * 클래스가 아니라 인라인 스타일을 합치는 구조라서 생기는 함정이고, **첫 렌더에는 멀쩡히
   * 보이다가 리렌더에서만 색이 풀려서** 눈으로 잡기 어렵다. 쪼개 두면 덮어쓰기가 안전하다.
   */
  chip: {
    padding: '5px 10px',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-sub)',
    background: 'var(--bg-sub)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--line)',
    borderRadius: 999,
  },
  empty: { padding: '48px 20px', textAlign: 'center', color: 'var(--text-weak)', fontSize: 14 },

  /**
   * 화면 밑에 붙어 따라오는 버튼 자리.
   *
   * 기구가 10칸이라 세로로 900px쯤 되는데, 「다음」이 그 아래 있으면 **두 화면을 넘겨야
   * 보인다.** 온보딩에서 다음 버튼을 못 찾는 건 그대로 이탈이고, 이탈은 광고 슬롯이
   * 통째로 사라진다는 뜻이다.
   *
   * ⚠️ 좌우 여백을 음수 마진으로 뚫어 화면 끝까지 덮는다 — 안 그러면 스크롤되는 콘텐츠가
   * 버튼 **옆으로 비쳐 지나간다.**
   */
  stickyFooter: {
    position: 'sticky',
    bottom: 0,
    margin: '16px -20px 0',
    padding: '12px 20px calc(var(--safe-b) + 12px)',
    background: 'var(--bg)',
    borderTop: '1px solid var(--line)',
  },
};

/**
 * 기구 한 칸. **정사각형 2열이라 아이콘을 크게 쓸 수 있다.**
 *
 * 고른 칸은 테두리 두께·바탕색·체크 세 가지가 같이 바뀐다 — **색 하나에만 기대면**
 * 색각 이상인 사람에게는 아무 표시도 없는 것과 같다.
 */
export const equipStyle = (on: boolean): CSSProperties => ({
  position: 'relative',
  aspectRatio: '1',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  padding: 0,
  color: on ? 'var(--blue-dark)' : 'var(--text)',
  background: on ? '#eff6ff' : 'var(--bg-sub)',
  border: `${on ? 2 : 1}px solid ${on ? 'var(--blue)' : 'var(--line)'}`,
  borderRadius: 16,
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

/**
 * 기구 상세용 작은 칩. 한 줄에 여러 개가 들어가야 해서 `pickStyle`보다 작다.
 *
 * ⚠️ `off`는 **반드시 눈에 보여야 한다.** `disabled` 속성만 걸면 표시가 0이다 —
 * 여기서 `color`·`background`를 인라인으로 지정하는 순간 브라우저 기본 비활성 색이
 * 통째로 덮여서, 눌러도 안 눌리는 칩이 멀쩡한 칩과 똑같이 보인다.
 *
 * 흐리게 하는 채널로 `opacity`를 고른 이유: `index.css`가 이미 **누르는 느낌**을
 * `opacity`로 준다(`button:active:not(:disabled)`). 그 규칙이 `:disabled`를 빼고 있어
 * 둘이 겹치지 않고, 「눌리는 것은 진해졌다 돌아오고 안 눌리는 것은 계속 흐리다」로
 * 같은 축 위에서 읽힌다.
 */
export const specChipStyle = (on: boolean, off = false): CSSProperties => ({
  padding: '7px 11px',
  fontSize: 13,
  fontWeight: 600,
  color: on ? 'var(--blue-dark)' : 'var(--text-sub)',
  background: on ? '#eff6ff' : '#fff',
  border: `1px solid ${on ? 'var(--blue)' : 'var(--line)'}`,
  borderRadius: 999,
  opacity: off ? 0.45 : 1,
});

/** 초 → `M:SS`. */
export function mmss(sec: number): string {
  const m = Math.floor(sec / 60);
  return `${m}:${String(sec - m * 60).padStart(2, '0')}`;
}
