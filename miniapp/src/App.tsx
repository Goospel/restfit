import { useEffect, useMemo, useRef, useState } from 'react';

import { createReturnTracker } from './returnTracker';
import { appendLog, clearLog, readLog, type LogEntry } from './verifyLog';

/**
 * 쉐어링크 복귀 검증 앱.
 *
 * 재는 것은 딱 하나 — **미니앱에서 토스쇼핑 쉐어링크를 열고 돌아왔을 때 세션이 살아 있는가.**
 * 앱인토스 개발자 커뮤니티에 앱 복귀가 불안정하다는 제보가 있고(토스 "개선 논의 중"),
 * 이 서비스의 수익 전부가 그 링크 하나에 달려 있다. 설계 §2 참조.
 *
 * 화면에서 읽는 판정:
 * - 로그가 「열기 호출 → 복귀 감지」면 **정상**
 * - 로그가 「열기 호출 → 앱 마운트」면 **세션이 꼬여 재시작된 것**
 * - 아무것도 안 찍히면 **복귀 자체가 실패**
 */

const fmt = (t: number) => new Date(t).toLocaleTimeString('ko-KR', { hour12: false });

/** SDK는 토스 앱 안에서만 있다. 일반 브라우저에서도 화면은 뜨도록 동적으로 집어온다. */
async function callOpenURL(kind: 'device' | 'deprecated', url: string): Promise<void> {
  const mod = await import('@apps-in-toss/web-framework');
  if (kind === 'device') return mod.Device.openURL(url);
  return mod.openURL(url);
}

export function App() {
  const mountedAt = useRef(Date.now());
  const tracker = useMemo(() => createReturnTracker(), []);
  const [url, setUrl] = useState('');
  const [log, setLog] = useState<LogEntry[]>([]);
  const [returns, setReturns] = useState(0);

  // 마운트를 먼저 기록한다 — 「열기 호출」 다음에 이게 찍히면 그것이 곧 재시작의 증거다.
  useEffect(() => {
    setLog(appendLog(`앱 마운트 (mountedAt=${mountedAt.current})`));
  }, []);

  useEffect(() => {
    function onChange() {
      const state = document.visibilityState === 'hidden' ? 'hidden' : 'visible';
      const before = tracker.events.length;
      tracker.onVisibilityChange(state);
      const after = tracker.events;
      if (after.length > before) {
        const last = after[after.length - 1];
        setReturns(after.length);
        setLog(appendLog(`복귀 감지 (숨김 ${(last.hiddenMs / 1000).toFixed(1)}초)`));
      }
    }
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, [tracker]);

  async function open(kind: 'device' | 'deprecated') {
    const label = kind === 'device' ? 'Device.openURL' : 'openURL(구)';
    if (!url.trim()) {
      setLog(appendLog(`${label} 취소 — URL이 비어 있음`));
      return;
    }
    setLog(appendLog(`${label} 호출 → ${url}`));
    try {
      await callOpenURL(kind, url.trim());
      setLog(appendLog(`${label} resolve`));
    } catch (e) {
      setLog(appendLog(`${label} 실패 — ${e instanceof Error ? e.message : String(e)}`));
    }
  }

  const restarted = log.filter((e) => e.msg.startsWith('앱 마운트')).length > 1;

  return (
    <main style={S.page}>
      <h1 style={S.h1}>쉐어링크 복귀 검증</h1>
      <p style={S.help}>
        토스쇼핑 앱에서 상품 공유 → <b>쉐어링크 공유하기</b>로 받은 링크를 붙여넣고 버튼을 누르세요. 토스쇼핑에 다녀온 뒤
        아래 로그를 확인합니다.
      </p>

      <input
        style={S.input}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://toss.im/_m/..."
        inputMode="url"
        autoCapitalize="off"
        autoCorrect="off"
      />

      <div style={S.row}>
        <button style={S.btn} onClick={() => open('device')}>
          Device.openURL
        </button>
        <button style={{ ...S.btn, ...S.btnAlt }} onClick={() => open('deprecated')}>
          openURL (구 API)
        </button>
      </div>

      <dl style={S.stats}>
        <div style={S.stat}>
          <dt style={S.dt}>이번 마운트</dt>
          <dd style={S.dd}>{fmt(mountedAt.current)}</dd>
        </div>
        <div style={S.stat}>
          <dt style={S.dt}>복귀 횟수</dt>
          <dd style={S.dd}>{returns}</dd>
        </div>
      </dl>

      {restarted && (
        <p style={S.warn}>
          ⚠️ 로그에 <b>앱 마운트가 2번 이상</b> 찍혔습니다. 미니앱이 재시작됐다는 뜻이고, 이것이 제보된 &ldquo;세션이
          꼬인다&rdquo;는 증상입니다.
        </p>
      )}

      <div style={S.logHead}>
        <b>로그</b>
        <button
          style={S.clear}
          onClick={() => {
            clearLog();
            setLog(readLog());
            setReturns(0);
          }}
        >
          지우기
        </button>
      </div>
      <ol style={S.logList}>
        {log.map((e, i) => (
          <li key={`${e.t}-${i}`} style={S.logItem}>
            <span style={S.logTime}>{fmt(e.t)}</span> {e.msg}
          </li>
        ))}
      </ol>
      {log.length === 0 && <p style={S.help}>아직 기록이 없습니다.</p>}
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { padding: 20, fontFamily: 'system-ui, -apple-system, sans-serif', color: '#191F28', lineHeight: 1.5 },
  h1: { fontSize: 20, margin: '0 0 8px' },
  help: { fontSize: 13, color: '#6B7684', margin: '0 0 16px' },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px 14px',
    fontSize: 15,
    border: '1px solid #D1D6DB',
    borderRadius: 10,
    marginBottom: 12,
  },
  row: { display: 'flex', gap: 8, marginBottom: 20 },
  btn: {
    flex: 1,
    padding: '13px 12px',
    fontSize: 15,
    fontWeight: 600,
    color: '#fff',
    background: '#3182F6',
    border: 0,
    borderRadius: 10,
  },
  btnAlt: { background: '#8B95A1' },
  stats: { display: 'flex', gap: 12, margin: '0 0 16px' },
  stat: { flex: 1, background: '#F2F4F6', borderRadius: 10, padding: '10px 12px' },
  dt: { fontSize: 12, color: '#6B7684', margin: 0 },
  dd: { fontSize: 16, fontWeight: 700, margin: '2px 0 0' },
  warn: { background: '#FFF0F0', color: '#D63A3A', padding: 12, borderRadius: 10, fontSize: 13, margin: '0 0 16px' },
  logHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  clear: { fontSize: 12, color: '#6B7684', background: 'none', border: '1px solid #D1D6DB', borderRadius: 6, padding: '4px 10px' },
  logList: { listStyle: 'none', padding: 0, margin: 0, fontSize: 13 },
  logItem: { padding: '7px 0', borderBottom: '1px solid #F2F4F6', wordBreak: 'break-all' },
  logTime: { color: '#8B95A1', marginRight: 6, fontVariantNumeric: 'tabular-nums' },
};
