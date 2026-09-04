import { useState } from 'react';

import { AvoidPicker } from '../components/AvoidPicker';
import { EquipmentPicker } from '../components/EquipmentPicker';
import { GoalPicker } from '../components/GoalPicker';
import type { EquipKey } from '../data/exercises';
import type { EquipSpec } from '../logic/equipSpec';
import type { Goal } from '../logic/goal';
import type { AvoidArea, Experience, Profile } from '../logic/profile';
import { goalStyle, ui } from '../ui';

/**
 * 첫 진입 온보딩. **기구 → 몸 상태 → 목적 세 단계.**
 *
 * 탭바를 일부러 그리지 않는다 — 흐름 도중에 빠져나갈 곳을 주면 목적이 비어 있는 채로
 * 앱을 쓰게 되고, 그 상태를 화면마다 따로 처리해야 한다.
 *
 * 기구는 **건너뛸 수 있다.** 맨몸 운동만으로도 루틴이 성립하는데 기구 선택을 막으면
 * 아무것도 없는 사람이 첫 화면에서 멈춘다. 목적은 건너뛸 수 없다 — 이 값이 null이면
 * 온보딩이 끝나지 않은 것으로 판정하기 때문이다. 경험도 건너뛸 수 없다 — 안 받으면
 * 이 단계를 낀 이유 자체가 사라진다. 불편 부위는 「없음」이 기본이라 안 건드려도 넘어간다.
 *
 * ⚠️ 몸 상태를 **목적 앞**에 둔다. 마지막 버튼이 「오늘의 루틴 보기」라 그 뒤에 화면이
 * 하나 더 남으면 온보딩이 안 끝난 것처럼 읽힌다.
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
  onDone: (goal: Goal, profile: Profile) => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [experience, setExperience] = useState<Experience | null>(null);
  const [avoid, setAvoid] = useState<AvoidArea[]>([]);

  return (
    <main style={{ ...ui.pageFull, paddingBottom: 0 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            data-progress-step={i}
            style={{ flex: 1, height: 4, borderRadius: 999, background: i <= step ? 'var(--accent)' : 'var(--line)' }}
          />
        ))}
      </div>

      {step === 1 && (
        <>
          <h1 style={{ ...ui.h1, margin: '0 0 8px' }}>집에 어떤 기구가 있나요?</h1>
          <p style={{ ...ui.sub, fontSize: 14, marginBottom: 20 }}>
            고른 기구로 할 수 있는 운동만 루틴에 나옵니다. 하나도 없어도 맨몸 운동으로 시작할 수 있어요.
          </p>
          <EquipmentPicker owned={owned} spec={spec} onChange={onOwnedChange} onSpecChange={onSpecChange} />
          <div style={ui.spacer} />
          <div style={ui.stickyFooter}>
            <button style={ui.primary} onClick={() => setStep(2)}>
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
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h1 style={{ ...ui.h1, margin: '0 0 8px' }}>요즘 몸 상태는 어떤가요?</h1>
          <p style={{ ...ui.sub, fontSize: 14, marginBottom: 20 }}>
            지금 몸에 맞는 난이도로 골라 드리려고 묻습니다. 나중에 설정에서 바꿀 수 있어요.
          </p>

          {/* 질문을 그대로 쓴다 — 「초급/중급」을 고르라고 하면 기준이 사람마다 달라진다.
              6개월·주 2회는 ACSM 분류 경계라, 질문 하나로 그 경계를 그대로 물을 수 있다. */}
          <p style={{ ...ui.h2, marginBottom: 10 }}>최근 6개월, 주 2회 이상 꾸준히 운동했나요?</p>
          <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
            {EXPERIENCE_ANSWERS.map(([label, value]) => {
              const on = experience === value;
              return (
                <button
                  key={value}
                  style={{ ...goalStyle(on), flex: 1, justifyContent: 'center', textAlign: 'center' }}
                  aria-pressed={on}
                  onClick={() => setExperience(value)}
                >
                  <span style={{ fontSize: 16, fontWeight: 700, color: on ? 'var(--accent-strong)' : 'var(--text)' }}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>

          <p style={{ ...ui.h2, marginBottom: 10 }}>요즘 불편한 부위가 있나요?</p>
          <AvoidPicker value={avoid} onChange={setAvoid} />

          <div style={ui.spacer} />
          <div style={ui.stickyFooter}>
            <button
              style={{ ...ui.primary, ...(experience ? null : ui.disabled) }}
              disabled={!experience}
              onClick={() => setStep(3)}
            >
              다음
            </button>
            <button style={{ ...ui.ghost, width: '100%', marginTop: 4 }} onClick={() => setStep(1)}>
              뒤로
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <h1 style={{ ...ui.h1, margin: '0 0 8px' }}>어떤 목적으로 운동하세요?</h1>
          <p style={{ ...ui.sub, fontSize: 14, marginBottom: 20 }}>
            목적에 따라 반복 횟수와 휴식 길이가 달라집니다. 나중에 기구 탭에서 바꿀 수 있어요.
          </p>
          <GoalPicker value={goal} onChange={setGoal} />
          <div style={ui.spacer} />
          <div style={ui.stickyFooter}>
            <button
              style={{ ...ui.primary, ...(goal ? null : ui.disabled) }}
              disabled={!goal}
              // experience는 2단계를 통과한 시점에 반드시 차 있다. 그래도 여기서 한 번 더
              // 확인하는 이유는 타입이 아니라 흐름을 지키기 위해서다 — 단계를 건너뛰는
              // 경로가 생기면 프로필이 반쪽으로 저장되느니 안 넘어가는 편이 낫다.
              onClick={() => goal && experience && onDone(goal, { experience, avoid })}
            >
              오늘의 루틴 보기
            </button>
            <button style={{ ...ui.ghost, width: '100%', marginTop: 4 }} onClick={() => setStep(2)}>
              뒤로
            </button>
          </div>
        </>
      )}
    </main>
  );
}

/**
 * 예/아니요가 곧 중급/초급이다.
 *
 * ⚠️ **「예」로 상급이 나오지 않는다.** 상급은 세션 피드백 누적 승급으로만 닿는 값이라,
 * 질문 하나로는 중급까지가 정직한 상한이다(`logic/profile.ts`).
 */
const EXPERIENCE_ANSWERS: readonly [string, Experience][] = [
  ['예', 'intermediate'],
  ['아니요', 'beginner'],
];
