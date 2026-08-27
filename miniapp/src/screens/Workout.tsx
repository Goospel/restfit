import { useEffect, useRef, useState } from 'react';

import { awaitAdEvent } from '../adProbe';
import { ExerciseImage } from '../components/ExerciseImage';
import { Icon } from '../components/Icon';
import type { Unit } from '../data/exercises';
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
import { adPlan, AD_GROUP_ID, nextAdState, type AdState } from '../logic/adPlan';
import { defaultWeightFor, type EquipSpec } from '../logic/equipSpec';
import { midReps } from '../logic/goal';
import { EXPERIENCE_KEYS, FEEL_KEYS, FEEL_LABEL, nextExperience, type Feel, type Profile } from '../logic/profile';
import { lastSetOf, recentFeels, type WorkoutRecord } from '../storage';
import { mmss, specChipStyle, ui } from '../ui';

/** 승급 안내. 이미 반영된 사실을 알릴 뿐이다 — 「올려 드릴까요?」로 물으면 탭이 하나 더 는다. */
const NOTE_UP = '다음부터 조금 더 어려운 동작을 드릴게요.';

/**
 * 강등 안내. **부드러워야 한다.**
 *
 * 「너무 어려웠나 봐요」처럼 사용자를 주어로 두면 실패 통보로 읽힌다. 힘들다고 답한 것은
 * 앱이 원한 정직한 답인데, 그 답의 보상이 지적이면 다음부터 아무도 안 누른다.
 */
const NOTE_DOWN = '다음부터 조금 가볍게 드릴게요.';

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
  profile,
  onProfileChange,
}: {
  session: Session;
  /** 이 세션의 유닛(상체/하체). 루틴이 한 유닛으로 뽑히므로 세션 전체에 하나다. 기록에 그대로 남는다. */
  group: Unit;
  onChange: (s: Session) => void;
  onFinish: (rec: WorkoutRecord | null) => void;
  history: WorkoutRecord[];
  /** 보유 기구 상세. 처음 하는 운동의 무게를 0 대신 여기서 채운다. */
  spec: EquipSpec;
  date: string;
  /** `null`이면 승급·강등을 아예 안 돌린다 — 피드백은 받아 두되 옮길 값이 없다. */
  profile: Profile | null;
  onProfileChange: (p: Profile) => void;
}) {
  const s = session;
  const current = s.exercises[s.index];
  /** 오늘의 체감. **선택 사항이라 `undefined`가 기본이자 정상값이다.** */
  const [feel, setFeel] = useState<Feel | undefined>(undefined);
  const [weight, setWeight] = useState('0');
  const [reps, setReps] = useState('10');
  const [now, setNow] = useState(() => Date.now());
  // 광고 상태는 **세션 안에서만** 산다. 앱을 껐다 켜면 새 세션이니 백오프도 처음부터가 맞다.
  // 화면에 그릴 값이 아니므로 ref다 — state로 두면 광고 판단이 리렌더를 부른다.
  const adState = useRef<AdState>({ noFillStreak: 0, slotsSinceLastTry: 0 });

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

  /**
   * 휴식이 시작되면 광고를 튼다. **이 앱이 돈을 버는 유일한 지점이다.**
   *
   * 규율 셋을 지킨다:
   * - **타이머를 건드리지 않는다.** `restEndsAt`이 절대 시각이라 광고를 보는 동안에도 휴식은
   *   그대로 흐른다. 광고가 시간을 늘리면 그건 사용자에게서 훔치는 것이다.
   * - **실패는 조용히 넘어간다.** 광고는 수익이지 기능이 아니다 — 에러를 사용자에게 보이지 않는다.
   * - **판단은 `adPlan`에만 맡긴다.** 여기서 조건을 덧붙이면 규칙이 두 곳으로 갈라진다.
   */
  useEffect(() => {
    if (!resting) return;
    const decision = adPlan(restRemaining(s, Date.now()), adState.current);
    if (!decision.show) {
      adState.current = nextAdState(adState.current, 'skipped');
      return;
    }
    // ref만 갱신하므로 언마운트 뒤에 끝나도 안전하다. 취소 플래그를 두면 노출 성공이
    // 상태에 안 남아 다음 슬롯의 백오프 판단이 틀어진다.
    void (async () => {
      try {
        // SDK는 토스 앱 안에서만 있다. 브라우저 개발 중에는 여기서 실패하고 앱은 그대로 돈다.
        const m = await import('@apps-in-toss/web-framework');
        const opts = { options: { adGroupId: AD_GROUP_ID } };
        const loaded = await awaitAdEvent((h) => m.loadFullScreenAd({ ...opts, ...h }), {
          resolveOn: ['loaded'],
          timeoutMs: 15000,
        });
        if (!loaded.ok) {
          adState.current = nextAdState(adState.current, 'noFill');
          return;
        }
        const shown = await awaitAdEvent((h) => m.showFullScreenAd({ ...opts, ...h }), {
          resolveOn: ['impression', 'dismissed'],
          timeoutMs: 90000,
        });
        adState.current = nextAdState(adState.current, shown.ok ? 'shown' : 'noFill');
      } catch {
        adState.current = nextAdState(adState.current, 'noFill');
      }
    })();
  }, [resting]);

  const left = restRemaining(s, now);

  // 휴식이 끝나면 자동으로 다음 세트로 넘어간다. 타이머의 존재 이유다.
  useEffect(() => {
    if (resting && left === 0) onChange(endRest(s));
  }, [resting, left]);

  /**
   * 지금까지 한 것을 기록으로 만든다. 한 세트도 안 했으면 남기지 않는다.
   *
   * `feel`은 **고른 경우에만** 넣는다 — 키를 `undefined`로 박아 두면 저장된 JSON에
   * 「모른다」와 「안 골랐다」의 구분이 남지 않는다.
   */
  function toRecord(): WorkoutRecord | null {
    const entries = s.exercises
      .map((e, i) => ({ id: e.id, name: e.name, sets: s.done[i] }))
      .filter((e) => e.sets.length > 0);
    if (entries.length === 0) return null;
    return { date, group, entries, ...(feel ? { feel } : null) };
  }

  // ── 완료
  if (s.finished) {
    const total = s.done.reduce((n, sets) => n + sets.length, 0);
    /**
     * 승급·강등 판정. **오늘 것이 아직 기록에 없으니 맨 앞에 얹어서 본다.**
     *
     * 화면에 보여 줄 값과 실제로 저장할 값을 **여기서 한 번만** 구한다 — 두 번 계산하면
     * 안내 문구와 저장 결과가 갈라지는 날이 온다.
     *
     * ⚠️ 프로필이 없으면 판정 자체를 안 한다. 여기서 프로필을 대신 만들면 「경험을 안 고른
     * 사람」이 조용히 사라져, 온보딩 안내 칩도 함께 증발한다(설계 §3.6 · 반쪽 프로필 금지).
     *
     * ⚠️ **오늘 답이 목록의 맨 앞이다.** 끝에 붙이면 정반대가 된다 — 직전 3세션이 쉬웠던
     * 사람이 오늘 「힘듦」을 골랐는데 승급한다.
     *
     * ⚠️ **`total > 0`이 여기에 있어야 한다.** 「기록이 남는 세션만 판정한다」를 반영하는
     * 쪽(`save`)에만 걸면 조건이 둘로 갈라져, 전 종목을 건너뛴 사람이 「어려운 동작을
     * 드릴게요」를 읽고도 아무 일이 안 일어난다(리뷰가 실측). 문구와 반영은 한 값에서 나온다.
     */
    const judged = profile && total > 0 ? nextExperience(profile.experience, [feel, ...recentFeels(history)]) : null;
    const moved = judged && judged !== profile!.experience ? judged : null;

    function save() {
      // `moved`가 이미 「기록이 남는 세션인가」까지 담고 있다 — 여기서 조건을 덧붙이면 갈라진다.
      if (moved && profile) onProfileChange({ ...profile, experience: moved });
      onFinish(toRecord());
    }

    return (
      <main style={ui.pageFull}>
        <div style={{ ...ui.spacer, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          <div>
            <div style={{ color: 'var(--blue)', display: 'flex', justifyContent: 'center' }}>
              <Icon name="plate" size={48} />
            </div>
            <h1 style={{ ...ui.h1, marginBottom: 4 }}>운동 완료</h1>
            <p style={ui.sub}>
              {s.exercises.length}개 운동 · {total}세트
            </p>
          </div>
        </div>

        {/* 1문항. **건너뛸 수 있어야 한다** — 필수로 만들면 응답률이 아니라 기록 저장률이 깎인다. */}
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <p style={{ ...ui.sub, marginBottom: 8 }}>오늘 운동 어땠나요?</p>
          <div style={{ ...ui.row, justifyContent: 'center' }}>
            {FEEL_KEYS.map((k) => (
              <button
                key={k}
                style={{ ...specChipStyle(feel === k), flex: 1, maxWidth: 110, padding: '11px 0' }}
                aria-pressed={feel === k}
                // 다시 누르면 풀린다 — 잘못 누른 답을 되돌릴 길이 없으면 틀린 답이 그대로 저장된다.
                onClick={() => setFeel(feel === k ? undefined : k)}
              >
                {FEEL_LABEL[k]}
              </button>
            ))}
          </div>
          {moved && (
            <p style={{ ...ui.sub, margin: '10px 0 0', color: 'var(--blue-dark)' }}>
              {/* ⚠️ 사다리 위·아래는 **인덱스로** 가른다. 문자열 비교는 'advanced' < 'beginner'라
                  알파벳 순서가 난이도 순서를 뒤집어, 승급에 강등 문구가 뜬다. */}
              {EXPERIENCE_KEYS.indexOf(moved) > EXPERIENCE_KEYS.indexOf(profile!.experience) ? NOTE_UP : NOTE_DOWN}
            </p>
          )}
        </div>

        <button style={ui.primary} onClick={save}>
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
