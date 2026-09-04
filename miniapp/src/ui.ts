import type { CSSProperties } from 'react';

/**
 * 화면 네 개가 나눠 쓰는 스타일.
 *
 * 색·간격은 `index.css`의 CSS 변수를 참조한다 — 값을 여기에 직접 박으면 화면마다 미묘하게 달라진다.
 * ⚠️ 이 규칙은 말이 아니라 **검사로 잠겨 있다**(`ui.test.ts`가 이 파일을 직독해 색 리터럴 0을 확인).
 * 새어 나간 리터럴은 테마를 갈아끼울 때만 드러나고, 그때는 화면 절반이 옛 색인 채로 전부 통과한다.
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
  /**
   * 화면 제목. **본문과 획의 종류가 다르다**(명조) — 크기만 키운 제목은 「큰 본문」으로 읽힌다.
   * 자간을 좁히는 건 명조가 본문 크기보다 커질수록 글자 사이가 벌어져 보이기 때문이다.
   */
  h1: { fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.28, margin: '4px 0 20px' },
  h2: { fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, letterSpacing: '-0.015em', margin: '0 0 4px' },
  sub: { fontSize: 13, color: 'var(--text-sub)', margin: '0 0 16px' },
  card: { background: 'var(--bg-sub)', border: '1px solid var(--line)', borderRadius: 3, padding: 16 },
  row: { display: 'flex', gap: 8 },
  spacer: { flex: 1 },

  // ── 버튼
  primary: {
    width: '100%',
    padding: '16px 12px',
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: '0.02em',
    /**
     * **먹색 바다. 강조(주홍)를 여기 쓰지 않는다** — 주홍은 「지금 고른 것 / 오늘 하는 것」을
     * 가리키는 색이라, 화면에서 제일 큰 면을 그 색이 먹으면 가리킬 색이 남지 않는다.
     */
    color: 'var(--bg)',
    background: 'var(--text)',
    border: 0,
    borderRadius: 3,
  },
  secondary: {
    width: '100%',
    padding: '13px 12px',
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text-sub)',
    background: 'var(--bg-sub)',
    border: '1px solid var(--line-strong)',
    borderRadius: 3,
  },
  ghost: {
    padding: '10px 12px',
    fontSize: 14,
    color: 'var(--text-weak)',
    background: 'none',
    border: 0,
    borderRadius: 3,
  },
  disabled: { background: 'var(--line-strong)', color: 'var(--bg)' },

  // ── 입력
  input: {
    width: '100%',
    padding: '13px 14px',
    fontSize: 17,
    fontWeight: 600,
    textAlign: 'center',
    color: 'var(--text)',
    background: 'var(--bg)',
    border: '1px solid var(--line-strong)',
    borderRadius: 3,
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
    borderRadius: 3,
  },
  /**
   * 줄로만 나뉘는 전폭 링크. 「내 운동 N개 · 바꾸기」처럼 **목록 바로 위에 서는 입구**에 쓴다.
   *
   * 딱지(`chip`)가 아니라 괘선인 이유: 바로 아래가 괘선으로 나뉜 운동 목록이라, 딱지를 얹으면
   * 목록의 머리가 아니라 「목록 위에 따로 떠 있는 것」으로 읽힌다.
   *
   * ⚠️ **윗선만 긋는다.** 위아래를 다 그으면 이 줄이 연달아 설 때(입구 둘 + 운동 여러 개)
   * 사이가 1px이 아니라 2px가 된다 — 실측으로 잡혔다(붙어 있어서 간격 0, 선만 두꺼워진다).
   * 묶음의 **아랫선은 감싸는 쪽이 긋는다**(`Home`의 목록 컨테이너).
   */
  rowLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '12px 0',
    fontSize: 13,
    fontWeight: 600,
    textAlign: 'left',
    color: 'var(--text)',
    background: 'none',
    borderWidth: '1px 0 0',
    borderStyle: 'solid',
    borderColor: 'var(--line)',
    borderRadius: 0,
  },
  empty: { padding: '48px 20px', textAlign: 'center', color: 'var(--text-weak)', fontSize: 14 },

  /**
   * 바텀시트와 그 뒤를 덮는 막. **둘은 한 벌이다** — `zIndex`가 40·41로 맞물려 있어
   * 한쪽만 가져다 쓰면 막이 시트를 덮거나 시트가 막 없이 뜬다.
   *
   * 밑 화면은 살아 있는 채로 가려진다 — 세트 화면에서 열어도 입력하던 무게·횟수가 안 날아간다.
   */
  dim: {
    position: 'fixed',
    inset: 0,
    // 순검정이 아니라 먹색을 흐린 것이다 — 종이 위에 검정 막을 씌우면 그 순간만 화면이 차가워진다.
    background: 'rgba(20, 17, 13, 0.45)',
    zIndex: 40,
  },
  sheet: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 41,
    maxHeight: '72vh',
    overflowY: 'auto',
    padding: '16px 20px calc(var(--safe-b) + 20px)',
    background: 'var(--bg)',
    borderRadius: '10px 10px 0 0',
    boxShadow: '0 -6px 24px rgba(30, 22, 10, 0.16)',
  },

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
  color: on ? 'var(--accent-strong)' : 'var(--text)',
  background: on ? 'var(--accent-tint)' : 'var(--bg-sub)',
  border: `${on ? 2 : 1}px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
  borderRadius: 4,
});

/** 선택 상태의 목적 카드. 기구 카드보다 크고 테두리가 두껍다 — 하나만 고르는 자리다. */
export const goalStyle = (on: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  width: '100%',
  padding: 16,
  textAlign: 'left',
  background: on ? 'var(--accent-tint)' : 'var(--bg-sub)',
  border: `${on ? 2 : 1}px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
  borderRadius: 4,
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
  color: on ? 'var(--accent-strong)' : 'var(--text-sub)',
  background: on ? 'var(--accent-tint)' : 'var(--bg)',
  border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
  borderRadius: 3,
  opacity: off ? 0.45 : 1,
});

/** 초 → `M:SS`. */
export function mmss(sec: number): string {
  const m = Math.floor(sec / 60);
  return `${m}:${String(sec - m * 60).padStart(2, '0')}`;
}
