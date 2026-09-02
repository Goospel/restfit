import { Fragment, useEffect, useRef, useState } from 'react';

import { awaitAdEvent } from '../adProbe';
import { ExerciseImage } from '../components/ExerciseImage';
import { Icon } from '../components/Icon';
import type { Unit } from '../data/exercises';
import { loadInstructions } from '../data/instructions';
import { EQUIPMENT_KO, LEVEL_KO, MUSCLE_KO } from '../data/labels';
import {
  completeSet,
  endRest,
  isLastSet,
  progress,
  restRemaining,
  restSecondsFor,
  SETS_PER_EXERCISE,
  skipExercise,
  type Session,
} from '../logic/session';
import { adPlan, AD_GROUP_ID, AD_NOTICE_MS, nextAdState, type AdState } from '../logic/adPlan';
import { cueAt, warnColors } from '../logic/restCue';
import { playCue, primeSound } from '../restSound';
import { defaultWeightFor, type EquipSpec } from '../logic/equipSpec';
import { BODYWEIGHT_LADDER_REPS, GOALS, suggestNext } from '../logic/goal';
import { EXPERIENCE_KEYS, FEEL_KEYS, FEEL_LABEL, nextExperience, type Feel, type Profile } from '../logic/profile';
import { lastSetOf, lastSetsOf, recentFeels, type WorkoutRecord } from '../storage';
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
 * 횟수 입력칸 바로 아래 안내 한 자리 — 기구(목표 범위 이탈)와 맨몸(사다리)이 나눠 쓴다.
 * 색만 각자 얹는다. `keep-all`은 375px에서 어절 중간이 꺾이는 것을 막는다.
 */
const GUIDE: React.CSSProperties = { fontSize: 13, lineHeight: 1.5, marginTop: 8, textAlign: 'center', wordBreak: 'keep-all' };

/**
 * 시트 안 사진 위의 「시작」·「끝」 라벨.
 *
 * 두 장을 나란히 놓는 것만으로는 **어느 쪽이 시작인지** 알 수 없다 — 좌우 순서는 관례일 뿐
 * 화면이 하는 말이 아니다. 사진 위에 얹는 이유는 아래에 적으면 사진 사이 간격이 벌어져
 * 두 장이 한 동작으로 안 읽히기 때문이다.
 */
const SHOT_LABEL: React.CSSProperties = {
  position: 'absolute',
  left: 6,
  bottom: 6,
  padding: '2px 7px',
  fontSize: 11,
  fontWeight: 600,
  color: '#fff',
  background: 'rgba(0, 0, 0, 0.55)',
  borderRadius: 999,
};

/** 단계 앞 번호. 원 안에 넣는 이유는 목록 표식이 사라져도 순서가 남아야 하기 때문이다. */
const STEP_NO: React.CSSProperties = {
  flexShrink: 0,
  width: 22,
  height: 22,
  display: 'grid',
  placeItems: 'center',
  borderRadius: 999,
  background: 'var(--bg-sub)',
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--text-sub)',
};

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
  onBodyPhoto,
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
  /** 완료 화면의 눈바디 제안. **기록 저장이 끝난 뒤에** 불린다 — 순서가 스펙이다(설계 §3.1). */
  onBodyPhoto: () => void;
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
  /**
   * 「동작 보기」 시트가 열려 있는가. **세션이 아니라 화면 상태다** — 기록이 아니라서 저장하지 않는다.
   *
   * 세트 진행 분기에서만 읽는다(휴식·완료 화면에는 입구 자체가 없다).
   */
  const [guideOpen, setGuideOpen] = useState(false);
  /** 시트 안 단계 설명. 빈 배열이 「로딩 중」이자 「설명이 없는 운동」이다 — 화면에서 둘은 같다(설계 §3.3). */
  const [steps, setSteps] = useState<string[]>([]);
  const [now, setNow] = useState(() => Date.now());
  /**
   * 「잠시 후 광고가 나와요」를 띄우는가. **광고 판단과 한 값에서 나온다** — 안 틀 광고를
   * 예고하면 그건 거짓말이다. 휴식 화면에서만 읽는다.
   */
  const [adNotice, setAdNotice] = useState(false);
  // 광고 상태는 **세션 안에서만** 산다. 앱을 껐다 켜면 새 세션이니 백오프도 처음부터가 맞다.
  // 화면에 그릴 값이 아니므로 ref다 — state로 두면 광고 판단이 리렌더를 부른다.
  const adState = useRef<AdState>({ noFillStreak: 0, slotsSinceLastTry: 0 });

  /**
   * 운동이 바뀌면 다음 값으로 채워 둔다 — 매번 처음부터 입력하게 두면 기록을 안 남긴다.
   *
   * 「지난번 그대로」가 아니라 **`suggestNext`가 정한 다음 값**이다(설계 §3.7). 상단에 닿고도
   * 지난 값이 그대로 뜨면 **정체가 기본값**이 되어, 점진적 과부하가 사용자 의지에만 맡겨진다.
   *
   * 처음 하는 운동이면 보유 무게 구간의 대표값을 넘긴다. 모른다고 답했으면 0 — 아는 척하지 않는다.
   */
  useEffect(() => {
    if (!current) return;
    const next = suggestNext(
      lastSetsOf(history, current.id),
      s.goal,
      current.requires.length === 0,
      defaultWeightFor(current.requires, spec),
    );
    setWeight(String(next.weight));
    setReps(String(next.reps));
  }, [current?.id, history, s.goal, spec]);

  /**
   * 운동이 바뀌면 시트를 닫는다. **안 닫으면 다음 운동 화면에 이전 운동 설명이 떠 있다** —
   * 화면에 틀린 정보가 남는 유일한 경로다. 프리필 effect에 얹지 않은 이유는 그쪽이
   * `history`·`spec` 변화에도 도는데, 그때 열어 둔 시트가 닫히는 건 뜬금없기 때문이다.
   */
  useEffect(() => setGuideOpen(false), [current?.id]);

  /**
   * 시트를 열 때 단계 설명을 받아 온다. **열 때다** — 청크가 첫 로드 밖이라는 결정이 여기서 지켜진다.
   *
   * ⚠️ 결과는 **닫힌 뒤·다음 운동으로 넘어간 뒤에도** 도착한다. 그대로 넣으면 다음 운동 시트에
   * 이전 운동 설명이 뜬다 — cleanup의 `alive`가 그 늦은 답을 버린다.
   */
  useEffect(() => {
    setSteps([]);
    if (!guideOpen || !current) return;
    let alive = true;
    loadInstructions(current.id).then((v) => alive && setSteps(v));
    return () => {
      alive = false;
    };
  }, [guideOpen, current?.id]);

  // 휴식 중일 때만 시계를 돌린다.
  const resting = s.restEndsAt !== null;
  /**
   * 지금도 휴식 중인가 — **광고 effect가 3초를 기다린 뒤에 읽으려고** 렌더마다 갱신한다.
   *
   * effect의 클로저는 휴식이 시작되던 순간의 `s`를 쥐고 있어서, 그것으로 판단하면 이미
   * 건너뛴 휴식을 「아직 쉬는 중」으로 읽어 **세트를 하는 도중에** 전면 광고가 덮는다.
   */
  const restingRef = useRef(resting);
  restingRef.current = resting;
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
   * 규율 넷을 지킨다:
   * - **오기 전에 말한다.** 예고를 띄우고 `AD_NOTICE_MS`만큼 기다린 뒤에 노출한다(T-245).
   *   **로드는 즉시 시작한다** — 유예는 노출을 늦추는 것이지 수익을 늦추는 게 아니다.
   * - **타이머를 건드리지 않는다.** `restEndsAt`이 절대 시각이라 광고를 보는 동안에도 휴식은
   *   그대로 흐른다. 광고가 시간을 늘리면 그건 사용자에게서 훔치는 것이다.
   * - **실패는 조용히 넘어간다.** 광고는 수익이지 기능이 아니다 — 에러를 사용자에게 보이지 않는다.
   * - **판단은 `adPlan`에만 맡긴다.** 여기서 조건을 덧붙이면 규칙이 두 곳으로 갈라진다.
   */
  useEffect(() => {
    if (!resting) return;
    const decision = adPlan(restRemaining(s, Date.now()), adState.current);
    // 예고와 노출이 **한 판단에서** 나온다. 따로 두면 예고만 뜨고 광고는 안 나오는 날이 온다.
    setAdNotice(decision.show);
    if (!decision.show) {
      adState.current = nextAdState(adState.current, 'skipped');
      return;
    }
    // 노출해도 되는 **시각**이다. 남은 시간을 그때그때 빼는 방식이면 백그라운드 스로틀에서
    // 유예가 줄어들 수 있다 — 절대 시각이면 늘어날지언정 줄지 않는다(글로벌 CLAUDE.md 함정 ①).
    const showAt = Date.now() + AD_NOTICE_MS;
    // 광고 상태는 ref만 갱신하므로 언마운트 뒤에 끝나도 안전하다. 취소 플래그를 그쪽에 걸면
    // 노출 성공이 상태에 안 남아 다음 슬롯의 백오프 판단이 틀어진다 — `alive`는 **화면 상태**에만 건다.
    let alive = true;
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
        const wait = showAt - Date.now();
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        // 예고를 읽는 사이 휴식이 끝났으면(건너뛰기·그만두기) 띄우지 않는다. 세트를 하는
        // 도중에 전면 광고가 덮는 것이 바로 4차 반려가 말한 「예상하기 어려운 시점」이다.
        if (!restingRef.current) {
          adState.current = nextAdState(adState.current, 'skipped');
          return;
        }
        const shown = await awaitAdEvent((h) => m.showFullScreenAd({ ...opts, ...h }), {
          resolveOn: ['impression', 'dismissed'],
          timeoutMs: 90000,
        });
        adState.current = nextAdState(adState.current, shown.ok ? 'shown' : 'noFill');
      } catch {
        adState.current = nextAdState(adState.current, 'noFill');
      } finally {
        // 어느 경로로 끝나든 예고는 걷는다 — 할 말이 끝났는데 문구가 남아 있으면 그것도 거짓말이다.
        if (alive) setAdNotice(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [resting]);

  const left = restRemaining(s, now);

  // 휴식이 끝나면 자동으로 다음 세트로 넘어간다. 타이머의 존재 이유다.
  useEffect(() => {
    if (resting && left === 0) onChange(endRest(s));
  }, [resting, left]);

  /**
   * 준비 신호. **판정은 `cueAt`이 혼자 한다** — 여기서 조건을 덧붙이면 규칙이 두 곳으로 갈라진다.
   *
   * ref에 직전 남은 초를 들고 비교한다: 시계는 250ms마다 도는데 남은 초는 1초에 한 번만
   * 바뀌므로, 「같은 초면 침묵」이 `cueAt` 안에 있어야 초당 네 번 울리지 않는다.
   * 휴식이 아니면 ref를 비워 다음 휴식의 첫 비교가 「휴식 길이 → …」로 시작하게 한다.
   */
  const prevLeft = useRef<number | null>(null);
  useEffect(() => {
    if (!resting) {
      prevLeft.current = null;
      return;
    }
    const prev = prevLeft.current;
    prevLeft.current = left;
    const cue = prev === null ? null : cueAt(prev, left);
    if (cue) playCue(cue);
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

        {/*
          눈바디 제안. **선택 사항이라 체감 1문항과 같은 자리에 얹는다** — 기록 저장 버튼과
          경쟁하지 않게 ghost다(설계 §3.1).

          ⚠️ **저장이 먼저다.** 촬영을 먼저 열면 그 화면에서 사용자가 뒤로 가거나 앱이 죽는
          순간 방금 한 운동이 통째로 사라진다. 기록은 광고보다 귀하고, 사진보다도 귀하다.
        */}
        <button
          style={{ ...ui.ghost, width: '100%', marginBottom: 4 }}
          onClick={() => {
            save();
            onBodyPhoto();
          }}
        >
          📷 오늘의 눈바디 남기기
        </button>
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

    /**
     * 준비 신호의 색. **여기서 한 번 정해 재사용한다** — 화면에 if를 흩뿌리면
     * 「배경은 물들었는데 글자는 검정」 같은 반쪽 상태가 난다.
     */
    const { bg, inverted, text: fg, phrase } = warnColors(left);
    const fgSub = inverted ? 'rgba(255, 255, 255, 0.82)' : 'var(--text-sub)';
    /** 마지막 3초 심장박동. 초당 1회다 — 그 이상은 광과민성 위험이다(결정 7). */
    const pulsing = left <= 3 && left > 0;

    return (
      // 1초 단위 계단을 트랜지션이 메워 눈에는 연속 램프로 보인다.
      <main style={{ ...ui.pageFull, background: bg, transition: 'background 1s linear' }}>
        <div style={{ ...ui.spacer, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: 13, color: fgSub, marginBottom: 4 }}>휴식</div>
            {/*
              광고가 오기 전에 화면이 먼저 말한다(T-245). 색은 경고 램프의 반전을 그대로 따라간다 —
              배경이 붉어진 뒤에 회색 글자만 남으면 이 줄만 안 읽힌다. 375px에서 두 줄로 꺾여도 된다.
            */}
            {adNotice && (
              <div style={{ fontSize: 13, color: fgSub, marginBottom: 6, wordBreak: 'keep-all' }}>
                잠시 후 광고가 나와요 · 휴식 시간은 그대로 흘러요
              </div>
            )}
            {/* `key`가 초마다 바뀌어야 리마운트로 펄스가 **매초** 다시 재생된다 — 없으면 첫 초만 뛴다. */}
            <div
              key={left}
              className={pulsing ? 'cue-pulse' : undefined}
              style={{ fontSize: 72, fontWeight: 800, letterSpacing: -3, fontVariantNumeric: 'tabular-nums', color: fg }}
            >
              {mmss(left)}
            </div>
            {/* 소리가 안 나는 기기에서도 같은 정보가 닿아야 한다(결정 4) — 색·펄스와 함께 셋이 같은 말을 한다. */}
            {left <= 10 && left > 0 && (
              <div style={{ marginTop: 10, fontSize: 15, fontWeight: 700, color: phrase }}>
                다음 세트 준비
              </div>
            )}
            {next && (
              <div style={{ marginTop: 20, fontSize: 15, color: fgSub }}>
                다음 · <b style={{ color: fg }}>{next.name}</b> {nextSetNo}세트
              </div>
            )}
          </div>
        </div>
        {/* ⚠️ `border`가 shorthand라 `borderColor`만 덮으면 리렌더에서 풀린다(ui.ts 주석). */}
        <button
          style={
            inverted
              ? { ...ui.secondary, color: '#ffffff', background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.45)' }
              : ui.secondary
          }
          onClick={() => onChange(endRest(s))}
        >
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

  /**
   * 목표 반복 범위 이탈 안내. **초과는 기구에만 뜬다** — 맨몸은 얹을 무게가 없어서
   * 「무게를 올려야 효과가 계속 늘어요」가 줄 수 없는 조언이다(그 자리는 25회 사다리 안내가 맡는다).
   * **미달은 양쪽 다 뜬다** — 모자란 사람에게 할 말은 맨몸에도 있다(줄2는 다르다, 아래 렌더 참조).
   *
   * 구간은 `GOALS[goal].reps`에서 읽는다. 숫자를 문구에 박으면 목적을 바꾼 사람에게
   * 남의 목표가 뜬다 — 근비대 6~12, 감량 12~20, 건강 8~15로 다 다르다.
   *
   * 경계는 **포함**이다(`suggestNext`의 졸업 판정과 같은 규약). 안내일 뿐이라 저장은 안 막는다.
   * 맨몸 사다리(≥25)와는 저절로 배타다 — 모든 목적의 하단이 12 이하라 겹칠 값이 없다.
   */
  const [repLo, repHi] = GOALS[s.goal].reps;
  const repOff = valid ? (repsNum < repLo ? 'under' : !bodyweight && repsNum > repHi ? 'over' : null) : null;

  /**
   * 맨몸 사다리 안내. **지난 기록이 아니라 지금 입력한 값**을 본다 — 기록 기준이면 오늘
   * 처음 25회를 넘긴 사람은 다음 세션까지 아무 말도 못 듣는다(실기기 제보: 30을 넣어도 무반응).
   *
   * 프리필이 지난 기록에서 오므로(`suggestNext`) 「지난 기록이 25 이상」인 경우는 첫 렌더의
   * 입력값도 25 이상이라 이 조건이 그대로 덮는다 — 그래서 옛 상단 안내는 지웠다(중복 표시).
   *
   * 경계는 **포함**이다(`BODYWEIGHT_LADDER_REPS`의 규약). 입력칸 색은 안 바꾼다 — 기구의
   * 파란 테두리는 「무게 칸을 봐라」와 묶인 신호인데 맨몸엔 무게 칸이 없다.
   *
   * ⚠️ `valid`는 **테스트로 죽지 않는 방어다**(리뷰 실측 — 빼도 462건 전부 통과). 그래도
   * 남긴다: 지금 안전한 이유가 이 조건이 아니라 **`<input type="number">`의 value
   * sanitization**이기 때문이다 — jsdom 실측에서 `'1e999'`·`'Infinity'`가 `''`로 비워져
   * 컷에 못 닿지만, `type="text"`로 바꾸는 순간 `Number('1e999') === Infinity`가 컷을
   * **통과한다**(`Infinity >= 25`는 참). 한 토큰짜리 가드로 그 전제를 안 사도 되고,
   * 형제인 `repOff`와 조건 모양도 같아진다.
   */
  const ladder = bodyweight && valid && repsNum >= BODYWEIGHT_LADDER_REPS;

  /** 헤더와 시트가 같은 문자열을 쓴다 — 두 번 만들면 언젠가 갈라진다. */
  const muscles = current.primaryMuscles.map((m) => MUSCLE_KO[m] ?? m).join(' · ');
  /** 시트 부제. **맨몸도 「맨몸」이라고 적는다** — 빈칸이면 라벨이 빠진 것처럼 보인다. */
  const guideSub = [
    muscles,
    bodyweight ? '맨몸' : current.requires.map((k) => EQUIPMENT_KO[k] ?? k).join(' · '),
    LEVEL_KO[current.level],
  ].join(' · ');

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
          <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>{muscles}</div>
          {/*
            모르는 운동에 답하는 자리. **칩이지 사진이 아니다** — 사진을 버튼으로 만들면
            눌린다는 표시가 배지 하나뿐이라 발견성이 가장 낮다(설계 §2#1).
            아이콘은 `aria-hidden`이라 접근 이름은 「동작 보기」 그대로다.
          */}
          <button
            style={{ ...specChipStyle(true), display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 7 }}
            aria-expanded={guideOpen}
            onClick={() => setGuideOpen(!guideOpen)}
          >
            <Icon name="play" size={14} />
            동작 보기
          </button>
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
              // ⚠️ `border`가 shorthand라 `borderColor`만 덮으면 React가 리렌더에서 그 값을
              //    지운다(ui.ts 주석) — shorthand를 통째로 갈아 끼운다.
              style={repOff === 'over' ? { ...ui.input, border: '1px solid var(--blue)', color: 'var(--blue-dark)' } : ui.input}
              type="number"
              inputMode="numeric"
              min={1}
              value={reps}
              onChange={(e) => setReps(e.target.value)}
            />
          </label>
        </div>

        {/*
          두 줄은 **일부러 나눈 것이다.** 한 줄로 흘리면 375px에서 어중간한 자리에 꺾여
          「목표(6~12회)보다 많아 / 요」가 된다. `keep-all`은 그 위에 어절 중간 꺾임까지 막는다.
        */}
        {repOff && (
          <div style={{ ...GUIDE, color: repOff === 'over' ? 'var(--blue-dark)' : 'var(--text-sub)' }}>
            <div>{`목표(${repLo}~${repHi}회)보다 ${repOff === 'over' ? '많아요' : '적어요'}`}</div>
            {/* 미달 줄2가 기구·맨몸으로 갈리는 이유: 맨몸엔 낮출 무게가 없어서 할 수 있는 행동이
                「쉬었다 나눠 채우기」뿐이다 — 공용 문구로 묶으면 한쪽엔 못 할 조언이 뜬다. */}
            <div>
              {repOff === 'over'
                ? '무게를 올려야 효과가 계속 늘어요'
                : bodyweight
                  ? '힘들면 조금 쉬었다가 나눠서 채워보세요'
                  : '힘들면 무게를 낮춰서 횟수를 채워보세요'}
            </div>
          </div>
        )}

        {/*
          파랑인 것은 진급 신호라서다 — 회색이면 「너무 많이 했다」는 지적으로 읽힌다.
          두 줄인 것은 옛 한 줄(「더 어려운 동작에 도전할 때예요」)이 응원인지 경고인지
          모호했기 때문이다(실기기 제보) — 줄1이 이유, 줄2가 행동이다.
        */}
        {ladder && (
          <div style={{ ...GUIDE, color: 'var(--blue-dark)' }}>
            <div>여기서 횟수를 더 늘려도 효과가 잘 안 늘어요</div>
            <div>다음엔 더 어려운 동작으로 바꿔보세요</div>
          </div>
        )}
      </div>

      {/*
        「세트 완료」를 누르면 무슨 일이 생기는지 **누르기 전에** 말한다(T-245).
        **다음 휴식에 실제로 광고가 나올 때만** 뜬다 — 판단은 휴식 화면과 같은 `adPlan` 하나가 한다.
        여기 조건을 흉내 내서 새로 쓰면 예고와 노출이 갈라진다.

        ⚠️ **마지막 세트에는 휴식 자체가 없다**(`isLastSet` — `completeSet`의 종료 분기와 같은 값).
        그 자리에서 예고하면 문구를 읽은 사용자가 휴식 대신 완료 화면을 본다.
      */}
      {!isLastSet(s) && adPlan(restSecondsFor(current, s.goal), adState.current).show && (
        <div style={{ fontSize: 12, color: 'var(--text-weak)', textAlign: 'center', marginBottom: 8, wordBreak: 'keep-all' }}>
          세트를 마치면 휴식 중에 광고가 나와요
        </div>
      )}
      <button
        style={{ ...ui.primary, ...(valid ? null : ui.disabled) }}
        disabled={!valid}
        onClick={() => {
          // 브라우저 오디오는 **사용자 제스처 뒤에만** 열린다. 휴식은 항상 이 탭 직후라
          // 여기서 깨우면 조건이 저절로 맞는다 — 빠뜨리면 휴식 내내 소리가 통째로 안 난다.
          primeSound();
          onChange(completeSet(s, { weight: bodyweight ? 0 : Number(weight) || 0, reps: repsNum }, Date.now()));
        }}
      >
        세트 완료
      </button>
      <button style={{ ...ui.ghost, width: '100%', marginTop: 4 }} onClick={() => onChange(skipExercise(s))}>
        이 운동 건너뛰기
      </button>

      {/*
        동작 보기 시트. **세트 화면 위에 겹쳐 뜬다** — 화면을 갈아 끼우면 입력하던 무게·횟수가 날아간다.
        「세트 완료」를 가리는 것은 의도다(설계 §7): 읽고 닫아야 기록한다. 그래서 닫는 길이 둘이다.
      */}
      {guideOpen && (
        <>
          <div data-dim style={ui.dim} onClick={() => setGuideOpen(false)} />
          <div role="dialog" aria-modal="true" aria-label={current.name} style={ui.sheet}>
            <h2 style={ui.h2}>{current.name}</h2>
            <p style={ui.sub}>{guideSub}</p>
            {/* 사진이 없는 운동이 오면 이 블록이 통째로 없다 — 빈 상자를 그리지 않는다. */}
            {current.images.length > 0 && (
              <div style={{ ...ui.row, alignItems: 'center', marginBottom: 16 }}>
                {current.images.slice(0, 2).map((path, i) => (
                  <Fragment key={path}>
                    {/* 두 장 사이의 화살표가 「같은 동작의 두 순간」이라고 말한다. */}
                    {i > 0 && <span style={{ color: 'var(--text-weak)', fontSize: 16 }}>→</span>}
                    <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
                      <ExerciseImage path={path} name={current.name} fluid />
                      <span style={SHOT_LABEL}>{i === 0 ? '시작' : '끝'}</span>
                    </div>
                  </Fragment>
                ))}
              </div>
            )}
            {/* 단계가 없으면 목록 자체가 없다 — 로딩 스피너도 빈 상자도 그리지 않는다(설계 §3.3). */}
            {steps.length > 0 && (
              <ol style={{ listStyle: 'none', margin: '0 0 16px', padding: 0, display: 'grid', gap: 9 }}>
                {steps.map((step, i) => (
                  <li key={i} style={{ display: 'flex', gap: 8, fontSize: 14, lineHeight: 1.5 }}>
                    <span style={STEP_NO}>{i + 1}</span>
                    <span style={{ minWidth: 0 }}>{step}</span>
                  </li>
                ))}
              </ol>
            )}
            <button style={ui.secondary} onClick={() => setGuideOpen(false)}>
              닫기
            </button>
          </div>
        </>
      )}
    </main>
  );
}
