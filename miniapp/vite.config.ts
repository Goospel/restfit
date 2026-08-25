import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// 정적 SPA다. 앱인토스 CLI(`ait`)로 번들을 올리면 토스가 호스팅한다 — **서버는 0대다.**
// 운동 데이터는 번들에, 사용자 상태는 localStorage에 있어서 런타임 네트워크 호출이 없다.
export default defineConfig({
  plugins: [react()],
  // BookTimer가 5300을 쓰므로 겹치지 않게 5310. 이 PC에서 5174 구간은 OS 예약이라 피한다(BookTimer T-197).
  server: { port: 5310 },
});
