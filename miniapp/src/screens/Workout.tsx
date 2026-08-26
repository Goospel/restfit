import { useEffect, useState } from 'react';

import { ExerciseImage } from '../components/ExerciseImage';
import type { MuscleGroup } from '../data/exercises';
import { MUSCLE_KO } from '../data/labels';
import {
  completeSet,
  endRest,
  progress,
  restRemaining,
  SETS_PER_EXERCISE,
  skipExercise,
  type Session,
} from '../logic/session';
import { defaultWeightFor, type EquipSpec } from '../logic/equipSpec';
import { midReps } from '../logic/goal';
import { lastSetOf, type WorkoutRecord } from '../storage';
import { mmss, ui } from '../ui';

/**
 * 운동 진행. **제품의 심장이다.**
 *
 * Phase 3에서 휴식 구간에 광고가 붙는다. 지금은 **일부러 광고 없이** 완성한다 —
 * 광고가 없어도 앱이 온전해야 광고가 실패했을 때도 온전하다.
 *
 * 남은 시간은 매 틱마다 빼는 게 아니라 **종료 시각에서 역산**한다.
 * 카운터를 깎는 방식은 백그라운드에서 타이머가 스로틀되면 그만큼 느려진다(글로벌 CLAUDE.md 함정 ①).
 */
export function Workout({
  session,
  group,
  onChange,
  onFinish,
  history,
  spec,
  date,
}: {
  session: Session;
  /** 이 세션의 부위. 루틴이 한 부위로 뽑히므로 세션 전체에 하나다. 기록에 그대로 남는다. */
  group: MuscleGroup;
  onChange: (s: Session) => void;
  onFinish: (rec: WorkoutRecord | null) => void;
  history: WorkoutRecord[];
  /** 보유 기구 상세. 처음 하는 운동의 무게를 0 대신 여기서 채운다. */
  spec: EquipSpec;
  date: string;
}) {
  const s = session;
  const current = s.exercises[s.index];
  const [weight, setWeight] = useState('0');
  const [reps, setReps] = useState('10');
  const [now, setNow] = useState(() => Date.now());

  // 운동이 바뀌면 지난번 기록으로 채워 둔다 — 매번 처음부터 입력하게 두면 기록을 안 남긴다.
  useEffect(() => {
    if (!current) return;
    const last = lastSetOf(history, current.id);
    // 처음 하는 운동이면 보유 무게 구간의 대표값으로 채운다. 모른다고 답했으면 0 — 아는 척하지 않는다.
    setWeight(String(last?.weight ?? defaultWeightFor(current.requires, spec)));
    // 직전 기록이 없으면 목적의 권장 반복으로 채운다 — 12~20회를 권해 놓고 10이 떠 있으면 모순이다.
    setReps(String(last?.reps ?? midReps(s.goal)));
  }, [current?.id, history, s.goal, spec]);

  // 휴식 중일 때만 시계를 돌린다.
  const resting = s.restEndsAt !== null;
  useEffect(() => {
    if (!resting) return;
    // 먼저 한 번 맞춘다 — `now`는 마지막 휴식 때 멈춰 있어서, 안 맞추면 휴식이 시작된 순간
    // 그 사이에 흐른 시간만큼 남은 시간이 부풀어 보인다(첫 틱까지 250ms 동안).
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [resting]);

  const left = restRemaining(s, now);

  // 휴식이 끝나면 자동으로 다음 세트로 넘어간다. 타이머의 존재 이유다.
  useEffect(() => {
    if (resting && left === 0) onChange(endRest(s));
  }, [resting, left]);

  /** 지금까지 한 것을 기록으로 만든다. 한 세트도 안 했으면 남기지 않는다. */
  function toRecord(): WorkoutRecord | null {
    const entries = s.exercises
      .map((e, i) => ({ id: e.id, name: e.name, sets: s.done[i] }))
      .filter((e) => e.sets.length > 0);
    if (entries.length === 0) return null;
    return { date, group, entries };
  }

  // ── 완료
  if (s.finished) {
    const total = s.done.reduce((n, sets) => n + sets.length, 0);
    return (
      <main style={ui.pageFull}>
        <div style={{ ...ui.spacer, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: 48 }}>💪</div>
            <h1 style={{ ...ui.h1, marginBottom: 4 }}>운동 완료</h1>
            <p style={ui.sub}>
              {s.exercises.length}개 운동 · {total}세트
            </p>
          </div>
        </div>
        <button style={ui.primary} onClick={() => onFinish(toRecord())}>
          기록 저장하고 끝내기
        </button>
      </main>
    );
  }

  const p = progress(s);

  // ── 휴식
  if (resting) {
    const nextIsNewExercise = s.done[s.index].length >= SETS_PER_EXERCISE;
    const next = nextIsNewExercise ? s.exercises[s.index + 1] : current;
    const nextSetNo = nextIsNewExercise ? 1 : s.done[s.index].length + 1;

    return (
      <main style={{ ...ui.pageFull, background: 'var(--bg-sub)' }}>
        <div style={{ ...ui.spacer, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 4 }}>휴식</div>
            <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: -3, fontVariantNumeric: 'tabular-nums' }}>
              {mmss(left)}
            </div>
            {next && (
              <div style={{ marginTop: 20, fontSize: 15, color: 'var(--text-sub)' }}>
                다음 · <b style={{ color: 'var(--text)' }}>{next.name}</b> {nextSetNo}세트
              </div>
            )}
          </div>
        </div>
        <button style={ui.secondary} onClick={() => onChange(endRest(s))}>
          휴식 건너뛰기
        </button>
      </main>
    );
  }

  // ── 세트 진행
  const last = lastSetOf(history, current.id);
  const bodyweight = current.requires.length === 0;
  const repsNum = Number(reps);
  const valid = Number.isFinite(repsNum) && repsNum > 0;

  return (
    <main style={ui.pageFull}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <span style={ui.chip}>
          운동 {p.exerciseNo}/{p.totalExercises}
        </span>
        <span style={ui.spacer} />
        <button style={ui.ghost} onClick={() => onFinish(toRecord())}>
          그만두기
        </button>
      </div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 20 }}>
        <ExerciseImage path={current.images[0]} name={current.name} size={88} />
        <div style={{ minWidth: 0 }}>
          <h1 style={{ ...ui.h1, fontSize: 20, margin: '0 0 4px' }}>{current.name}</h1>
          <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>
            {current.primaryMuscles.map((m) => MUSCLE_KO[m] ?? m).join(' · ')}
          </div>
        </div>
      </div>

      <div style={{ ...ui.card, marginBottom: 16 }}>
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 28, fontWeight: 800 }}>{p.setNo}</span>
          <span style={{ fontSize: 16, color: 'var(--text-sub)' }}> / {p.totalSets}세트</span>
          {last && (
            <div style={{ fontSize: 13, color: 'var(--text-weak)', marginTop: 2 }}>
              지난번 {last.weight > 0 ? `${last.weight}kg × ` : ''}
              {last.reps}회
            </div>
          )}
        </div>

        <div style={ui.row}>
          {!bodyweight && (
            <label style={{ flex: 1 }}>
              <span style={ui.label}>무게 (kg)</span>
              <input
                style={ui.input}
                type="number"
                inputMode="decimal"
                min={0}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </label>
          )}
          <label style={{ flex: 1 }}>
            <span style={ui.label}>횟수</span>
            <input
              style={ui.input}
              type="number"
              inputMode="numeric"
              min={1}
              value={reps}
              onChange={(e) => setReps(e.target.value)}
            />
          </label>
        </div>
      </div>

      <button
        style={{ ...ui.primary, ...(valid ? null : ui.disabled) }}
        disabled={!valid}
        onClick={() => onChange(completeSet(s, { weight: bodyweight ? 0 : Number(weight) || 0, reps: repsNum }, Date.now()))}
      >
        세트 완료
      </button>
      <button style={{ ...ui.ghost, width: '100%', marginTop: 4 }} onClick={() => onChange(skipExercise(s))}>
        이 운동 건너뛰기
      </button>
    </main>
  );
}
