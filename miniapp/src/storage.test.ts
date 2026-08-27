import { describe, expect, it } from 'vitest';

import {
  appendRecord,
  clearOnboarding,
  HISTORY_MAX,
  lastSetOf,
  loadEquipSpec,
  loadGoal,
  loadHistory,
  loadOwned,
  loadProfile,
  saveEquipSpec,
  saveGoal,
  saveProfile,
  recentGroups,
  saveOwned,
  todayKey,
  type WorkoutRecord,
} from './storage';

function fakeStorage(opts: { throwOnGet?: boolean; throwOnSet?: boolean; throwOnRemove?: boolean } = {}): Storage {
  const map = new Map<string, string>();
  return {
    getItem(k) {
      if (opts.throwOnGet) throw new Error('boom');
      return map.get(k) ?? null;
    },
    setItem(k, v) {
      if (opts.throwOnSet) throw new Error('boom');
      map.set(k, v);
    },
    removeItem(k) {
      if (opts.throwOnRemove) throw new Error('boom');
      map.delete(k);
    },
    clear: () => map.clear(),
    key: () => null,
    get length() {
      return map.size;
    },
  } as Storage;
}

const rec = (date: string, group: WorkoutRecord['group'], entries: WorkoutRecord['entries'] = []): WorkoutRecord => ({
  date,
  group,
  entries,
});

describe('보유 기구', () => {
  it('처음에는 아무것도 없다', () => {
    expect(loadOwned(fakeStorage())).toEqual([]);
  });

  it('저장한 것을 읽어낸다', () => {
    const s = fakeStorage();
    saveOwned(['dumbbell', 'bench'], s);
    expect(loadOwned(s)).toEqual(['dumbbell', 'bench']);
  });

  it('어휘에 없는 장비는 걸러낸다', () => {
    // 데이터 어휘가 바뀐 뒤 옛 저장값이 남아 있으면 필터가 영영 통과 못 하는 운동이 생긴다.
    const s = fakeStorage();
    s.setItem('restfit.owned', JSON.stringify(['dumbbell', 'cable', 'machine']));
    expect(loadOwned(s)).toEqual(['dumbbell']);
  });

  it('배열이 아니거나 깨진 값이면 빈 목록이다', () => {
    const s = fakeStorage();
    s.setItem('restfit.owned', '{쓰레기');
    expect(loadOwned(s)).toEqual([]);
    s.setItem('restfit.owned', '{"a":1}');
    expect(loadOwned(s)).toEqual([]);
  });

  it('저장소가 막혀 있어도 크래시하지 않는다', () => {
    expect(loadOwned(fakeStorage({ throwOnGet: true }))).toEqual([]);
    expect(() => saveOwned(['dumbbell'], fakeStorage({ throwOnSet: true }))).not.toThrow();
  });
});

describe('운동 기록', () => {
  it('처음에는 비어 있다', () => {
    expect(loadHistory(fakeStorage())).toEqual([]);
  });

  it('추가한 순서대로 쌓인다 (오래된 것이 앞)', () => {
    const s = fakeStorage();
    appendRecord(rec('2026-08-24', 'chest'), s);
    appendRecord(rec('2026-08-25', 'legs'), s);
    expect(loadHistory(s).map((r) => r.date)).toEqual(['2026-08-24', '2026-08-25']);
  });

  it('추가하면 갱신된 전체 목록을 돌려준다', () => {
    const s = fakeStorage();
    appendRecord(rec('2026-08-24', 'chest'), s);
    expect(appendRecord(rec('2026-08-25', 'legs'), s)).toHaveLength(2);
  });

  it('상한을 넘으면 오래된 것부터 잘린다', () => {
    // localStorage는 무한하지 않다. 기록이 자라 저장이 실패하면 그날 운동이 통째로 사라진다.
    const s = fakeStorage();
    for (let i = 0; i < HISTORY_MAX + 5; i++) appendRecord(rec(`d${i}`, 'chest'), s);
    const h = loadHistory(s);
    expect(h).toHaveLength(HISTORY_MAX);
    expect(h[0].date).toBe('d5');
  });

  it('형태가 깨진 항목은 걸러낸다', () => {
    const s = fakeStorage();
    s.setItem('restfit.history', JSON.stringify([rec('2026-08-25', 'chest'), { date: 1 }, null, 'x']));
    expect(loadHistory(s)).toHaveLength(1);
  });

  it('저장이 실패해도 계산된 목록은 돌려준다', () => {
    const s = fakeStorage({ throwOnSet: true });
    expect(appendRecord(rec('2026-08-25', 'chest'), s)).toHaveLength(1);
  });
});

describe('lastSetOf', () => {
  const history = [
    rec('2026-08-20', 'chest', [{ id: 'push_up', name: '푸시업', sets: [{ weight: 0, reps: 8 }] }]),
    rec('2026-08-23', 'chest', [
      { id: 'push_up', name: '푸시업', sets: [{ weight: 0, reps: 10 }, { weight: 0, reps: 12 }] },
      { id: 'curl', name: '컬', sets: [{ weight: 20, reps: 10 }] },
    ]),
  ];

  it('가장 최근 기록의 마지막 세트를 준다', () => {
    // "지난번 12회" — 직전에 뭘 했는지 보여줘야 다음 무게를 정할 수 있다.
    expect(lastSetOf(history, 'push_up')).toEqual({ weight: 0, reps: 12 });
  });

  it('오래된 기록도 찾는다', () => {
    expect(lastSetOf(history, 'curl')).toEqual({ weight: 20, reps: 10 });
  });

  it('한 번도 안 한 운동은 null이다', () => {
    expect(lastSetOf(history, '없는운동')).toBeNull();
  });

  it('세트가 비어 있는 기록은 건너뛴다', () => {
    const h = [...history, rec('2026-08-25', 'chest', [{ id: 'push_up', name: '푸시업', sets: [] }])];
    expect(lastSetOf(h, 'push_up')).toEqual({ weight: 0, reps: 12 });
  });

  it('빈 기록이면 null이다', () => {
    expect(lastSetOf([], 'push_up')).toBeNull();
  });
});

describe('recentGroups', () => {
  it('최근 것이 앞으로 오게 뒤집는다', () => {
    // pickRoutine이 「최근 것이 앞」인 목록을 받는다. 순서가 뒤집히면 방금 한 부위를 또 준다.
    const h = [rec('2026-08-23', 'chest'), rec('2026-08-24', 'legs'), rec('2026-08-25', 'back')];
    expect(recentGroups(h)).toEqual(['back', 'legs', 'chest']);
  });

  it('같은 부위가 여러 번이면 가장 최근 것만 남긴다', () => {
    const h = [rec('2026-08-23', 'chest'), rec('2026-08-24', 'legs'), rec('2026-08-25', 'chest')];
    expect(recentGroups(h)).toEqual(['chest', 'legs']);
  });

  it('빈 기록이면 빈 목록이다', () => {
    expect(recentGroups([])).toEqual([]);
  });
});

describe('todayKey', () => {
  it('한국 시간 기준 날짜를 YYYY-MM-DD로 준다', () => {
    // UTC 기준으로 자르면 한국의 오전 9시 이전이 전날로 찍혀 하루치 루틴이 어긋난다.
    expect(todayKey(new Date('2026-08-25T00:30:00Z'))).toBe('2026-08-25'); // KST 09:30
    expect(todayKey(new Date('2026-08-24T20:00:00Z'))).toBe('2026-08-25'); // KST 익일 05:00
  });

  it('시간대를 실제로 적용한다', () => {
    // ⚠️ 위 테스트만으로는 부족하다. **개발 기계가 이미 한국 시간이라**
    // 코드에서 timeZone 지정을 통째로 빼도 결과가 같다 — 돌연변이가 살아남아 들킨 공백이다.
    // 다른 시간대에서 답이 달라지는지를 봐야 지정이 실제로 쓰이는지 알 수 있다.
    const d = new Date('2026-08-24T20:00:00Z');
    expect(todayKey(d, 'Asia/Seoul')).toBe('2026-08-25');
    expect(todayKey(d, 'UTC')).toBe('2026-08-24');
  });
});

describe('loadGoal / saveGoal', () => {
  it('저장한 적 없으면 null — 「온보딩을 안 했다」는 뜻이다', () => {
    // 기본값을 돌려주면 온보딩을 띄울지 판단할 근거가 사라진다.
    expect(loadGoal(fakeStorage())).toBeNull();
  });

  it('저장하고 다시 읽으면 같다', () => {
    const s = fakeStorage();
    saveGoal('fatLoss', s);
    expect(loadGoal(s)).toBe('fatLoss');
  });

  it('어휘에 없는 값은 null로 친다', () => {
    // 옛 버전이 남긴 값이 들어오면 GOALS[goal]이 undefined가 되어 화면이 죽는다.
    const s = fakeStorage();
    s.setItem('restfit.goal', JSON.stringify('bulking'));
    expect(loadGoal(s)).toBeNull();
  });

  it('저장소가 막혀도 죽지 않는다', () => {
    expect(() => saveGoal('muscle', fakeStorage({ throwOnSet: true }))).not.toThrow();
    expect(loadGoal(fakeStorage({ throwOnGet: true }))).toBeNull();
  });
});

describe('clearOnboarding', () => {
  it('목적을 지워 온보딩이 다시 뜨게 만든다', () => {
    // 목적이 `null`이어야 App이 온보딩을 띄운다. 그게 이 함수의 존재 이유다.
    const s = fakeStorage();
    saveGoal('muscle', s);
    clearOnboarding(s);
    expect(loadGoal(s)).toBeNull();
  });

  it('기구도 함께 지운다', () => {
    // 목적만 지우면 온보딩 1단계에 고른 기구가 남아 **첫 진입 경험이 재현되지 않는다.**
    // 온보딩을 고치고 실기기에서 확인하려고 만든 버튼이라 그 재현이 곧 목적이다.
    const s = fakeStorage();
    saveOwned(['dumbbell', 'bench'], s);
    clearOnboarding(s);
    expect(loadOwned(s)).toEqual([]);
  });

  it('기구 상세도 함께 지운다', () => {
    // 기구를 지우면서 그 상세(무게·벤치 종류)만 남으면, 온보딩을 다시 해도
    // 안 가진 기구의 무게가 유령처럼 남아 운동 화면 기본값에 새어 나온다.
    const s = fakeStorage();
    saveEquipSpec({ dumbbell: 'heavy', bench: 'adjustable' }, s);
    clearOnboarding(s);
    expect(loadEquipSpec(s)).toEqual({});
  });

  it('운동 프로필도 함께 지운다', () => {
    // 새로 생긴 온보딩 단계라, 이걸 안 지우면 온보딩을 다시 해도 경험·불편 부위 질문이
    // 이미 답해진 상태로 뜬다 — 재현이 곧 이 함수의 존재 이유인데 그게 깨진다.
    const s = fakeStorage();
    saveProfile({ experience: 'intermediate', avoid: ['knee'] }, s);
    clearOnboarding(s);
    expect(loadProfile(s)).toBeNull();
  });

  it('운동 기록은 건드리지 않는다', () => {
    // 온보딩을 다시 보려고 눌렀다가 그동안 쌓은 기록이 날아가면 안 된다.
    const s = fakeStorage();
    appendRecord(rec('2026-08-26', 'chest'), s);
    saveGoal('muscle', s);
    clearOnboarding(s);
    expect(loadHistory(s)).toHaveLength(1);
  });

  it('저장소가 막혀도 죽지 않는다', () => {
    expect(() => clearOnboarding(fakeStorage({ throwOnRemove: true }))).not.toThrow();
  });
});

describe('운동 프로필', () => {
  it('저장한 적 없으면 null — 「아직 안 물어봤다」는 뜻이다', () => {
    // 기존 사용자는 여기가 null이라 개인화 경로를 통째로 건너뛴다. 기본값을 대신
    // 돌려주면 「안 고른 사람」과 「초급을 고른 사람」이 구별되지 않는다.
    expect(loadProfile(fakeStorage())).toBeNull();
  });

  it('저장하고 다시 읽으면 같다', () => {
    const s = fakeStorage();
    saveProfile({ experience: 'intermediate', avoid: ['knee', 'lowerBack'] }, s);
    expect(loadProfile(s)).toEqual({ experience: 'intermediate', avoid: ['knee', 'lowerBack'] });
  });

  it('experience가 어휘 밖이면 프로필 **전체**가 null이다', () => {
    // 반쪽 프로필은 반쪽 개인화라 디버깅 지옥이다 — avoid만 살려 두면
    // "불편 부위는 먹는데 난이도는 안 먹는" 상태가 조용히 생긴다.
    const s = fakeStorage();
    s.setItem('restfit.profile', JSON.stringify({ experience: 'pro', avoid: ['knee'] }));
    expect(loadProfile(s)).toBeNull();
  });

  it('experience가 아예 없어도 null이다', () => {
    const s = fakeStorage();
    s.setItem('restfit.profile', JSON.stringify({ avoid: ['knee'] }));
    expect(loadProfile(s)).toBeNull();
  });

  it('avoid는 어휘 밖 값만 걸러낸다 — 프로필은 살린다', () => {
    // 부위 어휘가 늘거나 줄어도 경험까지 날릴 이유는 없다. 걸러낸 값은 필터가
    // 영영 통과 못 하는 조건이 되므로 남겨 두면 안 된다.
    const s = fakeStorage();
    s.setItem('restfit.profile', JSON.stringify({ experience: 'beginner', avoid: ['knee', 'wrist', 7] }));
    expect(loadProfile(s)).toEqual({ experience: 'beginner', avoid: ['knee'] });
  });

  it('avoid가 배열이 아니거나 없으면 빈 목록이다', () => {
    const s = fakeStorage();
    s.setItem('restfit.profile', JSON.stringify({ experience: 'advanced' }));
    expect(loadProfile(s)).toEqual({ experience: 'advanced', avoid: [] });
    s.setItem('restfit.profile', JSON.stringify({ experience: 'advanced', avoid: 'knee' }));
    expect(loadProfile(s)).toEqual({ experience: 'advanced', avoid: [] });
  });

  it('객체가 아니거나 깨진 값이면 null이다', () => {
    const s = fakeStorage();
    s.setItem('restfit.profile', '{쓰레기');
    expect(loadProfile(s)).toBeNull();
    s.setItem('restfit.profile', JSON.stringify(['beginner']));
    expect(loadProfile(s)).toBeNull();
  });

  it('저장소가 막혀도 죽지 않는다', () => {
    expect(() => saveProfile({ experience: 'beginner', avoid: [] }, fakeStorage({ throwOnSet: true }))).not.toThrow();
    expect(loadProfile(fakeStorage({ throwOnGet: true }))).toBeNull();
  });
});

describe('기구 상세', () => {
  it('저장한 적 없으면 빈 객체다', () => {
    expect(loadEquipSpec(fakeStorage())).toEqual({});
  });

  it('저장하고 읽으면 같다', () => {
    const s = fakeStorage();
    saveEquipSpec({ dumbbell: 'medium', bench: 'adjustable', band: 'mixed' }, s);
    expect(loadEquipSpec(s)).toEqual({ dumbbell: 'medium', bench: 'adjustable', band: 'mixed' });
  });

  it('어휘에 없는 값은 걸러낸다', () => {
    // 옛 버전이 남긴 값이 그대로 들어오면 WEIGHT_OPTIONS에서 못 찾아 화면이 조용히 어긋난다.
    const s = fakeStorage();
    s.setItem('restfit.equipSpec', JSON.stringify({ dumbbell: '아주무거움', bench: 'adjustable' }));
    expect(loadEquipSpec(s)).toEqual({ bench: 'adjustable' });
  });

  it('벤치에 무게 구간이 들어와도 걸러낸다', () => {
    // 키마다 허용 어휘가 다르다. 한 벌로 검사하면 bench: 'heavy' 같은 값이 통과한다.
    const s = fakeStorage();
    s.setItem('restfit.equipSpec', JSON.stringify({ bench: 'heavy', dumbbell: 'heavy' }));
    expect(loadEquipSpec(s)).toEqual({ dumbbell: 'heavy' });
  });

  it('객체가 아니거나 깨진 값이면 빈 객체다', () => {
    const s = fakeStorage();
    s.setItem('restfit.equipSpec', '{쓰레기');
    expect(loadEquipSpec(s)).toEqual({});
    s.setItem('restfit.equipSpec', JSON.stringify(['dumbbell']));
    expect(loadEquipSpec(s)).toEqual({});
  });

  it('저장소가 막혀도 죽지 않는다', () => {
    expect(() => saveEquipSpec({ dumbbell: 'heavy' }, fakeStorage({ throwOnSet: true }))).not.toThrow();
    expect(loadEquipSpec(fakeStorage({ throwOnGet: true }))).toEqual({});
  });
});
