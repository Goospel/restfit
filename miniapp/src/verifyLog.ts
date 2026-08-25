export type LogEntry = { t: number; msg: string };

/** 테스트도 이 상수를 쓴다 — 리터럴로 적어 두면 키를 바꿨을 때 테스트가 조용히 무의미해진다. */
export const KEY = 'restfit.verify.log';
const MAX = 100;

/**
 * 검증 로그를 localStorage에 남긴다.
 *
 * **메모리에만 두면 안 되는 이유**: 우리가 재려는 실패 모드 중 하나가 "세션이 꼬여 미니앱이 재시작되는 것"이다.
 * 재시작되면 React 상태는 통째로 날아가서, 정작 알고 싶은 "호출 → 재시작" 순서가 화면에서 사라진다.
 * 그래서 로그만은 저장소에 남겨 재시작을 건너 살아남게 한다.
 *
 * 저장소가 막힌 환경(프라이빗 모드 등)에서도 앱이 죽지 않도록 읽기·쓰기를 모두 감싼다.
 */
export function readLog(storage: Storage = localStorage): LogEntry[] {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is LogEntry =>
        typeof e === 'object' && e !== null && typeof (e as LogEntry).t === 'number' && typeof (e as LogEntry).msg === 'string',
    );
  } catch {
    return [];
  }
}

export function appendLog(msg: string, now: () => number = Date.now, storage: Storage = localStorage): LogEntry[] {
  const next = [...readLog(storage), { t: now(), msg }].slice(-MAX);
  try {
    storage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 저장 실패해도 화면 표시는 되도록 계산된 값을 그대로 돌려준다.
  }
  return next;
}

/**
 * 「세션이 꼬여 재시작됐는가」 판정.
 *
 * 단순히 「앱 마운트가 2번 이상」으로 세면 **어제 로그에도 걸린다** — 로그가 저장소에 남기 때문이다.
 * 오탐 하나면 실측 전체를 못 믿게 되므로, **열기 호출 다음에 마운트가 왔는가**로 좁힌다.
 * 광고는 앱을 떠나지 않으므로 열기 호출로 세지 않는다.
 */
export function restartedAfterOpen(log: LogEntry[]): boolean {
  const opened = log.findIndex((e) => e.msg.includes('openURL') && e.msg.includes('호출 →'));
  if (opened < 0) return false;
  return log.slice(opened + 1).some((e) => e.msg.startsWith('앱 마운트'));
}

export function clearLog(storage: Storage = localStorage): void {
  try {
    storage.removeItem(KEY);
  } catch {
    // 무시
  }
}
