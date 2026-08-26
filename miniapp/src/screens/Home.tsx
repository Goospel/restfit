import { ExerciseImage } from '../components/ExerciseImage';
import { GROUP_KO, MUSCLE_KO } from '../data/labels';
import { GOALS, type Goal } from '../logic/goal';
import { restSecondsFor, SETS_PER_EXERCISE } from '../logic/session';
import type { Routine } from '../logic/routine';
import { lastSetOf, type WorkoutRecord } from '../storage';
import { ui } from '../ui';

/** 세트 하나에 걸리는 대략의 시간(초). 예상 시간 계산에만 쓴다. */
const WORK_SECONDS = 40;

/**
 * 오늘의 루틴.
 *
 * 루틴은 **날짜로 고정**된다(`pickRoutine`의 seed가 날짜다). 같은 날 앱을 다시 열어도
 * 목록이 그대로라, 하다 만 운동을 잃지 않는다.
 */
export function Home({
  routine,
  history,
  goal,
  doneToday,
  onStart,
  onGoEquipment,
}: {
  routine: Routine;
  history: WorkoutRecord[];
  /** 반복·휴식·종목 수를 정한 목적. 화면에 계속 띄워야 왜 이 숫자인지가 설명된다. */
  goal: Goal;
  doneToday: boolean;
  onStart: () => void;
  onGoEquipment: () => void;
}) {
  if (!routine.group || routine.exercises.length === 0) {
    return (
      <main style={ui.page}>
        <h1 style={ui.h1}>오늘의 루틴</h1>
        <div style={ui.empty}>
          <p>할 수 있는 운동을 찾지 못했습니다.</p>
          <p style={{ fontSize: 13 }}>보유 기구를 확인해 주세요.</p>
        </div>
        <button style={ui.secondary} onClick={onGoEquipment}>
          보유 기구 설정
        </button>
      </main>
    );
  }

  const totalSec = routine.exercises.reduce(
    (sum, e) => sum + SETS_PER_EXERCISE * (WORK_SECONDS + restSecondsFor(e, goal)),
    0,
  );

  return (
    <main style={ui.page}>
      {/*
       * 앱 이름이 던진 질문에 앱이 직접 답한다. **응원이 아니라 동의다** — 어렵다고 인정한 뒤
       * 제일 어려운 부분(뭘 할지 정하기)을 대신 해놨다고 말한다. 이 앱이 실제로 하는 일이 그거다.
       *
       * 기록이 없을 때만 뜬다. 매일 보이면 농담이 아니라 잔소리가 된다.
       */}
      {history.length === 0 && (
        <div style={{ ...ui.card, marginBottom: 20, lineHeight: 1.6 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>네, 어렵습니다.</div>
          <div style={{ fontSize: 14, color: 'var(--text-sub)', marginTop: 4 }}>
            제일 어려운 건 뭘 할지 정하는 거고, 그건 정해뒀습니다. 아래대로만 하시면 됩니다.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 20px' }}>
        <h1 style={{ ...ui.h1, margin: 0 }}>
          오늘은 <span style={{ color: 'var(--blue)' }}>{GROUP_KO[routine.group]}</span>
        </h1>
        <span style={ui.spacer} />
        {/* 목적을 계속 띄운다 — 왜 15회·45초인지가 이 칩으로 설명된다. */}
        <button style={{ ...ui.chip, color: 'var(--blue-dark)', background: '#eff6ff', borderColor: 'var(--blue)' }} onClick={onGoEquipment}>
          {GOALS[goal].icon} {GOALS[goal].label}
        </button>
      </div>
      <p style={ui.sub}>
        {routine.exercises.length}개 운동 · 각 {SETS_PER_EXERCISE}세트 · 약 {Math.round(totalSec / 60)}분
        {doneToday && ' · 오늘 완료함'}
      </p>

      <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
        {routine.exercises.map((e, i) => {
          const last = lastSetOf(history, e.id);
          return (
            <div key={e.id} style={{ ...ui.card, display: 'flex', gap: 12, alignItems: 'center', padding: 12 }}>
              <ExerciseImage path={e.images[0]} name={e.name} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--text-weak)' }}>{i + 1}번째</div>
                <div style={{ ...ui.h2, fontSize: 16 }}>{e.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>
                  {e.primaryMuscles.map((m) => MUSCLE_KO[m] ?? m).join(' · ')}
                  {` · ${GOALS[goal].reps[0]}~${GOALS[goal].reps[1]}회 · 휴식 ${restSecondsFor(e, goal)}초`}
                </div>
                {last && (
                  <div style={{ fontSize: 12, color: 'var(--text-weak)' }}>
                    지난번 {last.weight > 0 ? `${last.weight}kg × ` : ''}
                    {last.reps}회
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <button style={ui.primary} onClick={onStart}>
        {doneToday ? '한 번 더 하기' : '운동 시작'}
      </button>
    </main>
  );
}
