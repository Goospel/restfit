import { useState } from 'react';

import { clearPhotos, deletePhoto, type BodyPhoto as Photo } from '../photoStore';
import { ui } from '../ui';
import { LOCAL_ONLY, useObjectUrl, usePhotos } from './usePhotos';

/**
 * 눈바디 비교. **기준 사진과 고른 날짜를 나란히 두는 것이 전부다**(설계 §4.4).
 *
 * 왼쪽은 기준(남아 있는 가장 오래된 것)으로 **고정**이고 오른쪽만 날짜를 넘긴다 — 양쪽 다
 * 움직이면 「무엇 대비 무엇인가」가 흐려져 변화를 읽을 수 없다. 오버레이 슬라이더·타임랩스는
 * 의도적 보류다(사진이 수십 장 쌓이기 전에는 빈 화면이다).
 *
 * ⚠️ **삭제한 뒤에는 목록을 다시 읽는다.** 로컬 배열에서 한 장 빼는 것으로 대신하면 삭제가
 * 조용히 실패해도 화면은 지워진 것처럼 보이고, 사용자는 지워졌다고 믿는다 — 프라이버시
 * 기능에서 그 거짓말이 제일 비싸다.
 */
export function PhotoCompare({ onClose, idb }: { onClose: () => void; idb?: IDBFactory }) {
  const { db, photos, reload } = usePhotos(idb);
  /**
   * 오른쪽에 놓을 사진의 위치. **기본은 최신**(마지막)이다 — 열자마자 보고 싶은 것은 지금의 몸이다.
   * `null`은 「아직 안 골랐다」이고, 목록이 바뀌어도 이 값이 알아서 최신을 따라간다.
   */
  const [picked, setPicked] = useState<number | null>(null);
  // 삭제로 목록이 짧아져도 범위를 벗어나지 않게 매번 조인다 — 인덱스는 목록의 사실이 아니다.
  const at = Math.min(picked ?? photos.length - 1, photos.length - 1);

  const baseline = photos[0];
  const right: Photo | undefined = photos[at];
  // 한 장뿐이면 좌우가 같은 사진이 된다 — 그건 「변화가 없다」는 거짓말이라 왼쪽을 안 건다.
  const baselineUrl = useObjectUrl(photos.length > 1 ? baseline?.blob : undefined);
  const rightUrl = useObjectUrl(right?.blob);

  async function removeOne() {
    if (!db || !right) return;
    await deletePhoto(db, right.date);
    await reload(db);
  }

  async function removeAll() {
    // 커스텀 다이얼로그는 안 만든다 — 되돌릴 수 없는 삭제에 필요한 것은 확인 한 번이지 화면이 아니다.
    if (!db || !window.confirm('저장된 눈바디 사진을 모두 지울까요? 되돌릴 수 없어요.')) return;
    await clearPhotos(db);
    await reload(db);
  }

  const close = (
    <button style={ui.ghost} onClick={onClose}>
      닫기
    </button>
  );

  const header = (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <h1 style={{ ...ui.h1, margin: 0 }}>눈바디 비교</h1>
      <span style={ui.spacer} />
      {close}
    </div>
  );

  if (db === undefined) return <main style={ui.pageFull}>{header}</main>;

  // 프라이빗 모드·구형 웹뷰. 앱이 죽는 대신 사진 기능만 접힌다.
  if (db === null) {
    return (
      <main style={ui.pageFull}>
        {header}
        <p style={ui.empty}>이 기기에서는 사진을 불러올 수 없어요</p>
      </main>
    );
  }

  if (photos.length === 0) {
    return (
      <main style={ui.pageFull}>
        {header}
        <p style={ui.empty}>아직 눈바디 사진이 없어요</p>
      </main>
    );
  }

  return (
    <main style={ui.pageFull}>
      {header}

      <div style={{ ...ui.row, marginTop: 8 }}>
        {baselineUrl && (
          <Pane label="기준" date={baseline.date}>
            <img src={baselineUrl} alt="기준 사진" style={imgStyle} />
          </Pane>
        )}
        <Pane label={photos.length > 1 ? '선택한 날' : ''} date={right!.date}>
          <img src={rightUrl ?? undefined} alt="비교 사진" style={imgStyle} />
        </Pane>
      </div>

      {photos.length > 1 ? (
        <div style={{ ...ui.row, marginTop: 12 }}>
          {/* 넘기는 것은 오른쪽뿐이다. 왼쪽까지 움직이면 비교의 기준이 사라진다. */}
          <button
            style={{ ...ui.secondary, flex: 1 }}
            aria-label="이전 날짜"
            disabled={at === 0}
            onClick={() => setPicked(at - 1)}
          >
            ‹ 이전 날짜
          </button>
          <button
            style={{ ...ui.secondary, flex: 1 }}
            aria-label="다음 날짜"
            disabled={at === photos.length - 1}
            onClick={() => setPicked(at + 1)}
          >
            다음 날짜 ›
          </button>
        </div>
      ) : (
        <p style={{ ...ui.sub, textAlign: 'center', margin: '12px 0 0' }}>내일 또 찍으면 비교할 수 있어요</p>
      )}

      <button style={{ ...ui.ghost, width: '100%', marginTop: 8 }} onClick={() => void removeOne()}>
        이 사진 삭제
      </button>

      <span style={ui.spacer} />

      <p style={{ ...ui.sub, textAlign: 'center', margin: '16px 0 0' }}>{LOCAL_ONLY}</p>
      {/* 프라이버시 기능이라 v1에서 뺄 수 없다(설계 §4.4). */}
      <button style={{ ...ui.ghost, width: '100%', color: 'var(--red)' }} onClick={() => void removeAll()}>
        사진 모두 삭제
      </button>
    </main>
  );
}

/** 사진 한 장과 그 날짜. 좌우가 같은 형태라야 크기 차이가 몸의 차이로 안 읽힌다. */
function Pane({ label, date, children }: { label: string; date: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ position: 'relative', aspectRatio: '3 / 4', borderRadius: 12, overflow: 'hidden', background: 'var(--bg-sub)' }}>
        {children}
      </div>
      {label && <p style={{ ...ui.sub, textAlign: 'center', margin: '6px 0 0' }}>{label}</p>}
      <p style={{ fontSize: 13, fontWeight: 700, textAlign: 'center', margin: 0 }}>{date}</p>
    </div>
  );
}

const imgStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};
