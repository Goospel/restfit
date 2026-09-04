import { Fragment, useMemo } from 'react';

import { EXERCISES, type EquipKey } from '../data/exercises';
import { EQUIPMENT_ICON, EQUIPMENT_KO } from '../data/labels';
import { unlockGain } from '../logic/equipment';
import { BAND_OPTIONS, BENCH_OPTIONS, PICKABLE, WEIGHT_OPTIONS, type EquipSpec } from '../logic/equipSpec';
import { equipStyle, specChipStyle, ui } from '../ui';
import { Icon } from './Icon';

/** 해금 수치는 **근력만** 센다. 스트레칭까지 넣으면 맨몸 기준이 부풀어 배수가 무너진다. */
const STRENGTH = EXERCISES.filter((e) => e.category === 'strength');

/**
 * 보유 기구 선택.
 *
 * 온보딩 1단계와 기구 탭이 **같은 목록**을 쓴다 — 둘이 갈라지면 온보딩에서 고른 것과
 * 탭에서 보이는 것이 달라 보인다.
 */
type Opt = { key: string; label: string; desc?: string };

/**
 * 기구별 상세 선택지. **없는 기구는 아예 묻지 않는다.**
 *
 * 풀업바·짐볼·폼롤러·복근롤러에는 물어볼 스펙이 없다. 묻는 만큼 온보딩이 길어지고,
 * 길면 이탈한다 — 이탈은 광고 슬롯이 통째로 사라진다는 뜻이다.
 */
const DETAIL: Partial<Record<EquipKey, readonly Opt[]>> = {
  ...WEIGHT_OPTIONS,
  bench: BENCH_OPTIONS,
  band: BAND_OPTIONS,
};

/** 상세 칩이 무엇을 묻는지. 2열 그리드에선 칩이 **어느 칸 것인지 안 보여서** 라벨이 필요하다. */
function detailLabel(k: EquipKey): string {
  if (k === 'bench') return '벤치 등판';
  if (k === 'band') return '밴드 강도';
  return `${EQUIPMENT_KO[k]} 무게`;
}

export function EquipmentPicker({
  owned,
  spec,
  onChange,
  onSpecChange,
}: {
  owned: EquipKey[];
  spec: EquipSpec;
  onChange: (next: EquipKey[]) => void;
  onSpecChange: (next: EquipSpec) => void;
}) {
  const gains = useMemo(
    () => Object.fromEntries(PICKABLE.map((k) => [k, unlockGain(STRENGTH, owned, k).gain])) as Record<EquipKey, number>,
    [owned],
  );

  // 두 칸씩 묶는다. 상세 칩은 **그 줄 아래 전폭으로** 펼쳐야 해서, 칸 둘을 먼저 내보내고
  // 상세를 그다음에 놓는다(그리드는 소스 순서대로 채운다).
  const rows: EquipKey[][] = [];
  for (let i = 0; i < PICKABLE.length; i += 2) rows.push(PICKABLE.slice(i, i + 2));

  function toggle(k: EquipKey) {
    if (!owned.includes(k)) return onChange([...owned, k]);
    onChange(owned.filter((x) => x !== k));
    // 체크를 끄면 상세도 함께 버린다. 남겨 두면 안 가진 기구의 무게가 유령으로 남는다.
    if (k in spec) {
      const next = { ...spec };
      delete next[k as keyof EquipSpec];
      onSpecChange(next);
    }
  }

  function detail(k: EquipKey) {
    const opts = DETAIL[k];
    if (!owned.includes(k) || !opts) return null;
    const picked = spec[k as keyof EquipSpec] as string | undefined;
    const hint = opts.find((o) => o.key === picked)?.desc;
    return (
      <div key={`${k}-detail`} style={{ gridColumn: '1 / -1', padding: '2px 2px 6px' }}>
        <p style={{ fontSize: 12, color: 'var(--text-sub)', margin: '0 0 8px' }}>{detailLabel(k)}</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {opts.map((o) => (
            <button
              key={o.key}
              style={specChipStyle(picked === o.key)}
              onClick={() => onSpecChange({ ...spec, [k]: o.key })}
              aria-pressed={picked === o.key}
            >
              {o.label}
            </button>
          ))}
        </div>
        {/* 고른 값이 루틴을 바꾸는 경우에만 뜬다(벤치). 나머지는 desc가 없어 조용하다. */}
        {hint && <p style={{ ...ui.sub, margin: '6px 2px 0', fontSize: 12 }}>{hint}</p>}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {rows.map((row) => (
        <Fragment key={row[0]}>
          {row.map((k) => {
            const on = owned.includes(k);
            return (
              <button key={k} style={equipStyle(on)} onClick={() => toggle(k)} aria-pressed={on}>
                {on && (
                  <span style={{ position: 'absolute', top: 10, right: 10, color: 'var(--accent)', display: 'flex' }}>
                    <Icon name="check" size={16} />
                  </span>
                )}
                <span style={{ color: on ? 'var(--accent)' : 'var(--text-sub)', display: 'flex' }}>
                  <Icon name={EQUIPMENT_ICON[k]} size={44} />
                </span>
                <span style={{ fontSize: 16, fontWeight: 700 }}>{EQUIPMENT_KO[k]}</span>
                {/* 이미 가진 기구에 "+0개"를 띄우면 잔소리로 읽힌다. 안 가진 것만 보여준다.
                    빈 값이어도 자리는 지킨다 — 안 그러면 칸마다 아이콘 높이가 달라진다. */}
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', minHeight: 19 }}>
                  {!on && gains[k] > 0 ? `+${gains[k]}개` : ''}
                </span>
              </button>
            );
          })}
          {row.map((k) => detail(k))}
        </Fragment>
      ))}
    </div>
  );
}
