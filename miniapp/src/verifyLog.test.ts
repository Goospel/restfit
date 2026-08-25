import { describe, expect, it } from 'vitest';

import { appendLog, clearLog, readLog } from './verifyLog';

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
    s.setItem('pricelog.verify.log', '{그냥 쓰레기');

    expect(readLog(s)).toEqual([]);
  });

  it('배열이 아닌 값이 들어 있어도 빈 목록을 준다', () => {
    const s = fakeStorage();
    s.setItem('pricelog.verify.log', '{"a":1}');

    expect(readLog(s)).toEqual([]);
  });

  it('형태가 맞지 않는 항목은 걸러낸다', () => {
    const s = fakeStorage();
    s.setItem(
      'pricelog.verify.log',
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
