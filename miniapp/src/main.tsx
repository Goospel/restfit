import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './index.css';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('#root를 찾지 못했습니다');

/**
 * StrictMode를 켠다 (Phase 2에서 재검토한 결과).
 *
 * 원래는 Phase 0.5 실측 도구 때문에 껐었다 — 개발 모드에서 effect가 두 번 돌면
 * 「앱 마운트」 로그가 두 번 찍히기 때문이다. 다시 보니 켜는 쪽이 맞다:
 *  - 실측의 재시작 판정은 `restartedAfterOpen`(**열기 호출 다음에** 마운트가 왔는가)이라 이중 마운트에 영향받지 않는다
 *  - StrictMode는 **개발 모드에서만** 두 번 돈다. 실측은 배포된 빌드로 하므로 애초에 무관하다
 *  - 반대로 운동 화면부터는 타이머 effect가 생겨, 정리 함수 누락을 잡아 줄 도구가 필요하다.
 *    Phase 3에서 광고 preload가 붙으면 더 그렇다
 */
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
