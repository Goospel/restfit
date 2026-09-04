import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { mmss } from './ui';

describe('mmss', () => {
  it('분과 초로 나눈다', () => {
    expect(mmss(90)).toBe('1:30');
  });

  it('한 자리 초는 0을 채운다', () => {
    // 안 채우면 휴식 화면에 "1:5"가 뜬다.
    expect(mmss(65)).toBe('1:05');
  });

  it('1분 미만은 0분으로 시작한다', () => {
    expect(mmss(40)).toBe('0:40');
    expect(mmss(0)).toBe('0:00');
  });

  it('정확히 분 단위면 초가 00이다', () => {
    expect(mmss(120)).toBe('2:00');
  });
});

/**
 * 테마 값의 단일 출처는 `index.css`다 — `ui.ts` 맨 위 주석이 이미 그렇게 못 박아 뒀는데
 * 지키는 장치가 없어서, 선택 상태의 파랑 틴트가 리터럴로 세 군데 새어 있었다.
 *
 * 새어 나간 값은 **테마를 갈아끼울 때만** 드러난다 — 변수를 전부 바꿔도 리터럴만 옛 색으로
 * 남아서, 화면 절반이 옛 테마인 채로 빌드도 테스트도 통과한다. 그래서 소스를 직독해 잠근다.
 */
const uiSource = readFileSync(new URL('./ui.ts', import.meta.url), 'utf-8');

describe('테마 값은 index.css 한 곳에만 있다', () => {
  it('ui.ts에 색 리터럴이 없다', () => {
    expect(uiSource.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
  });
});
