import { useMemo } from 'react';

import { AvoidPicker } from '../components/AvoidPicker';
import { EquipmentPicker } from '../components/EquipmentPicker';
import { GoalPicker } from '../components/GoalPicker';
import { EXERCISES, type EquipKey } from '../data/exercises';
import { filterByEquipment } from '../logic/equipment';
import { effectiveOwned, type EquipSpec } from '../logic/equipSpec';
import type { Goal } from '../logic/goal';
import { EXPERIENCE_KEYS, EXPERIENCE_LABEL, type Profile } from '../logic/profile';
import { goalStyle, ui } from '../ui';

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
  profile,
  onProfileChange,
  onBack,
}: {
  owned: EquipKey[];
  spec: EquipSpec;
  onChange: (next: EquipKey[]) => void;
  onSpecChange: (next: EquipSpec) => void;
  goal: Goal;
  onGoalChange: (goal: Goal) => void;
  /** `null`이면 이 화면이 생기기 전부터 쓰던 사람이다 — 아직 아무것도 안 물어봤다. */
  profile: Profile | null;
  onProfileChange: (next: Profile) => void;
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

      {/* 세 단계를 다 그린다. 「상급」은 온보딩 질문으로는 못 얻는 값이지만 세션 피드백
          누적으로 **승급해서 도달한다** — 여기 안 그리면 승급한 사람에게 자기 상태가
          안 보이고, 과했다 싶어도 되돌릴 자리가 없다. */}
      <h1 style={{ ...ui.h1, marginTop: 32 }}>운동 경험</h1>
      {/* ⚠️ 「바꾸면 오늘의 루틴에 바로 반영됩니다」라고 쓰지 않는다 — 목적과 달리 이 값은
          아직 루틴에 안 먹인다. 하는 일을 안 하는 문구는 그 자체로 버그다. */}
      <p style={ui.sub}>지금 몸에 맞는 난이도로 골라 드리려고 묻습니다.</p>
      <div style={{ display: 'grid', gap: 10 }}>
        {EXPERIENCE_KEYS.map((k) => {
          const on = profile?.experience === k;
          const { label, desc } = EXPERIENCE_LABEL[k];
          return (
            <button
              key={k}
              style={goalStyle(on)}
              aria-pressed={on}
              // 불편 부위는 그대로 들고 간다 — 한 축을 건드렸다고 다른 축이 조용히 풀리면 안 된다.
              onClick={() => onProfileChange({ experience: k, avoid: profile?.avoid ?? [] })}
            >
              <span style={{ display: 'grid', gap: 2, textAlign: 'left', minWidth: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: on ? 'var(--blue-dark)' : 'var(--text)' }}>
                  {label}
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-sub)' }}>{desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      <h1 style={{ ...ui.h1, marginTop: 32 }}>불편한 부위</h1>
      {/* 무엇을 하는지는 `AvoidPicker`의 두 줄이 말한다 — 여기서 또 쓰면 문구가 갈라진다.
          잠긴 이유만 덧붙인다: 경험 없이 부위만 저장할 길이 없다(프로필은 경험이 있어야
          성립한다). 여기서 아무 경험이나 대신 채우는 게 바로 「반쪽 프로필」이다. */}
      {!profile && <p style={ui.sub}>운동 경험을 먼저 골라 주세요.</p>}
      <AvoidPicker
        value={profile?.avoid ?? []}
        disabled={!profile}
        onChange={(avoid) => profile && onProfileChange({ ...profile, avoid })}
      />
    </main>
  );
}
