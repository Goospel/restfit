// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ExerciseImage } from './ExerciseImage';

afterEach(cleanup);

describe('ExerciseImage — 상자 크기', () => {
  it('기본은 `size` 정사각형이다', () => {
    const { container } = render(<ExerciseImage path="Curl/0.jpg" name="조트만 컬" size={88} />);
    const img = container.querySelector('img')!;
    expect(img.style.width).toBe('88px');
    expect(img.style.height).toBe('88px');
    expect(img.style.aspectRatio).toBe('');
  });

  it('fluid면 폭을 채우고 정사각형을 유지한다', () => {
    // 시트 안 사진은 폭이 「화면의 절반」이라 픽셀 수를 미리 알 수 없다 — 폭을 따라가야 한다.
    const { container } = render(<ExerciseImage path="Curl/0.jpg" name="조트만 컬" fluid />);
    const img = container.querySelector('img')!;
    expect(img.style.width).toBe('100%');
    expect(img.style.height).toBe('auto');
    expect(img.style.aspectRatio).toBe('1 / 1'); // jsdom이 비율을 정규화한다
  });

  it('대체 표시도 같은 상자다 — 사진이 실패해도 자리가 안 무너진다', () => {
    // 실패한 칸만 88px로 남으면 두 장 나란히가 어긋난다. 대체 표시는 「없는 그림」이지 「없는 자리」가 아니다.
    const { container } = render(<ExerciseImage name="조트만 컬" fluid />);
    const box = container.firstElementChild as HTMLElement;
    expect(box.tagName).toBe('DIV');
    expect(box.style.width).toBe('100%');
    expect(box.style.aspectRatio).toBe('1 / 1'); // jsdom이 비율을 정규화한다
    // 글자는 size(기본 72)를 따라가면 안 된다 — fluid 상자는 그 두 배라 24px 글자가 점처럼 남는다.
    expect(box.style.fontSize).toBe('2.5rem');
  });
});
