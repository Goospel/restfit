import { useState } from 'react';

import { IMAGE_BASE } from '../ui';

/**
 * 운동 자세 이미지.
 *
 * **떠도 그만 안 떠도 그만이어야 한다** — 미니앱 CSP가 외부 이미지를 막을지 실기기 확인 전까지 모른다.
 * 실패하면 조용히 이름 첫 글자로 대체하고, 화면 흐름은 그대로 간다.
 */
export function ExerciseImage({
  path,
  name,
  size = 72,
  /**
   * 폭을 부모에 맡기고 정사각형만 지킨다. 시트 안 사진처럼 **폭이 화면의 절반**이라
   * 픽셀 수를 미리 알 수 없는 자리에서 쓴다 — `size`를 아무 숫자로 찍으면 기기마다 어긋난다.
   */
  fluid = false,
}: { path?: string; name: string; size?: number; fluid?: boolean }) {
  const [failed, setFailed] = useState(false);
  const box = {
    ...(fluid ? { width: '100%', height: 'auto', aspectRatio: '1' } : { width: size, height: size }),
    flexShrink: 0,
    borderRadius: 10,
    background: 'var(--bg-sub)',
    border: '1px solid var(--line)',
    objectFit: 'cover' as const,
  };

  if (!path || failed) {
    return (
      <div style={{ ...box, display: 'grid', placeItems: 'center', color: 'var(--text-weak)', fontSize: size / 3, fontWeight: 700 }}>
        {name.slice(0, 1)}
      </div>
    );
  }
  return <img src={IMAGE_BASE + path} alt="" style={box} loading="lazy" onError={() => setFailed(true)} />;
}
