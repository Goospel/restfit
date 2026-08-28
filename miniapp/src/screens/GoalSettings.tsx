import { AvoidPicker } from '../components/AvoidPicker';
import { GoalPicker } from '../components/GoalPicker';
import type { Goal } from '../logic/goal';
import { EXPERIENCE_KEYS, EXPERIENCE_LABEL, type Profile } from '../logic/profile';
import { goalStyle, ui } from '../ui';

/**
 * 운동 목적 — 목적 + 경험 + 불편한 부위.
 *
 * 셋을 한 페이지에 둔 이유: **루틴을 몸에 맞추는 같은 축**이다. 목적이 횟수·휴식을,
 * 경험이 난이도를, 부위가 제외를 정한다. 기구(무엇으로 하느냐)만 다른 축이라 갈라 나갔다.
 *
 * 입구는 홈의 목적 칩(「목적 · {현재 목적} ›」)과 개인화 유도 칩이다.
 */
export function GoalSettings({
  goal,
  onGoalChange,
  profile,
  onProfileChange,
  onBack,
}: {
  goal: Goal;
  onGoalChange: (goal: Goal) => void;
  /** `null`이면 이 화면이 생기기 전부터 쓰던 사람이다 — 아직 아무것도 안 물어봤다. */
  profile: Profile | null;
  onProfileChange: (next: Profile) => void;
  onBack: () => void;
}) {
  return (
    <main style={ui.page}>
      <div style={{ display: 'flex', alignItems: 'center', margin: '4px 0 20px' }}>
        <h1 style={{ ...ui.h1, margin: 0 }}>운동 목적</h1>
        <span style={ui.spacer} />
        <button style={ui.ghost} onClick={onBack}>
          닫기
        </button>
      </div>
      <p style={ui.sub}>바꾸면 오늘의 루틴에 바로 반영됩니다. 반복 횟수와 휴식 길이가 달라져요.</p>
      <GoalPicker value={goal} onChange={onGoalChange} />

      {/* 세 단계를 다 그린다. 「상급」은 온보딩 질문으로는 못 얻는 값이지만 세션 피드백
          누적으로 **승급해서 도달한다** — 여기 안 그리면 승급한 사람에게 자기 상태가
          안 보이고, 과했다 싶어도 되돌릴 자리가 없다. */}
      <h1 style={{ ...ui.h1, marginTop: 32 }}>운동 경험</h1>
      {/* PR 1에서는 이 문구를 못 썼다 — 그때는 값을 받아 저장만 했지 루틴에 안 먹여서
          「바로 반영됩니다」가 거짓이었다. 이제 `pickRoutine`이 실제로 읽으므로 사실이다. */}
      <p style={ui.sub}>바꾸면 오늘의 루틴에 바로 반영됩니다. 몸에 맞는 난이도부터 골라 드려요.</p>
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
