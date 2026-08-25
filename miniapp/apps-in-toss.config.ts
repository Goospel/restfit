import { defineConfig } from '@apps-in-toss/web-framework/config';

// ⚠️ appName·brand는 검증용 임시값이다. 정식 출시 전에 정한다 — 이름에 "토스"를 쓸 수 없다(운영정책).
export default defineConfig({
  appName: 'restfit',
  brand: { primaryColor: '#3182F6' },
  permissions: [],
  webBundleDir: 'dist',
});
