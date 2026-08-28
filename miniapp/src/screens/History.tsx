import { GROUP_KO } from '../data/labels';
import { todayKey, type WorkoutRecord } from '../storage';
import { ui } from '../ui';
import { LOCAL_ONLY, useObjectUrl, usePhotos } from './usePhotos';

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
  onShootPhoto,
  onComparePhotos,
  idb,
}: {
  history: WorkoutRecord[];
  onResetOnboarding: () => void;
  onShootPhoto: () => void;
  onComparePhotos: () => void;
  /** 테스트가 fake-indexeddb를 넣는 자리. 없으면 `globalThis.indexedDB`. */
  idb?: IDBFactory;
}) {
  // 저장은 오래된 것이 앞이고, 화면은 최근 것이 앞이다.
  const recent = [...history].reverse();

  return (
    <main style={ui.page}>
      <h1 style={ui.h1}>기록</h1>

      <BodyPhotoCard onShoot={onShootPhoto} onCompare={onComparePhotos} idb={idb} />

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

/**
 * 눈바디 카드. **운동을 안 한 날에도 찍을 수 있는 유일한 입구**이고(완료 화면 제안은 운동한
 * 날만 뜬다), 비교 화면으로 가는 유일한 문이다.
 *
 * 기록 리스트 **위**에 둔다 — 아래에 두면 기록이 쌓일수록 멀어져, 몇 달 뒤에는 스크롤 두
 * 화면 밑에 있는 기능이 된다.
 */
function BodyPhotoCard({
  onShoot,
  onCompare,
  idb,
}: {
  onShoot: () => void;
  onCompare: () => void;
  idb?: IDBFactory;
}) {
  const { photos } = usePhotos(idb);
  // 카드에 거는 얼굴은 **최신**이다. 기준(가장 오래된 것)을 걸면 몇 달 전 몸이 계속 걸려 있다.
  const latest = photos[photos.length - 1];
  const thumbUrl = useObjectUrl(latest?.blob);

  return (
    <div style={{ ...ui.card, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt="최근 눈바디 사진"
            style={{ width: 56, height: 74, objectFit: 'cover', borderRadius: 8, background: 'var(--bg-sub)' }}
          />
        ) : null}
        <div style={{ minWidth: 0, flex: 1 }}>
          <b style={{ fontSize: 15 }}>눈바디</b>
          <p style={{ ...ui.sub, margin: '4px 0 0' }}>
            {latest ? latest.date : '아직 눈바디 사진이 없어요'}
          </p>
        </div>
      </div>

      <div style={{ ...ui.row, marginTop: 12 }}>
        <button style={{ ...ui.secondary, flex: 1 }} onClick={onShoot}>
          {/* 하루 1장이라 같은 날 찍으면 덮어쓴다 — 누르기 전에 알린다. */}
          {latest?.date === todayKey() ? '오늘 다시 찍기' : '오늘 찍기'}
        </button>
        {/* 비교할 것이 없는데 문을 열어 두면 빈 화면으로 보내는 버튼이 된다. */}
        {latest && (
          <button style={{ ...ui.secondary, flex: 1 }} onClick={onCompare}>
            비교
          </button>
        )}
      </div>

      <p style={{ ...ui.sub, margin: '10px 0 0' }}>{LOCAL_ONLY}</p>
    </div>
  );
}
