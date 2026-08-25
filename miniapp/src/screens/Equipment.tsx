import { useMemo } from 'react';

import { EQUIPMENT, EXERCISES, type EquipKey } from '../data/exercises';
import { EQUIPMENT_KO } from '../data/labels';
import { filterByEquipment, unlockGain } from '../logic/equipment';
import { pickStyle, ui } from '../ui';

/** 해금 수치는 **근력만** 센다. 스트레칭까지 넣으면 맨몸 기준이 부풀어 배수가 무너진다. */
const STRENGTH = EXERCISES.filter((e) => e.category === 'strength');

/**
 * 보유 기구 등록.
 *
 * 체크 하나하나가 곧 **할 수 있는 운동 수**로 보이게 했다. Phase 4에서 여기에 쉐어링크가 붙는데,
 * 그때 설득력은 "이거 사세요"가 아니라 **"+95개"라는 숫자**에서 나온다.
 */
export function Equipment({ owned, onChange }: { owned: EquipKey[]; onChange: (next: EquipKey[]) => void }) {
  const available = useMemo(() => filterByEquipment(STRENGTH, owned).length, [owned]);
  const gains = useMemo(
    () => Object.fromEntries(EQUIPMENT.map((k) => [k, unlockGain(STRENGTH, owned, k).gain])) as Record<EquipKey, number>,
    [owned],
  );

  const toggle = (k: EquipKey) => onChange(owned.includes(k) ? owned.filter((x) => x !== k) : [...owned, k]);

  return (
    <main style={ui.page}>
      <h1 style={ui.h1}>보유 기구</h1>
      <p style={ui.sub}>집에 있는 것만 고르세요. 고른 기구로 할 수 있는 운동만 루틴에 나옵니다.</p>

      <div style={{ ...ui.card, marginBottom: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>지금 할 수 있는 근력 운동</div>
        <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1 }}>
          {available}
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-sub)' }}>개</span>
        </div>
      </div>

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

      <p style={{ ...ui.sub, marginTop: 16, marginBottom: 0 }}>
        맨몸 운동은 기구 없이도 나옵니다. 아무것도 안 골라도 오늘 운동은 할 수 있어요.
      </p>
    </main>
  );
}
