import { useState, type CSSProperties } from 'react';

import { ExerciseImage } from '../components/ExerciseImage';
import { EXERCISES, GROUP_KEYS, groupOf, type EquipKey, type Exercise, type MuscleGroup } from '../data/exercises';
import { EQUIPMENT_KO, GROUP_KO, MUSCLE_KO } from '../data/labels';
import { specChipStyle, ui } from '../ui';

/**
 * 운동 직접 고르기.
 *
 * **추천을 끄는 화면이 아니라, 추천을 이기는 목록을 만드는 화면이다.** 여기서 고른 것이
 * 있으면 홈은 그것만 보여 준다(`customRoutine`). 비우면 자동으로 추천으로 돌아간다 —
 * 켬/끔 스위치를 따로 두지 않는 이유다.
 *
 * 계기: 「턱걸이와 푸시업을 꾸준히 하고 싶은데 그 둘로 설정할 수가 없다」(제보 2026-09-03).
 * 추천만 있는 앱은 **추천이 안 주는 운동을 하려는 사람을 통째로 잃는다.**
 */

const LEVEL_ORDER = { beginner: 0, intermediate: 1, expert: 2 } as const;

/** 근력만. 스트레칭·유산소에는 세트도 휴식도 없어서 이 앱의 루틴이 못 된다. */
const STRENGTH = EXERCISES.filter((e) => e.category === 'strength').sort(
  (a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || a.name.localeCompare(b.name),
);

const BY_ID = new Map(STRENGTH.map((e) => [e.id, e]));

/** 부위별 목록. 초급이 위로 — 처음 고르는 사람은 위에서부터 읽는다. */
const BY_GROUP = new Map<MuscleGroup, Exercise[]>(GROUP_KEYS.map((g) => [g, STRENGTH.filter((e) => groupOf(e) === g)]));

/**
 * 검색 별칭. **데이터의 이름은 원어 음차인데 사람은 우리말로 찾는다.**
 *
 * 「턱걸이」로 0건이 나오면 그 운동은 앱에 없는 것과 같아서, 사용자는 이 화면까지 와 놓고도
 * 「고를 수가 없다」로 되돌아간다. 표를 크게 키울 자리는 아니고 — **갈리는 표기와 우리말
 * 이름**만 담는다.
 */
const ALIASES: Record<string, string[]> = {
  턱걸이: ['풀업', '친업'],
  팔굽혀펴기: ['푸시업'],
  푸쉬업: ['푸시업'],
  윗몸일으키기: ['싯업', '크런치'],
  앉았다일어서기: ['스쿼트'],
  물구나무: ['핸드스탠드'],
  평행봉: ['딥'],
  아령: ['덤벨'],
  역기: ['바벨'],
  고무줄: ['밴드'],
};

/** 한 번에 그릴 검색 결과 상한. 한 글자만 쳐도 200줄이 나오면 폰에서 스크롤이 걸린다. */
const MAX_RESULTS = 80;

/** 검색어 → 실제로 대조할 말들. 별칭은 **키가 검색어를 품기만 해도** 편다(한 글자씩 치는 동안에도 걸리게). */
function termsOf(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return [q, ...Object.keys(ALIASES).filter((k) => k.includes(q)).flatMap((k) => ALIASES[k])];
}

/** 이름(한글·원문)과 **주동근 이름**으로 찾는다 — 「광배근」·「가슴」으로도 닿아야 한다. */
function matches(e: Exercise, terms: string[]): boolean {
  return terms.some(
    (t) =>
      e.name.includes(t) ||
      e.nameEn.toLowerCase().includes(t) ||
      e.primaryMuscles.some((m) => (MUSCLE_KO[m] ?? m).includes(t)),
  );
}

/**
 * 검색 결과 순위 — **찾던 그 운동이 맨 위여야 한다.**
 *
 * 「턱걸이」는 별칭이 7종을 물어 오는데, 그중 사람이 원한 건 대개 **「풀업」 그 자체**다.
 * 이름순으로만 두면 그게 다섯째 줄에 박혀 폰에서는 스크롤해야 보인다.
 */
function rank(e: Exercise, terms: string[]): number {
  return Math.min(...terms.map((t) => (e.name === t ? 0 : e.name.startsWith(t) ? 1 : 2)));
}

/** 고른 칸. 색·테두리·체크가 **함께** 바뀐다 — 색 하나에만 기대면 색각 이상인 사람에게는 표시가 0이다. */
const rowStyle = (on: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  width: '100%',
  padding: 10,
  textAlign: 'left',
  background: on ? 'var(--accent-tint)' : 'var(--bg-sub)',
  border: `${on ? 2 : 1}px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
  borderRadius: 12,
});

export function ExercisePicker({
  picked,
  owned,
  onChange,
  onBack,
}: {
  /** 고른 순서. **그 순서가 곧 루틴 순서다.** */
  picked: string[];
  /** 보유 기구. 거르는 데 쓰지 않는다 — 「무엇이 더 필요한지」를 말해 주는 데만 쓴다. */
  owned: EquipKey[];
  onChange: (next: string[]) => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<MuscleGroup>('chest');

  const terms = termsOf(query);
  /**
   * 지금 가진 것으로 **바로 되는가.** 막는 게 아니라 순서다 — 기구가 하나도 없는 사람이
   * 가슴 탭을 열면 첫 다섯 줄이 전부 「덤벨 필요」라, 푸시업을 찾으려고 한참 내려야 했다.
   *
   * 검색 중에는 `rank`(찾던 그 이름)가 먼저다. 이름을 정확히 친 것보다 강한 신호는 없다.
   */
  const ready = (e: Exercise) => (e.requires.every((k) => owned.includes(k)) ? 0 : 1);
  // 안정 정렬이라 같은 순위 안에서는 위의 초급·이름순이 그대로 남는다.
  const list =
    terms.length > 0
      ? STRENGTH.filter((e) => matches(e, terms))
          .sort((a, b) => rank(a, terms) - rank(b, terms) || ready(a) - ready(b))
          .slice(0, MAX_RESULTS)
      : // 모듈 상수를 제자리 정렬하면 다음 렌더의 기준 순서가 통째로 바뀐다. 복사해서 정렬한다.
        [...BY_GROUP.get(group)!].sort((a, b) => ready(a) - ready(b));
  const chosen = picked.map((id) => BY_ID.get(id)).filter((e): e is Exercise => e !== undefined);
  /** 양쪽을 다 골랐는가 — `splitForce`가 나눌 조건과 **같은 판단**이다. */
  const splits = chosen.some((e) => e.force === 'push') && chosen.some((e) => e.force === 'pull');

  const toggle = (id: string) => onChange(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);

  return (
    <main style={ui.page}>
      <div style={{ display: 'flex', alignItems: 'center', margin: '4px 0 20px' }}>
        <h1 style={{ ...ui.h1, margin: 0 }}>내 운동</h1>
        <span style={ui.spacer} />
        <button style={ui.ghost} onClick={onBack}>
          닫기
        </button>
      </div>
      <p style={ui.sub}>
        고른 운동만 나옵니다. 미는 운동과 당기는 운동을 함께 고르면 하루씩 번갈아 드려요. 하나도 안 고르면 지금처럼
        추천해 드려요.
      </p>

      {chosen.length > 0 && (
        <div style={{ ...ui.card, marginBottom: 16, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            {/* 규칙은 위 안내가 말한다. 여기는 **지금 고른 이 조합이 실제로 나뉘는지**를 말한다 —
                둘의 차이가 「읽었다」와 「됐다」의 차이다. */}
            <div style={{ fontSize: 13, fontWeight: 700 }}>
              고른 운동 {chosen.length}개{splits && ' · 하루씩 번갈아'}
            </div>
            <span style={ui.spacer} />
            {/* 하나씩 빼는 길만 두면 「추천으로 되돌리기」가 N번 누르기가 된다. */}
            <button style={{ ...ui.ghost, padding: '4px 6px', fontSize: 13 }} onClick={() => onChange([])}>
              전체 해제
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {chosen.map((e) => (
              <button
                key={e.id}
                style={{ ...ui.chip, color: 'var(--accent-strong)', background: 'var(--accent-tint)', borderColor: 'var(--accent)' }}
                onClick={() => toggle(e.id)}
              >
                {e.name} ✕
              </button>
            ))}
          </div>
        </div>
      )}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="운동 검색"
        placeholder="턱걸이, 푸시업, 가슴…"
        style={{ ...ui.input, textAlign: 'left', fontSize: 15, fontWeight: 500, marginBottom: 12 }}
      />

      {/* 검색 중에는 부위 칩을 감춘다 — 검색은 부위를 넘어 훑는 자리라, 켜져 있으면 왜 다른
          부위가 나오는지 화면이 거짓말을 한다. */}
      {terms.length === 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {GROUP_KEYS.map((g) => (
            <button key={g} style={specChipStyle(g === group)} aria-pressed={g === group} onClick={() => setGroup(g)}>
              {GROUP_KO[g]}
            </button>
          ))}
        </div>
      )}

      {list.length === 0 ? (
        <div style={ui.empty}>찾는 운동이 없어요. 다른 이름이나 부위로 찾아보세요.</div>
      ) : (
        <div role="group" aria-label="운동 목록" style={{ display: 'grid', gap: 8 }}>
          {list.map((e) => {
            const on = picked.includes(e.id);
            // **막지 않고 말만 한다.** 안 가진 기구를 이유로 빼면 이 화면을 만든 이유가 그대로 재발한다.
            const missing = e.requires.filter((k) => !owned.includes(k));
            return (
              <button key={e.id} style={rowStyle(on)} aria-pressed={on} onClick={() => toggle(e.id)}>
                <ExerciseImage path={e.images[0]} name={e.name} size={48} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{e.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}>
                    {e.primaryMuscles.map((m) => MUSCLE_KO[m] ?? m).join(' · ')}
                  </div>
                  {missing.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                      {missing.map((k) => (
                        <span key={k} style={{ ...ui.chip, padding: '2px 7px', fontSize: 11, background: 'var(--bg)' }}>
                          {EQUIPMENT_KO[k]} 필요
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span style={ui.spacer} />
                {on && <span style={{ fontSize: 16, color: 'var(--accent)' }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </main>
  );
}
