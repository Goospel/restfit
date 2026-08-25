import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// 미니앱은 토스 인프라(앱인토스 CLI)로 배포된다 — 서버(EC2)는 /api/**만 제공한다.
export default defineConfig({
  plugins: [react()],
  // BookTimer가 5300을 쓰므로 겹치지 않게 5310. 이 PC에서 5174 구간은 OS 예약이라 피한다(BookTimer T-197).
  server: { port: 5310 },
});
