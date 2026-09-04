import { useMemo, useState } from 'react';

import { GROUP_KO } from '../data/labels';
import { addMonth, formatYm, monthCells, monthOf, type Ym } from '../logic/calendar';
import type { BodyPhoto } from '../photoStore';
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

/** 일요일 시작 — 국내 달력 관례다. `monthCells`의 앞 빈칸도 같은 기준으로 센다. */
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 운동 기록 — **월간 캘린더**.
 *
 * 리스트가 아니라 달력이 주인이다. 리스트는 「언제 뭘 했나」를 스크롤로 재구성하게 만드는데,
 * 사람이 기록에서 실제로 찾는 것은 **빈 칸**(며칠 쉬었나)이라 달력이 그걸 한눈에 답한다.
 * 내용은 날짜를 눌렀을 때 뜨는 플로팅 카드가 담당한다.
 *
 * ⚠️ 기록은 localStorage에만 있다 — **기기를 바꾸면 날아간다.** 클라우드 동기화는 의도적
 * 보류(설계 §5)라 사용자에게 그 사실을 숨기지 않고 화면 아래에 적어 둔다.
 */
export function History({
  history,
  onResetOnboarding,
  onComparePhotos,
  idb,
}: {
  history: WorkoutRecord[];
  onResetOnboarding: () => void;
  onComparePhotos: () => void;
  /** 테스트가 fake-indexeddb를 넣는 자리. 없으면 `globalThis.indexedDB`. */
  idb?: IDBFactory;
}) {
  /** 상태는 둘뿐이다 — 보는 달, 열린 날. 셋째가 생기면 셋의 조합을 화면이 정해야 한다. */
  const [ym, setYm] = useState<Ym>(() => monthOf(todayKey()));
  const [selected, setSelected] = useState<string | null>(null);
  const { photos } = usePhotos(idb);

  // 날짜 키가 전부 `YYYY-MM-DD`라 셀 ↔ 기록 ↔ 사진 대조가 문자열 비교 하나로 끝난다.
  const byDate = useMemo(() => {
    const m = new Map<string, WorkoutRecord[]>();
    // 같은 날 레코드가 여럿일 수 있다 — `appendRecord`는 날짜로 합치지 않는다.
    for (const r of history) m.set(r.date, [...(m.get(r.date) ?? []), r]);
    return m;
  }, [history]);
  const photoByDate = useMemo(() => new Map(photos.map((p) => [p.date, p])), [photos]);

  const cells = useMemo(() => monthCells(ym), [ym]);
  const today = todayKey();

  // 세는 단위는 **날**이다(설계 §0). 레코드 수로 세면 같은 날 두 번 한 사람이 이틀 운동한 게 된다.
  const workoutDays = cells.filter((c) => c !== null && byDate.has(c)).length;
  const photoDays = cells.filter((c) => c !== null && photoByDate.has(c)).length;

  return (
    <main style={ui.page}>
      <h1 style={ui.h1}>기록</h1>

      <div style={ui.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <button style={arrow} aria-label="지난달" onClick={() => setYm((v) => addMonth(v, -1))}>
            ‹
          </button>
          {/* 기록 이전 달도 막지 않는다 — 빈 달력을 보는 것도 답이다(「그때는 안 했구나」). */}
          <b style={{ fontSize: 16, minWidth: 108, textAlign: 'center' }}>{formatYm(ym)}</b>
          <button style={arrow} aria-label="다음달" onClick={() => setYm((v) => addMonth(v, 1))}>
            ›
          </button>
        </div>

        <div style={grid}>
          {WEEKDAYS.map((w) => (
            <div key={w} data-weekday style={{ fontSize: 11, color: 'var(--text-weak)', textAlign: 'center' }}>
              {w}
            </div>
          ))}
        </div>

        <div style={{ ...grid, marginTop: 4 }}>
          {cells.map((c, i) => {
            if (c === null) return <div key={`pad-${i}`} style={cell(false)} />;

            const recs = byDate.get(c);
            const pic = photoByDate.get(c);
            const marks = (
              <span style={{ display: 'flex', gap: 3, height: 5, marginTop: 3 }}>
                {/* 순서는 「운동 왼쪽 · 눈바디 오른쪽」 고정 — 자리가 바뀌면 색만으로 다시 읽어야 한다. */}
                {recs && <span data-mark="workout" style={dot('var(--accent)')} />}
                {pic && <span data-mark="photo" style={dot('var(--green)')} />}
              </span>
            );
            const body = (
              <>
                <span>{Number(c.slice(8))}</span>
                {marks}
              </>
            );

            // 내용이 없는 날은 **버튼이 아니다.** 눌러도 아무 일 없는 버튼을 만드는 대신
            // 처음부터 누를 수 없게 둔다 — 빈 카드가 뜨는 것보다 안 열리는 편이 정직하다.
            if (!recs && !pic) {
              return (
                <div key={c} data-day={c} style={cell(c === today)}>
                  {body}
                </div>
              );
            }
            return (
              <button
                key={c}
                data-day={c}
                // 점 두 개는 화면 낭독기에 아무것도 아니다 — 이름으로 다시 말한다.
                aria-label={`${ym.month}월 ${Number(c.slice(8))}일${recs ? ', 운동' : ''}${pic ? ', 눈바디' : ''}`}
                style={{ ...cell(c === today), background: 'none' }}
                onClick={() => setSelected(c)}
              >
                {body}
              </button>
            );
          })}
        </div>

        {/* 색 둘에만 기대면 색각 이상인 사람에게는 아무 표시도 없는 것과 같다. */}
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 12, fontSize: 12, color: 'var(--text-sub)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={dot('var(--accent)')} />
            <span>운동</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={dot('var(--green)')} />
            <span>눈바디</span>
          </span>
        </div>
      </div>

      <p style={{ ...ui.sub, margin: '12px 0 0', textAlign: 'center' }}>
        {`${ym.month}월 · ${workoutDays}일 운동 · 눈바디 ${photoDays}장`}
      </p>

      {history.length === 0 && (
        <div style={{ ...ui.empty, padding: '20px 12px' }}>
          <p style={{ margin: 0 }}>아직 기록이 없습니다.</p>
          <p style={{ fontSize: 13, margin: '4px 0 0' }}>오늘의 루틴에서 운동을 시작해 보세요.</p>
        </div>
      )}

      <CompareRow photos={photos} onCompare={onComparePhotos} />

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

      {selected && (
        <DayCard
          date={selected}
          records={byDate.get(selected) ?? []}
          photo={photoByDate.get(selected)}
          onClose={() => setSelected(null)}
        />
      )}
    </main>
  );
}

/**
 * 하루치 플로팅 카드 — 딤 + 바텀시트.
 *
 * 시트는 화면 **밑변부터** 덮는다(`position: fixed`) — 탭바 위에 얹는 게 아니라 가린다.
 * 딤이 탭바까지 덮으므로 탭을 누르면 **먼저 시트가 닫힌다**(모달 관례. 이동하려면 한 번 더
 * 누른다). 탭바는 두 번 반려된 표면이라 z-index로 뚫는 대신 이 동작을 스펙으로 받는다.
 */
function DayCard({
  date,
  records,
  photo,
  onClose,
}: {
  date: string;
  records: WorkoutRecord[];
  photo: BodyPhoto | undefined;
  onClose: () => void;
}) {
  const { month } = monthOf(date);
  const day = Number(date.slice(8));
  // 요일은 `Date`로 읽되 **UTC로 통일**한다 — 로컬 메서드를 섞으면 자정 근처에서 하루가 밀린다.
  const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];

  return (
    <>
      <div data-dim style={ui.dim} onClick={onClose} />
      <div data-sheet style={ui.sheet}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <b style={{ fontSize: 16 }}>{`${month}월 ${day}일 ${weekday}요일`}</b>
          {records.map((r, i) => (
            <span key={`chip-${i}`} style={ui.chip}>
              {GROUP_KO[r.group]}
            </span>
          ))}
          <span style={ui.spacer} />
          <button style={{ ...ui.ghost, fontSize: 18, padding: '4px 8px' }} aria-label="닫기" onClick={onClose}>
            ✕
          </button>
        </div>

        {photo && <DayPhoto date={date} blob={photo.blob} />}

        {records.map((r, i) => (
          <div key={`rec-${i}`} style={{ display: 'grid', gap: 4, marginTop: 12 }}>
            {r.entries.map((e) => (
              <div key={e.id} style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                <span style={{ color: 'var(--text)', minWidth: 0, flex: 1 }}>{e.name}</span>
                <span style={{ color: 'var(--text-sub)', fontVariantNumeric: 'tabular-nums' }}>
                  {/* 표기는 기존 리스트 그대로 — 맨몸엔 얹을 무게가 없어 회수로 적는다. */}
                  {e.sets.map((s) => (s.weight > 0 ? `${s.weight}×${s.reps}` : `${s.reps}회`)).join(' · ')}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

/** 시트 안의 눈바디. blob URL은 **만든 곳이 revoke까지 책임진다**(`useObjectUrl`). */
function DayPhoto({ date, blob }: { date: string; blob: Blob }) {
  const url = useObjectUrl(blob);
  if (!url) return null;
  return (
    <img
      src={url}
      alt={`${date} 눈바디 사진`}
      style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 10, marginTop: 12, background: 'var(--bg-sub)' }}
    />
  );
}

/**
 * 비교로 가는 **유일한 문**. 촬영 입구는 완료 화면으로 일원화됐다(운동한 날만 찍는다).
 *
 * 사진이 0장이면 로우 자체가 없다 — 빈 화면으로 보내는 버튼을 만들지 않는다.
 */
function CompareRow({ photos, onCompare }: { photos: BodyPhoto[]; onCompare: () => void }) {
  // 거는 얼굴은 **최신**이다. 기준(가장 오래된 것)을 걸면 몇 달 전 몸이 계속 걸려 있다.
  const latest = photos[photos.length - 1];
  const thumbUrl = useObjectUrl(latest?.blob);
  if (!latest) return null;

  const [, m, d] = latest.date.split('-');

  return (
    <>
      <div style={{ ...ui.card, display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, padding: 12 }}>
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt="최근 눈바디 사진"
            style={{ width: 40, height: 52, objectFit: 'cover', borderRadius: 8, background: 'var(--bg-sub)' }}
          />
        ) : null}
        <span style={{ flex: 1, fontSize: 13, color: 'var(--text-sub)' }}>
          {`눈바디 ${photos.length}장 · 최근 ${Number(m)}/${Number(d)}`}
        </span>
        <button style={{ ...ui.secondary, width: 'auto', padding: '9px 16px' }} onClick={onCompare}>
          비교
        </button>
      </div>
      {/* 사진이 보이는 화면에는 상시 붙는 한 줄이다 — 화면마다 문구가 달라지면 「어느 쪽이 사실인가」가 된다. */}
      <p style={{ ...ui.sub, margin: '8px 0 0' }}>{LOCAL_ONLY}</p>
    </>
  );
}

const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginTop: 12 };

const arrow: React.CSSProperties = {
  padding: '4px 14px',
  fontSize: 20,
  color: 'var(--text-sub)',
  background: 'none',
  border: 0,
  borderRadius: 8,
};

/**
 * 달력 한 칸. 오늘만 테두리를 두른다.
 *
 * ⚠️ 테두리는 **shorthand를 통째로 갈아 끼운다**(`ui.ts` 머리말) — 기본 스타일에 `border`를
 * 두고 `borderColor`만 덮으면 React가 리렌더에서 그 값을 지워, 첫 렌더에만 색이 보인다.
 * 투명 테두리를 늘 깔아 두는 이유는 테두리 유무의 자리 차이를 2px에서 1px로 줄이기
 * 위해서다 — 없애지는 못한다(오늘은 2px, 나머지는 1px).
 */
const cell = (isToday: boolean): React.CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 40,
  padding: 0,
  fontSize: 13,
  color: 'var(--text)',
  border: isToday ? '2px solid var(--accent)' : '1px solid transparent',
  borderRadius: 10,
});

const dot = (color: string): React.CSSProperties => ({
  width: 5,
  height: 5,
  borderRadius: 999,
  backgroundColor: color,
});
