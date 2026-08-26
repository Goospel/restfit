import { useMemo } from 'react';

import { EQUIPMENT, EXERCISES, type EquipKey } from '../data/exercises';
import { EQUIPMENT_KO } from '../data/labels';
import { unlockGain } from '../logic/equipment';
import { pickStyle, ui } from '../ui';

/** 해금 수치는 **근력만** 센다. 스트레칭까지 넣으면 맨몸 기준이 부풀어 배수가 무너진다. */
const STRENGTH = EXERCISES.filter((e) => e.category === 'strength');

/**
 * 보유 기구 체크 목록.
 *
 * 온보딩 1단계와 기구 탭이 **같은 목록**을 쓴다 — 둘이 갈라지면 온보딩에서 고른 것과
 * 탭에서 보이는 것이 달라 보인다.
 */
export function EquipmentPicker({ owned, onChange }: { owned: EquipKey[]; onChange: (next: EquipKey[]) => void }) {
  const gains = useMemo(
    () => Object.fromEntries(EQUIPMENT.map((k) => [k, unlockGain(STRENGTH, owned, k).gain])) as Record<EquipKey, number>,
    [owned],
  );

  const toggle = (k: EquipKey) => onChange(owned.includes(k) ? owned.filter((x) => x !== k) : [...owned, k]);

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {EQUIPMENT.map((k) => {
        const on = owned.includes(k);
        return (
          <button key={k} style={pickStyle(on)} onClick={() => toggle(k)} aria-pressed={on}>
            <span style={{ fontSize: 16 }}>{on ? '✓' : '＋'}</span>
            <span>{EQUIPMENT_KO[k]}</span>
            <span style={ui.spacer} />
            {/* 이미 가진 기구에 "+0개"를 띄우면 잔소리로 읽힌다. 안 가진 것만 보여준다. */}
            {!on && gains[k] > 0 && (
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue)' }}>+{gains[k]}개</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
