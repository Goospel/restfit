import { defineConfig } from '@apps-in-toss/web-framework/config';

// appName은 `<appName>.ait` 아티팩트 이름이자 콘솔에 등록하는 앱 이름이다. 한글이 그대로 통과한다(빌드 실측).
// 이름이 던진 질문("홈트가 어렵나?")에 홈 화면이 "네, 어렵습니다"로 답한다 — 그게 이 앱의 태도다.
// ⚠️ 이름에 "토스"를 쓸 수 없다(운영정책).
export default defineConfig({
  appName: '홈트가어렵나',
  brand: { primaryColor: '#3182F6' },
  permissions: [],
  // ⚠️ 당겨서 새로고침을 끈다 — 진행 중인 세션은 React state에만 있어서 **새로고침 한 번에 그날 기록이 통째로 날아간다.**
  // 운동 중에 화면을 위로 당기는 건 흔한 동작이다. 세션을 저장소에 넣기 전까지 이 한 줄이 유일한 방어다.
  webView: { pullToRefreshEnabled: false },
  webBundleDir: 'dist',
});
