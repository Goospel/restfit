import { useMemo, useState } from 'react';

import { EXERCISES } from './data/exercises';
import { DEFAULT_GOAL, GOALS, type Goal } from './logic/goal';
import { pickRoutine } from './logic/routine';
import { startSession, type Session } from './logic/session';
import { Equipment } from './screens/Equipment';
import { History } from './screens/History';
import { Home } from './screens/Home';
import { Onboarding } from './screens/Onboarding';
import { Probe } from './screens/Probe';
import { Workout } from './screens/Workout';
import {
  appendRecord,
  loadGoal,
  loadHistory,
  loadOwned,
  recentGroups,
  saveGoal,
  saveOwned,
  todayKey,
  type WorkoutRecord,
} from './storage';

type Tab = 'home' | 'equipment' | 'history';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'home', label: '오늘', icon: '🏋️' },
  { key: 'equipment', label: '기구', icon: '🧰' },
  { key: 'history', label: '기록', icon: '📖' },
];

export function App() {
  const [owned, setOwned] = useState(loadOwned);
  const [history, setHistory] = useState(loadHistory);
  const [tab, setTab] = useState<Tab>('home');
  const [session, setSession] = useState<Session | null>(null);
  const [probe, setProbe] = useState(false);
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
    return pickRoutine(EXERCISES, owned, recentGroups(prior), date, GOALS[goal ?? DEFAULT_GOAL].exerciseCount);
  }, [owned, history, date, goal]);

  function saveOwnedAnd(next: typeof owned) {
    setOwned(next);
    saveOwned(next);
  }

  function saveGoalAnd(next: Goal) {
    setGoal(next);
    saveGoal(next);
  }

  function finish(rec: WorkoutRecord | null) {
    if (rec) setHistory(appendRecord(rec));
    setSession(null);
    setTab('home');
  }

  // 온보딩이 가장 앞이다. 목적이 비어 있는 채로 앱을 쓰게 두면 그 상태를 화면마다 따로 처리해야 한다.
  if (goal === null) {
    return <Onboarding owned={owned} onOwnedChange={saveOwnedAnd} onDone={saveGoalAnd} />;
  }

  if (probe) return <Probe onBack={() => setProbe(false)} />;

  // 운동 중에는 탭을 감춘다. 세트와 휴식 사이에 딴 화면으로 샐 이유가 없다.
  if (session && routine.group) {
    return (
      <Workout
        session={session}
        group={routine.group}
        onChange={setSession}
        onFinish={finish}
        history={history}
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
          onGoEquipment={() => setTab('equipment')}
        />
      )}
      {tab === 'equipment' && (
        <Equipment owned={owned} onChange={saveOwnedAnd} goal={goal} onGoalChange={saveGoalAnd} />
      )}
      {tab === 'history' && <History history={history} onProbe={() => setProbe(true)} />}

      <nav style={navStyle}>
        {TABS.map((t) => (
          <button
            key={t.key}
            style={{ ...tabStyle, color: tab === t.key ? 'var(--blue)' : 'var(--text-weak)' }}
            onClick={() => setTab(t.key)}
            aria-current={tab === t.key ? 'page' : undefined}
          >
            <span style={{ fontSize: 20, lineHeight: 1 }}>{t.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 600 }}>{t.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}

const navStyle: React.CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  height: 'calc(var(--tab-h) + var(--safe-b))',
  paddingBottom: 'var(--safe-b)',
  background: 'var(--bg)',
  borderTop: '1px solid var(--line)',
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
