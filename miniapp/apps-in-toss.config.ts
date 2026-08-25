import { defineConfig } from '@apps-in-toss/web-framework/config';

// ⚠️ appName은 **표시 이름이 아니라 케밥-케이스 고유 ID**다(콘솔에서 수정 불가). 사람이 보는 이름은
//    콘솔의 「한국어 앱 이름」(= 홈트가어렵나)이고 여기와 별개다. 이 값은 `<appName>.ait` 파일명이자
//    **URL에 그대로 박힌다** — `intoss-private://<appName>?...` 와 `.../bundles/<appName>/upload-start`.
//    ⚠️ 한글을 넣어도 `ait build`는 통과한다(검증이 「문자열인가 && 빈칸 아닌가」뿐이다) — 그리고
//    deploy·실행에서 깨진다. **빌드 통과를 유효성의 증거로 삼지 말 것**(T-218).
// ⚠️ 이름에 "토스"를 쓸 수 없다(운영정책).
export default defineConfig({
  appName: 'home-workout-hard',
  brand: { primaryColor: '#3182F6' },
  permissions: [],
  // ⚠️ 당겨서 새로고침을 끈다 — 진행 중인 세션은 React state에만 있어서 **새로고침 한 번에 그날 기록이 통째로 날아간다.**
  // 운동 중에 화면을 위로 당기는 건 흔한 동작이다. 세션을 저장소에 넣기 전까지 이 한 줄이 유일한 방어다.
  webView: { pullToRefreshEnabled: false },
  webBundleDir: 'dist',
});
