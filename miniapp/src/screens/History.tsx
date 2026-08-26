import { GROUP_KO } from '../data/labels';
import type { WorkoutRecord } from '../storage';
import { ui } from '../ui';

/**
 * 운동 기록.
 *
 * ⚠️ localStorage에만 있다 — **기기를 바꾸면 날아간다.** 클라우드 동기화는 의도적 보류(설계 §5)라
 * 사용자에게 그 사실을 숨기지 않고 화면 아래에 적어 둔다.
 */
export function History({
  history,
  onProbe,
  onResetOnboarding,
}: {
  history: WorkoutRecord[];
  onProbe: () => void;
  onResetOnboarding: () => void;
}) {
  // 저장은 오래된 것이 앞이고, 화면은 최근 것이 앞이다.
  const recent = [...history].reverse();

  return (
    <main style={ui.page}>
      <h1 style={ui.h1}>기록</h1>

      {recent.length === 0 ? (
        <div style={ui.empty}>
          <p>아직 기록이 없습니다.</p>
          <p style={{ fontSize: 13 }}>오늘의 루틴에서 운동을 시작해 보세요.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {recent.map((r, i) => {
            const sets = r.entries.reduce((n, e) => n + e.sets.length, 0);
            return (
              <div key={`${r.date}-${i}`} style={ui.card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <b style={{ fontSize: 15 }}>{r.date}</b>
                  <span style={ui.chip}>{GROUP_KO[r.group]}</span>
                  <span style={ui.spacer} />
                  <span style={{ fontSize: 13, color: 'var(--text-sub)' }}>{sets}세트</span>
                </div>
                <div style={{ display: 'grid', gap: 4 }}>
                  {r.entries.map((e) => (
                    <div key={e.id} style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                      <span style={{ color: 'var(--text)', minWidth: 0, flex: 1 }}>{e.name}</span>
                      <span style={{ color: 'var(--text-sub)', fontVariantNumeric: 'tabular-nums' }}>
                        {e.sets.map((s) => (s.weight > 0 ? `${s.weight}×${s.reps}` : `${s.reps}회`)).join(' · ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ ...ui.sub, marginTop: 24, marginBottom: 8 }}>
        기록은 이 기기에만 저장됩니다. 앱을 지우거나 기기를 바꾸면 사라집니다.
      </p>
      {/*
        개발자용 입구. 실측이 끝나면 Probe 화면과 함께 걷는다.
        「온보딩 다시 보기」는 **폰에서 localStorage를 손댈 수 없어서** 있다 —
        온보딩을 고쳐도 이 버튼이 없으면 실기기에서 두 번 볼 방법이 없다.
      */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <button style={ui.ghost} onClick={onProbe}>
          개발자용 · Phase 0.5 실측
        </button>
        <button style={ui.ghost} onClick={onResetOnboarding}>
          온보딩 다시 보기
        </button>
      </div>
    </main>
  );
}
