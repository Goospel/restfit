import { useState } from 'react';

import { EquipmentPicker } from '../components/EquipmentPicker';
import { GoalPicker } from '../components/GoalPicker';
import type { EquipKey } from '../data/exercises';
import type { EquipSpec } from '../logic/equipSpec';
import type { Goal } from '../logic/goal';
import { ui } from '../ui';

/**
 * 첫 진입 온보딩. **기구 → 목적 두 단계.**
 *
 * 탭바를 일부러 그리지 않는다 — 흐름 도중에 빠져나갈 곳을 주면 목적이 비어 있는 채로
 * 앱을 쓰게 되고, 그 상태를 화면마다 따로 처리해야 한다.
 *
 * 기구는 **건너뛸 수 있다.** 맨몸 운동만으로도 루틴이 성립하는데 기구 선택을 막으면
 * 아무것도 없는 사람이 첫 화면에서 멈춘다. 목적은 건너뛸 수 없다 — 이 값이 null이면
 * 온보딩이 끝나지 않은 것으로 판정하기 때문이다.
 */
export function Onboarding({
  owned,
  spec,
  onOwnedChange,
  onSpecChange,
  onDone,
}: {
  owned: EquipKey[];
  spec: EquipSpec;
  onOwnedChange: (next: EquipKey[]) => void;
  onSpecChange: (next: EquipSpec) => void;
  onDone: (goal: Goal) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [goal, setGoal] = useState<Goal | null>(null);

  return (
    <main style={{ ...ui.pageFull, paddingBottom: 'calc(var(--safe-b) + 24px)' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
        {[1, 2].map((i) => (
          <div
            key={i}
            style={{ flex: 1, height: 4, borderRadius: 999, background: i <= step ? 'var(--blue)' : 'var(--line)' }}
          />
        ))}
      </div>

      {step === 1 ? (
        <>
          <h1 style={{ ...ui.h1, margin: '0 0 8px' }}>집에 어떤 기구가 있나요?</h1>
          <p style={{ ...ui.sub, fontSize: 14, marginBottom: 20 }}>
            고른 기구로 할 수 있는 운동만 루틴에 나옵니다. 하나도 없어도 맨몸 운동으로 시작할 수 있어요.
          </p>
          <EquipmentPicker owned={owned} spec={spec} onChange={onOwnedChange} onSpecChange={onSpecChange} />
          <div style={ui.spacer} />
          <button style={{ ...ui.primary, marginTop: 20 }} onClick={() => setStep(2)}>
            다음
          </button>
          <button
            style={{ ...ui.ghost, width: '100%', marginTop: 4 }}
            onClick={() => {
              onOwnedChange([]);
              // 기구를 비우면서 상세만 남기면 안 가진 기구의 무게가 유령으로 남는다.
              onSpecChange({});
              setStep(2);
            }}
          >
            기구가 하나도 없어요
          </button>
        </>
      ) : (
        <>
          <h1 style={{ ...ui.h1, margin: '0 0 8px' }}>어떤 목적으로 운동하세요?</h1>
          <p style={{ ...ui.sub, fontSize: 14, marginBottom: 20 }}>
            목적에 따라 반복 횟수와 휴식 길이가 달라집니다. 나중에 기구 탭에서 바꿀 수 있어요.
          </p>
          <GoalPicker value={goal} onChange={setGoal} />
          <div style={ui.spacer} />
          <button
            style={{ ...ui.primary, marginTop: 20, ...(goal ? null : ui.disabled) }}
            disabled={!goal}
            onClick={() => goal && onDone(goal)}
          >
            오늘의 루틴 보기
          </button>
          <button style={{ ...ui.ghost, width: '100%', marginTop: 4 }} onClick={() => setStep(1)}>
            뒤로
          </button>
        </>
      )}
    </main>
  );
}
