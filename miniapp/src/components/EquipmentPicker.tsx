import { useMemo } from 'react';

import { EXERCISES, type EquipKey } from '../data/exercises';
import { EQUIPMENT_KO } from '../data/labels';
import { unlockGain } from '../logic/equipment';
import { BAND_OPTIONS, BENCH_OPTIONS, PICKABLE, WEIGHT_OPTIONS, type EquipSpec } from '../logic/equipSpec';
import { pickStyle, specChipStyle, ui } from '../ui';

/** 해금 수치는 **근력만** 센다. 스트레칭까지 넣으면 맨몸 기준이 부풀어 배수가 무너진다. */
const STRENGTH = EXERCISES.filter((e) => e.category === 'strength');

/**
 * 보유 기구 체크 목록.
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

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {PICKABLE.map((k) => {
        const on = owned.includes(k);
        const opts = DETAIL[k];
        const picked = spec[k as keyof EquipSpec] as string | undefined;
        const hint = opts?.find((o) => o.key === picked)?.desc;
        return (
          <div key={k}>
            <button style={pickStyle(on)} onClick={() => toggle(k)} aria-pressed={on}>
              <span style={{ fontSize: 16 }}>{on ? '✓' : '＋'}</span>
              <span>{EQUIPMENT_KO[k]}</span>
              <span style={ui.spacer} />
              {/* 이미 가진 기구에 "+0개"를 띄우면 잔소리로 읽힌다. 안 가진 것만 보여준다. */}
              {!on && gains[k] > 0 && (
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue)' }}>+{gains[k]}개</span>
              )}
            </button>
            {on && opts && (
              <div style={{ padding: '8px 6px 2px' }}>
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
            )}
          </div>
        );
      })}
    </div>
  );
}
