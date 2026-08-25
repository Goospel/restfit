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
