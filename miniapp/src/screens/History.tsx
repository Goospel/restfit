import { GROUP_KO } from '../data/labels';
import type { WorkoutRecord } from '../storage';
import { ui } from '../ui';

/**
 * 개발용 입구를 배포 번들에서 **코드째** 뺀다.
 *
 * `vite build`의 기본 모드가 `production`이라 릴리스에서는 상수 `false`로 접히고,
 * 아래 블록이 트리셰이킹으로 사라진다 — 숨기는 게 아니라 없어지는 것이다.
 * 실기기(`intoss-private://`)에서 확인해야 하면 `npm run build:dev`로 뽑으면 남는다.
 */
const DEV_TOOLS = import.meta.env.MODE !== 'production';

/**
 * 운동 기록.
 *
 * ⚠️ localStorage에만 있다 — **기기를 바꾸면 날아간다.** 클라우드 동기화는 의도적 보류(설계 §5)라
 * 사용자에게 그 사실을 숨기지 않고 화면 아래에 적어 둔다.
 */
export function History({
  history,
  onResetOnboarding,
}: {
  history: WorkoutRecord[];
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
        개발용 입구. **폰에서 localStorage를 손댈 수 없어서** 있다 —
        온보딩을 고쳐도 이 버튼이 없으면 실기기에서 두 번 볼 방법이 없다.
        사용자에게는 「내 조건」에 기구·목적 변경이 이미 있어서 필요 없다.
      */}
      {DEV_TOOLS && (
        <button style={ui.ghost} onClick={onResetOnboarding}>
          온보딩 다시 보기
        </button>
      )}
    </main>
  );
}
