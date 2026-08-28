import { ExerciseImage } from '../components/ExerciseImage';
import { GROUP_KO, MUSCLE_KO } from '../data/labels';
import { GOALS, type Goal } from '../logic/goal';
import { restSecondsFor, SETS_PER_EXERCISE } from '../logic/session';
import type { Profile } from '../logic/profile';
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
  profile,
  doneToday,
  onStart,
  onOpenEquipment,
  onOpenGoal,
}: {
  routine: Routine;
  history: WorkoutRecord[];
  /** 반복·휴식·종목 수를 정한 목적. 화면에 계속 띄워야 왜 이 숫자인지가 설명된다. */
  goal: Goal;
  /** `null`이면 이 화면이 생기기 전부터 쓰던 사람이다 — 개인화가 꺼진 채로 돈다. */
  profile: Profile | null;
  doneToday: boolean;
  onStart: () => void;
  onOpenEquipment: () => void;
  onOpenGoal: () => void;
}) {
  // 이 이른 반환이 아래 안내 칩보다 앞이라 **빈 루틴 화면에는 목적 칩이 안 뜬다 — 의도다.**
  // 이 화면은 아래 버튼으로 갈 곳을 이미 가리키므로, 칩까지 붙이면 목적지가 겹친다.
  if (!routine.unit || routine.exercises.length === 0) {
    return (
      <main style={ui.page}>
        <h1 style={ui.h1}>오늘의 루틴</h1>
        <div style={ui.empty}>
          <p>할 수 있는 운동을 찾지 못했습니다.</p>
          {/* 부상 제외는 **하드 필터**라 폴백으로 안 되살린다(설계 §3.2) — 전부 걸러진
              병리적 조합에서 기구만 탓하면 사용자가 원인을 영영 못 찾는다. */}
          <p style={{ fontSize: 13 }}>보유 기구와 불편 부위 설정을 확인해 주세요.</p>
        </div>
        {/* 짚어 준 원인이 둘이라 버튼도 둘이다 — 「설정 열기」 하나로 묶으면 도착한 페이지에
            둘 중 하나가 없어서, 짚어만 주고 못 고치게 두는 셈이 된다. */}
        <div style={{ display: 'grid', gap: 10 }}>
          <button style={ui.secondary} onClick={onOpenEquipment}>
            보유 기구 확인
          </button>
          <button style={ui.secondary} onClick={onOpenGoal}>
            불편한 부위 확인
          </button>
        </div>
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
          오늘은 <span style={{ color: 'var(--blue)' }}>{GROUP_KO[routine.unit]}</span>
        </h1>
        <span style={ui.spacer} />
        {/* 목적을 계속 띄운다 — 왜 15회·45초인지가 이 칩으로 설명된다.
            라벨은 접두어까지 붙여 **무엇을 여는 버튼인지**도 말한다. 목적 이름만 있던 옛
            라벨은 정체를 안 말해서, 기구를 바꾸려는 사람이 이 칩을 누를 이유를 못 찾았다.
            아이콘은 뺐다 — 접두어가 정체를 말하므로, 아이콘까지 있으면 칩이 두 줄로 밀린다. */}
        <button
          style={{
            ...ui.chip,
            color: 'var(--blue-dark)',
            background: '#eff6ff',
            borderColor: 'var(--blue)',
            whiteSpace: 'nowrap',
          }}
          onClick={onOpenGoal}
        >
          목적 · {GOALS[goal].label} ›
        </button>
      </div>
      <p style={ui.sub}>
        {routine.exercises.length}개 운동 · 각 {SETS_PER_EXERCISE}세트 · 약 {Math.round(totalSec / 60)}분
        {doneToday && ' · 오늘 완료함'}
      </p>

      {/*
       * 이 화면이 생기기 전부터 쓰던 사람에게만 뜬다 — 신규 사용자는 온보딩에서 이미 답했고,
       * 방금 답한 걸 또 조르면 안내가 아니라 잔소리다.
       *
       * **dismiss 상태를 두지 않는다**(설계 §6 · 결정 4). 프로필이 채워지는 순간 조건이
       * 무너져 자연히 사라지므로, 「닫음」을 저장할 자리가 애초에 필요 없다.
       */}
      {!profile && history.length > 0 && (
        <button
          style={{ ...ui.chip, width: '100%', textAlign: 'left', padding: '10px 12px', fontSize: 13, marginBottom: 16 }}
          // 경험은 운동 목적 페이지에 있다 — 다른 데로 보내면 도착해서 답할 자리를 못 찾는다.
          onClick={onOpenGoal}
        >
          경험을 알려주시면 난이도를 맞춰드려요
        </button>
      )}

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
