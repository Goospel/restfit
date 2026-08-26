import { GOAL_KEYS, GOALS, type Goal } from '../logic/goal';
import { goalStyle } from '../ui';
import { Icon } from './Icon';

/**
 * 운동 목적 선택.
 *
 * **숫자를 미리 보여준다** — 고른 뒤에 반복이 20회로 바뀌면 사람은 이유를 모른다.
 * 온보딩 2단계와 기구 탭의 목적 변경이 같은 컴포넌트를 쓴다.
 */
export function GoalPicker({ value, onChange }: { value: Goal | null; onChange: (goal: Goal) => void }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {GOAL_KEYS.map((k) => {
        const g = GOALS[k];
        const on = value === k;
        return (
          <button key={k} style={goalStyle(on)} onClick={() => onChange(k)} aria-pressed={on}>
            <span style={{ color: on ? 'var(--blue)' : 'var(--text-sub)', display: 'flex' }}>
              <Icon name={g.icon} size={28} />
            </span>
            <span style={{ display: 'grid', gap: 2, textAlign: 'left', minWidth: 0 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: on ? 'var(--blue-dark)' : 'var(--text)' }}>
                {g.label}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-sub)' }}>{g.desc}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: on ? 'var(--blue)' : 'var(--text-weak)' }}>
                {g.reps[0]}~{g.reps[1]}회 · 휴식 {g.restIsolation}~{g.restCompound}초 · 최대 {g.exerciseCount}종목
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
