import { useEffect, useMemo, useRef, useState } from 'react';

import { awaitAdEvent } from '../adProbe';
import { createReturnTracker } from '../returnTracker';
import { appendLog, clearLog, readLog, restartedAfterOpen, type LogEntry } from '../verifyLog';

/**
 * Phase 0.5 실측 앱 — 한 번의 실기기 테스트로 둘을 잰다.
 *
 * ① **광고를 세션당 몇 번 틀 수 있는가** ★ — 이 서비스의 수익 전체가 이 가정 위에 있다.
 *    5회에서 막히면 모델이 절반 이하로 줄어든다.
 * ② **쉐어링크를 열고 돌아왔을 때 세션이 살아 있는가** — 보조 수익이라 실패해도 치명적이지 않다.
 *
 * 판정 기준은 miniapp/README.md.
 */

const fmt = (t: number) => new Date(t).toLocaleTimeString('ko-KR', { hour12: false });

/** SDK는 토스 앱 안에서만 있다. 일반 브라우저에서도 화면은 뜨도록 동적으로 집어온다. */
const sdk = () => import('@apps-in-toss/web-framework');

export function Probe({ onBack }: { onBack: () => void }) {
  const mountedAt = useRef(Date.now());
  const tracker = useMemo(() => createReturnTracker(), []);
  const [url, setUrl] = useState('');
  const [adGroupId, setAdGroupId] = useState('');
  const [log, setLog] = useState<LogEntry[]>([]);
  const [returns, setReturns] = useState(0);
  const [busy, setBusy] = useState(false);

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

  const adTries = log.filter((e) => e.msg.startsWith('광고 #') && e.msg.includes('load 요청')).length;
  const adShown = log.filter((e) => e.msg.includes('show OK')).length;

  /** ① 광고 1회 시도 — load 후 show. 휴식마다 반복될 실제 흐름과 같다. */
  async function probeAd() {
    if (!adGroupId.trim()) {
      setLog(appendLog('광고 취소 — adGroupId가 비어 있음'));
      return;
    }
    const seq = adTries + 1;
    setBusy(true);
    try {
      const m = await sdk();
      setLog(appendLog(`광고 #${seq} load 요청`));

      const loaded = await awaitAdEvent((h) => m.loadFullScreenAd({ options: { adGroupId: adGroupId.trim() }, ...h }), {
        resolveOn: ['loaded'],
        timeoutMs: 15000,
      });
      setLog(appendLog(`광고 #${seq} load ${loaded.ok ? 'OK' : '실패'} — ${loaded.detail}`));
      if (!loaded.ok) return;

      const shown = await awaitAdEvent((h) => m.showFullScreenAd({ options: { adGroupId: adGroupId.trim() }, ...h }), {
        resolveOn: ['impression', 'dismissed'],
        timeoutMs: 90000,
      });
      setLog(appendLog(`광고 #${seq} show ${shown.ok ? 'OK' : '실패'} — ${shown.detail}`));
    } catch (e) {
      setLog(appendLog(`광고 #${seq} 예외 — ${e instanceof Error ? e.message : String(e)}`));
    } finally {
      setBusy(false);
    }
  }

  /** ② 쉐어링크 열기 — deprecated된 구 API와 후속 Device.openURL을 둘 다 시험한다. */
  async function openLink(kind: 'device' | 'deprecated') {
    const label = kind === 'device' ? 'Device.openURL' : 'openURL(구)';
    if (!url.trim()) {
      setLog(appendLog(`${label} 취소 — URL이 비어 있음`));
      return;
    }
    setLog(appendLog(`${label} 호출 → ${url}`));
    try {
      const m = await sdk();
      await (kind === 'device' ? m.Device.openURL(url.trim()) : m.openURL(url.trim()));
      setLog(appendLog(`${label} resolve`));
    } catch (e) {
      setLog(appendLog(`${label} 실패 — ${e instanceof Error ? e.message : String(e)}`));
    }
  }

  const restarted = restartedAfterOpen(log);

  return (
    <main style={S.page}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <h1 style={{ ...S.h1, margin: 0 }}>Phase 0.5 실측</h1>
        <span style={{ flex: 1 }} />
        <button style={S.clear} onClick={onBack}>
          닫기
        </button>
      </div>

      {/* ───────── ① 광고 ───────── */}
      <section style={S.card}>
        <h2 style={S.h2}>① 광고 연속 노출 ★</h2>
        <p style={S.help}>
          버튼을 <b>반복해서</b> 누르고 <b>몇 번째에서 막히는지</b> 봅니다. 휴식마다 광고를 트는 실제 흐름과 같은
          순서(load → show)입니다.
        </p>
        <input
          style={S.input}
          value={adGroupId}
          onChange={(e) => setAdGroupId(e.target.value)}
          placeholder="앱인토스 콘솔의 adGroupId"
          autoCapitalize="off"
          autoCorrect="off"
        />
        <button style={{ ...S.btn, ...(busy ? S.btnOff : null) }} onClick={probeAd} disabled={busy}>
          {busy ? '진행 중…' : '광고 1회 시도'}
        </button>
        <dl style={S.stats}>
          <div style={S.stat}>
            <dt style={S.dt}>시도</dt>
            <dd style={S.dd}>{adTries}</dd>
          </div>
          <div style={S.stat}>
            <dt style={S.dt}>노출 성공</dt>
            <dd style={S.dd}>{adShown}</dd>
          </div>
        </dl>
      </section>

      {/* ───────── ② 쉐어링크 ───────── */}
      <section style={S.card}>
        <h2 style={S.h2}>② 쉐어링크 복귀</h2>
        <p style={S.help}>
          토스쇼핑 앱에서 상품 공유 → <b>쉐어링크 공유하기</b>로 받은 링크를 붙여넣고, 다녀온 뒤 로그를 봅니다.
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
          <button style={S.btn} onClick={() => openLink('device')}>
            Device.openURL
          </button>
          <button style={{ ...S.btn, ...S.btnAlt }} onClick={() => openLink('deprecated')}>
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
            ⚠️ 로그에 <b>앱 마운트가 2번 이상</b> 찍혔습니다. 미니앱이 재시작됐다는 뜻이고, 이것이 제보된
            &ldquo;세션이 꼬인다&rdquo;는 증상입니다.
          </p>
        )}
      </section>

      {/* ───────── 로그 ───────── */}
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
  h1: { fontSize: 20, margin: '0 0 16px' },
  h2: { fontSize: 16, margin: '0 0 6px' },
  card: { background: '#F9FAFB', border: '1px solid #E5E8EB', borderRadius: 14, padding: 16, marginBottom: 16 },
  help: { fontSize: 13, color: '#6B7684', margin: '0 0 12px' },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px 14px',
    fontSize: 15,
    border: '1px solid #D1D6DB',
    borderRadius: 10,
    marginBottom: 10,
  },
  row: { display: 'flex', gap: 8 },
  btn: {
    flex: 1,
    width: '100%',
    padding: '13px 12px',
    fontSize: 15,
    fontWeight: 600,
    color: '#fff',
    background: '#3182F6',
    border: 0,
    borderRadius: 10,
  },
  btnAlt: { background: '#8B95A1' },
  btnOff: { background: '#C6CBD1' },
  stats: { display: 'flex', gap: 12, margin: '12px 0 0' },
  stat: { flex: 1, background: '#fff', border: '1px solid #E5E8EB', borderRadius: 10, padding: '10px 12px' },
  dt: { fontSize: 12, color: '#6B7684', margin: 0 },
  dd: { fontSize: 16, fontWeight: 700, margin: '2px 0 0' },
  warn: { background: '#FFF0F0', color: '#D63A3A', padding: 12, borderRadius: 10, fontSize: 13, margin: '12px 0 0' },
  logHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  clear: { fontSize: 12, color: '#6B7684', background: 'none', border: '1px solid #D1D6DB', borderRadius: 6, padding: '4px 10px' },
  logList: { listStyle: 'none', padding: 0, margin: 0, fontSize: 13 },
  logItem: { padding: '7px 0', borderBottom: '1px solid #F2F4F6', wordBreak: 'break-all' },
  logTime: { color: '#8B95A1', marginRight: 6, fontVariantNumeric: 'tabular-nums' },
};
