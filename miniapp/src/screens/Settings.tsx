import { useMemo } from 'react';

import { EquipmentPicker } from '../components/EquipmentPicker';
import { GoalPicker } from '../components/GoalPicker';
import { EXERCISES, type EquipKey } from '../data/exercises';
import { filterByEquipment } from '../logic/equipment';
import { effectiveOwned, type EquipSpec } from '../logic/equipSpec';
import type { Goal } from '../logic/goal';
import { ui } from '../ui';

/** 해금 수치는 **근력만** 센다. 스트레칭까지 넣으면 맨몸 기준이 부풀어 배수가 무너진다. */
const STRENGTH = EXERCISES.filter((e) => e.category === 'strength');

/**
 * 내 조건 — 보유 기구 + 운동 목적.
 *
 * 체크 하나하나가 곧 **할 수 있는 운동 수**로 보이게 했다. 그 숫자가 기구 탭의 추천에도
 * 그대로 쓰인다 — 여기서 체크를 하나 켜면 저기 추천 목록이 바뀐다.
 *
 * 목적을 여기 함께 둔 이유: **기구와 목적은 둘 다 「내 조건」**이라 성격이 같다.
 * 탭이 아니라 홈의 목적 칩에서 열리는 전체화면이다 — 자주 여는 화면이 아니라 탭을 쓰기엔 아깝다.
 */
export function Settings({
  owned,
  spec,
  onChange,
  onSpecChange,
  goal,
  onGoalChange,
  onBack,
}: {
  owned: EquipKey[];
  spec: EquipSpec;
  onChange: (next: EquipKey[]) => void;
  onSpecChange: (next: EquipSpec) => void;
  goal: Goal;
  onGoalChange: (goal: Goal) => void;
  onBack: () => void;
}) {
  // 조절식 벤치를 고르면 인클라인 34개가 함께 열린다 — 숫자가 그 자리에서 늘어야 설득이 된다.
  const available = useMemo(() => filterByEquipment(STRENGTH, effectiveOwned(owned, spec)).length, [owned, spec]);

  return (
    <main style={ui.page}>
      <div style={{ display: 'flex', alignItems: 'center', margin: '4px 0 20px' }}>
        <h1 style={{ ...ui.h1, margin: 0 }}>보유 기구</h1>
        <span style={ui.spacer} />
        <button style={ui.ghost} onClick={onBack}>
          닫기
        </button>
      </div>
      <p style={ui.sub}>집에 있는 것만 고르세요. 고른 기구로 할 수 있는 운동만 루틴에 나옵니다.</p>

      <div style={{ ...ui.card, marginBottom: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>지금 할 수 있는 근력 운동</div>
        <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1 }}>
          {available}
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-sub)' }}>개</span>
        </div>
      </div>

      <EquipmentPicker owned={owned} spec={spec} onChange={onChange} onSpecChange={onSpecChange} />

      <p style={{ ...ui.sub, marginTop: 16, marginBottom: 0 }}>
        맨몸 운동은 기구 없이도 나옵니다. 아무것도 안 골라도 오늘 운동은 할 수 있어요.
      </p>

      <h1 style={{ ...ui.h1, marginTop: 32 }}>운동 목적</h1>
      <p style={ui.sub}>바꾸면 오늘의 루틴에 바로 반영됩니다. 반복 횟수와 휴식 길이가 달라져요.</p>
      <GoalPicker value={goal} onChange={onGoalChange} />
    </main>
  );
}
