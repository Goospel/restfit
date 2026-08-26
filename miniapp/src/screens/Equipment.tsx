import { useMemo } from 'react';

import { EquipmentPicker } from '../components/EquipmentPicker';
import { GoalPicker } from '../components/GoalPicker';
import { EXERCISES, type EquipKey } from '../data/exercises';
import { filterByEquipment } from '../logic/equipment';
import type { Goal } from '../logic/goal';
import { ui } from '../ui';

/** 해금 수치는 **근력만** 센다. 스트레칭까지 넣으면 맨몸 기준이 부풀어 배수가 무너진다. */
const STRENGTH = EXERCISES.filter((e) => e.category === 'strength');

/**
 * 보유 기구 등록 + 운동 목적 변경.
 *
 * 체크 하나하나가 곧 **할 수 있는 운동 수**로 보이게 했다. Phase 4에서 여기에 쉐어링크가 붙는데,
 * 그때 설득력은 "이거 사세요"가 아니라 **"+95개"라는 숫자**에서 나온다.
 *
 * 목적을 여기 둔 이유: 온보딩 뒤에 바꿀 자리가 필요한데, **기구와 목적은 둘 다 「내 조건」**이라
 * 성격이 같다. 별도 설정 탭을 만들면 탭 하나를 위해 화면 하나가 더 생긴다.
 */
export function Equipment({
  owned,
  onChange,
  goal,
  onGoalChange,
}: {
  owned: EquipKey[];
  onChange: (next: EquipKey[]) => void;
  goal: Goal;
  onGoalChange: (goal: Goal) => void;
}) {
  const available = useMemo(() => filterByEquipment(STRENGTH, owned).length, [owned]);

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

      <EquipmentPicker owned={owned} onChange={onChange} />

      <p style={{ ...ui.sub, marginTop: 16, marginBottom: 0 }}>
        맨몸 운동은 기구 없이도 나옵니다. 아무것도 안 골라도 오늘 운동은 할 수 있어요.
      </p>

      <h1 style={{ ...ui.h1, marginTop: 32 }}>운동 목적</h1>
      <p style={ui.sub}>바꾸면 오늘의 루틴에 바로 반영됩니다. 반복 횟수와 휴식 길이가 달라져요.</p>
      <GoalPicker value={goal} onChange={onGoalChange} />
    </main>
  );
}
