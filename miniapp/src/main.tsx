import { createRoot } from 'react-dom/client';

import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('#root를 찾지 못했습니다');

/**
 * ⚠️ StrictMode를 일부러 쓰지 않는다.
 *
 * React 18 StrictMode는 개발 모드에서 effect를 두 번 실행한다. 이 앱의 판정 근거가
 * 「앱 마운트 로그가 2번 찍히면 재시작된 것」이라, StrictMode를 켜면 개발 중에 항상 재시작으로 보인다.
 * 관측 도구가 관측을 오염시키는 셈이라 뺀다. 본 서비스 화면을 만들 때 다시 검토한다.
 */
createRoot(root).render(<App />);
