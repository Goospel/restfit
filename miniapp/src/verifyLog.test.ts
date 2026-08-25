import { describe, expect, it } from 'vitest';

import { appendLog, clearLog, KEY, readLog, restartedAfterOpen } from './verifyLog';

/** 메모리 Storage — 실패를 주입할 수 있게 옵션을 둔다. */
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
    removeItem(k) {
      map.delete(k);
    },
    clear() {
      map.clear();
    },
    key: () => null,
    get length() {
      return map.size;
    },
  } as Storage;
}

const at = (t: number) => () => t;

describe('verifyLog', () => {
  it('빈 저장소면 빈 목록이다', () => {
    expect(readLog(fakeStorage())).toEqual([]);
  });

  it('append한 항목을 읽어낸다', () => {
    const s = fakeStorage();
    appendLog('열기 호출', at(1000), s);
    appendLog('복귀 감지', at(2000), s);

    expect(readLog(s)).toEqual([
      { t: 1000, msg: '열기 호출' },
      { t: 2000, msg: '복귀 감지' },
    ]);
  });

  it('append는 저장된 최신 목록을 그대로 돌려준다', () => {
    const s = fakeStorage();
    appendLog('첫 줄', at(1000), s);

    expect(appendLog('둘째 줄', at(2000), s)).toEqual([
      { t: 1000, msg: '첫 줄' },
      { t: 2000, msg: '둘째 줄' },
    ]);
  });

  it('깨진 JSON이 들어 있어도 크래시하지 않고 빈 목록을 준다', () => {
    const s = fakeStorage();
    s.setItem(KEY, '{그냥 쓰레기');

    expect(readLog(s)).toEqual([]);
  });

  it('배열이 아닌 값이 들어 있어도 빈 목록을 준다', () => {
    const s = fakeStorage();
    s.setItem(KEY, '{"a":1}');

    expect(readLog(s)).toEqual([]);
  });

  it('형태가 맞지 않는 항목은 걸러낸다', () => {
    const s = fakeStorage();
    s.setItem(
      KEY,
      JSON.stringify([{ t: 1, msg: '정상' }, { t: '숫자아님', msg: 'x' }, { msg: 't없음' }, null, 42]),
    );

    expect(readLog(s)).toEqual([{ t: 1, msg: '정상' }]);
  });

  it('100건을 넘으면 오래된 것부터 잘린다', () => {
    const s = fakeStorage();
    for (let i = 1; i <= 105; i++) appendLog(`m${i}`, at(i), s);

    const log = readLog(s);
    expect(log).toHaveLength(100);
    expect(log[0]).toEqual({ t: 6, msg: 'm6' });
    expect(log[99]).toEqual({ t: 105, msg: 'm105' });
  });

  it('저장소 읽기가 던져도 앱이 죽지 않는다', () => {
    expect(readLog(fakeStorage({ throwOnGet: true }))).toEqual([]);
  });

  it('저장소 쓰기가 던져도 계산된 목록은 돌려준다', () => {
    const s = fakeStorage({ throwOnSet: true });

    expect(appendLog('메시지', at(1000), s)).toEqual([{ t: 1000, msg: '메시지' }]);
  });

  it('clearLog 후에는 비어 있다', () => {
    const s = fakeStorage();
    appendLog('지워질 것', at(1000), s);
    clearLog(s);

    expect(readLog(s)).toEqual([]);
  });
});

/**
 * 「세션이 꼬여 재시작」 판정.
 *
 * 단순히 「앱 마운트가 2번 이상」으로 세면 **어제 로그에도 걸린다** — 로그가 localStorage에 남기 때문이다.
 * 오탐이 나면 실측 자체가 못 쓰게 되므로, **열기 호출 다음에 마운트가 왔는가**로 좁힌다.
 */
describe('restartedAfterOpen', () => {
  const L = (msg: string, t = 0) => ({ t, msg });

  it('열기 호출 다음에 앱 마운트가 오면 재시작이다', () => {
    expect(
      restartedAfterOpen([L('앱 마운트 (mountedAt=1)'), L('Device.openURL 호출 → https://x'), L('앱 마운트 (mountedAt=2)')]),
    ).toBe(true);
  });

  it('열기 호출 다음에 정상 복귀가 오면 재시작이 아니다', () => {
    expect(
      restartedAfterOpen([L('앱 마운트 (mountedAt=1)'), L('Device.openURL 호출 → https://x'), L('복귀 감지 (숨김 5.0초)')]),
    ).toBe(false);
  });

  it('마운트가 여러 번이어도 열기 호출 전이면 재시작이 아니다', () => {
    // ← 어제 로그가 남아 있는 상황. 예전 판정이라면 여기서 오탐이 났다.
    expect(
      restartedAfterOpen([L('앱 마운트 (mountedAt=1)'), L('복귀 감지 (숨김 3.0초)'), L('앱 마운트 (mountedAt=2)')]),
    ).toBe(false);
  });

  it('열기 호출이 아예 없으면 재시작이 아니다', () => {
    expect(restartedAfterOpen([L('앱 마운트 (mountedAt=1)'), L('앱 마운트 (mountedAt=2)')])).toBe(false);
  });

  it('빈 로그면 재시작이 아니다', () => {
    expect(restartedAfterOpen([])).toBe(false);
  });

  it('구 API로 연 경우도 잡는다', () => {
    expect(restartedAfterOpen([L('openURL(구) 호출 → https://x'), L('앱 마운트 (mountedAt=2)')])).toBe(true);
  });

  it('광고 시도는 열기 호출로 세지 않는다', () => {
    // 광고는 앱을 떠나지 않으므로 여기 섞이면 안 된다.
    expect(restartedAfterOpen([L('광고 #1 load 요청'), L('앱 마운트 (mountedAt=2)')])).toBe(false);
  });
});

