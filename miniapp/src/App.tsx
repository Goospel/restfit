import { useMemo, useState } from 'react';

import { Icon, type IconName } from './components/Icon';
import { EXERCISES } from './data/exercises';
import { effectiveOwned, type EquipSpec } from './logic/equipSpec';
import { DEFAULT_GOAL, GOALS, type Goal } from './logic/goal';
import { pickRoutine } from './logic/routine';
import { startSession, type Session } from './logic/session';
import { History } from './screens/History';
import { Home } from './screens/Home';
import { Onboarding } from './screens/Onboarding';
import { Probe } from './screens/Probe';
import { Settings } from './screens/Settings';
import { Shop } from './screens/Shop';
import { Workout } from './screens/Workout';
import {
  appendRecord,
  clearOnboarding,
  loadEquipSpec,
  loadGoal,
  loadHistory,
  loadOwned,
  recentGroups,
  saveEquipSpec,
  saveGoal,
  saveOwned,
  todayKey,
  type WorkoutRecord,
} from './storage';

type Tab = 'home' | 'shop' | 'history';

const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: 'home', label: '오늘', icon: 'dumbbell' },
  { key: 'shop', label: '기구', icon: 'kettlebell' },
  { key: 'history', label: '기록', icon: 'chart' },
];

export function App() {
  const [owned, setOwned] = useState(loadOwned);
  /** 기구 상세(무게 구간·벤치 등판). 비어 있어도 앱은 그대로 돈다 — 「모름」이 정상 경로다. */
  const [spec, setSpec] = useState<EquipSpec>(loadEquipSpec);
  const [history, setHistory] = useState(loadHistory);
  const [tab, setTab] = useState<Tab>('home');
  const [session, setSession] = useState<Session | null>(null);
  const [probe, setProbe] = useState(false);
  /** 「내 조건」(보유 기구·목적). 탭이 아니라 홈의 목적 칩에서 여는 전체화면이다. */
  const [settings, setSettings] = useState(false);
  /** `null`이면 온보딩을 아직 안 끝냈다는 뜻이다. 기본값을 여기서 대신 채우면 그 구분이 사라진다. */
  const [goal, setGoal] = useState<Goal | null>(loadGoal);

  const date = todayKey();

  /**
   * 오늘의 루틴은 **오늘 이전의 기록**으로만 정한다.
   *
   * 오늘 기록까지 넣으면 운동을 마치는 순간 부위 로테이션이 돌아 화면의 루틴이 바뀐다 —
   * "오늘 완료함"이라 써 있는데 목록은 딴것이 되는 꼴이다. "한 번 더 하기"도 같은 루틴이어야 한다.
   */
  const routine = useMemo(() => {
    const prior = history.filter((r) => r.date !== date);
    // 종목 수는 목적이 정한다 — 짧게 쉬는 목적일수록 많이 넣어야 세션 길이가 유지된다.
    // effectiveOwned: 조절식 벤치를 가졌으면 인클라인까지 열고, 평벤치·모름이면 걸러낸다.
    return pickRoutine(
      EXERCISES,
      effectiveOwned(owned, spec),
      recentGroups(prior),
      date,
      GOALS[goal ?? DEFAULT_GOAL].exerciseCount,
    );
  }, [owned, spec, history, date, goal]);

  function saveOwnedAnd(next: typeof owned) {
    setOwned(next);
    saveOwned(next);
  }

  function saveSpecAnd(next: EquipSpec) {
    setSpec(next);
    saveEquipSpec(next);
  }

  function saveGoalAnd(next: Goal) {
    setGoal(next);
    saveGoal(next);
  }

  /**
   * 온보딩을 다시 띄운다. **폰에서는 localStorage를 손댈 방법이 없어**
   * 온보딩 화면을 고쳐도 실기기에서 확인할 길이 없다 — 그 유일한 입구다.
   */
  function resetOnboarding() {
    clearOnboarding();
    setOwned([]);
    setSpec({});
    setGoal(null);
    // 온보딩을 마치면 마지막으로 보던 기록 탭이 아니라 오늘 루틴으로 돌아오게 둔다.
    setTab('home');
  }

  function finish(rec: WorkoutRecord | null) {
    if (rec) setHistory(appendRecord(rec));
    setSession(null);
    setTab('home');
  }

  // 온보딩이 가장 앞이다. 목적이 비어 있는 채로 앱을 쓰게 두면 그 상태를 화면마다 따로 처리해야 한다.
  if (goal === null) {
    return (
      <Onboarding
        owned={owned}
        spec={spec}
        onOwnedChange={saveOwnedAnd}
        onSpecChange={saveSpecAnd}
        onDone={saveGoalAnd}
      />
    );
  }

  if (probe) return <Probe onBack={() => setProbe(false)} />;

  if (settings) {
    return (
      <Settings
        owned={owned}
        spec={spec}
        onChange={saveOwnedAnd}
        onSpecChange={saveSpecAnd}
        goal={goal}
        onGoalChange={saveGoalAnd}
        onBack={() => setSettings(false)}
      />
    );
  }

  // 운동 중에는 탭을 감춘다. 세트와 휴식 사이에 딴 화면으로 샐 이유가 없다.
  if (session && routine.group) {
    return (
      <Workout
        session={session}
        group={routine.group}
        onChange={setSession}
        onFinish={finish}
        history={history}
        spec={spec}
        date={date}
      />
    );
  }

  return (
    <>
      {tab === 'home' && (
        <Home
          routine={routine}
          history={history}
          goal={goal}
          doneToday={history.some((r) => r.date === date)}
          onStart={() => setSession(startSession(routine.exercises, goal))}
          onOpenSettings={() => setSettings(true)}
        />
      )}
      {tab === 'shop' && <Shop owned={owned} spec={spec} />}
      {tab === 'history' && (
        <History history={history} onProbe={() => setProbe(true)} onResetOnboarding={resetOnboarding} />
      )}

      <nav style={navStyle}>
        {TABS.map((t) => (
          <button
            key={t.key}
            style={{ ...tabStyle, color: tab === t.key ? 'var(--blue)' : 'var(--text-weak)' }}
            onClick={() => setTab(t.key)}
            aria-current={tab === t.key ? 'page' : undefined}
          >
            <Icon name={t.icon} />
            <span style={{ fontSize: 11, fontWeight: 600 }}>{t.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}

/**
 * **떠 있는 캡슐이어야 한다** — 토스 브랜딩 가이드가 지정한 형태이고,
 * 밑변에 꽉 붙은 형태로 냈다가 검수에서 반려됐다(2026-08-26).
 *
 * 밑변에 붙고 윗선이 있으면 토스 앱 자체의 하단 탭과 형태가 겹쳐, 사용자가
 * 지금 토스에 있는지 미니앱에 있는지 헷갈린다. 그래서 좌우를 띄우고(`left`/`right`)
 * 밑에서도 띄우고(`--tab-gap`) 완전한 pill(`borderRadius: 999`)로 만든다.
 */
const navStyle: React.CSSProperties = {
  position: 'fixed',
  left: 20,
  right: 20,
  bottom: 'calc(var(--safe-b) + var(--tab-gap))',
  display: 'flex',
  height: 'var(--tab-h)',
  background: 'var(--bg)',
  borderRadius: 999,
  // 좌우가 트여 컨텐츠가 옆으로 지나가므로, 그림자가 없으면 떠 있는 것으로 안 보인다.
  boxShadow: '0 6px 20px rgba(0, 0, 0, 0.12), 0 1px 4px rgba(0, 0, 0, 0.06)',
};

const tabStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 3,
  background: 'none',
  border: 0,
};
