import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/**
 * 휴식 마지막 3초 펄스의 **안전 규약**을 CSS 파일 직독으로 잠근다(`zoom-guard.test.ts`와 같은 규율).
 *
 * 왜 파일을 직접 읽나: 이 두 규약은 **화면 테스트로는 안 죽는다.** jsdom은 애니메이션을 안
 * 돌리고 미디어 쿼리도 적용하지 않아서, `infinite`를 붙이거나(≈6.25Hz — 광과민성 발작 유발
 * 구간) reduced-motion 쿼리를 정반대로 뒤집어도 전 스위트가 초록이었다(리뷰 실측).
 * 사람의 안전이 걸린 규약은 「조용히 사라질 수 있는」 상태로 두지 않는다.
 */
const css = readFileSync(new URL('./index.css', import.meta.url), 'utf-8');

/** `.cue-pulse { ... }` 본문. 클래스명이 바뀌면 여기서 먼저 죽는다 — 화면과 짝이다. */
const rule = /\.cue-pulse\s*\{([^}]*)\}/.exec(css)?.[1];

describe('펄스 안전 규약 (index.css 직독)', () => {
  it('펄스 클래스가 실재한다', () => {
    expect(rule).toBeDefined();
  });

  it('반복하지 않는다 — 초당 1회지 점멸이 아니다', () => {
    // 3Hz 이상 점멸은 광과민성 발작 위험이다(설계 결정 7). 매초 재생은 `key` 리마운트가 하고,
    // CSS는 **한 번만** 돌아야 한다. `infinite`가 붙는 순간 160ms 주기 ≈ 6.25Hz가 된다.
    expect(rule).not.toContain('infinite');
  });

  it('움직임을 줄여 달라고 한 사람에게는 펄스를 끈다', () => {
    // ★ `no-preference`로 뒤집으면 **정확히 반대**가 된다 — 끄고 싶은 사람에게만 켜진다.
    //   쿼리 존재만 보면 그 변조가 통과하므로 조건까지 문자열로 잠근다.
    // 중첩 블록이라 정규식 한 방으로 끊지 못한다(안쪽 `}`는 들여쓰기가 있다) — 여는 줄에서
    // 자르고 **열 0의 `}`** 까지를 블록으로 본다.
    const query = css.split(/@media[^{]*prefers-reduced-motion:\s*reduce[^{]*\{/)[1]?.split(/\n\}/)[0];
    expect(query).toBeDefined();
    expect(query).toContain('.cue-pulse');
    expect(query).toContain('animation: none');
  });
});
