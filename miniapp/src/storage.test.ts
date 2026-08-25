import { describe, expect, it } from 'vitest';

import {
  appendRecord,
  HISTORY_MAX,
  lastSetOf,
  loadHistory,
  loadOwned,
  recentGroups,
  saveOwned,
  todayKey,
  type WorkoutRecord,
} from './storage';

function fakeStorage(opts: { throwOnGet?: boolean; throwOnSet?: boolean } = {}): Storage {
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
    removeItem: (k) => void map.delete(k),
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
