import { describe, expect, it } from 'vitest';

import { cueAt, warnColors, warnProgress } from './restCue';

describe('cueAt — 경계 통과 판정', () => {
  it('10초 경계를 내려오면 warn 하나', () => {
    expect(cueAt(11, 10)).toBe('warn');
  });

  it('같은 초가 반복되면 아무 신호도 안 낸다 — 250ms 틱이 초당 네 번 돈다', () => {
    // ★ 이 가드가 없으면 warn·tick이 초마다 3~4번 겹쳐 울린다. 화면 테스트의 「1회」 단언과
    //   짝이지만, 여기서 잠가야 원인 자리에서 죽는다.
    expect(cueAt(10, 10)).toBeNull();
    expect(cueAt(3, 3)).toBeNull();
    expect(cueAt(0, 0)).toBeNull();
  });

  it('경계 안쪽을 한 칸 내려가는 것만으로는 안 낸다 — warn은 통과 순간에 한 번뿐', () => {
    expect(cueAt(10, 9)).toBeNull();
    expect(cueAt(9, 8)).toBeNull();
    expect(cueAt(6, 5)).toBeNull();
  });

  it('3·2·1에 새로 닿으면 tick', () => {
    expect(cueAt(4, 3)).toBe('tick');
    expect(cueAt(3, 2)).toBe('tick');
    expect(cueAt(2, 1)).toBe('tick');
  });

  it('0에 닿으면 go', () => {
    expect(cueAt(1, 0)).toBe('go');
  });

  it('여러 경계를 한 틱에 건너뛰어도 하나만 — go > tick > warn', () => {
    // 결정 6: 백그라운드에 갔다 오면 놓친 신호를 몰아서 내지 않는다. 우선순위가 뒤집히면
    // 12→0 복귀에 「딩동」이 울리고 시작음이 사라진다.
    expect(cueAt(12, 0)).toBe('go');
    expect(cueAt(12, 2)).toBe('tick');
    expect(cueAt(12, 7)).toBe('warn');
  });

  it('휴식 초반에는 아무 소리도 안 난다', () => {
    expect(cueAt(45, 44)).toBeNull();
    expect(cueAt(60, 30)).toBeNull();
  });

  it('시간이 거꾸로 가도(휴식 재시작) 신호를 내지 않는다', () => {
    // 다음 휴식이 시작되면 left가 3 → 60으로 뛴다. 상승 전이에 신호가 붙으면
    // 휴식 시작 순간에 시작음이 울린다.
    expect(cueAt(0, 60)).toBeNull();
    expect(cueAt(2, 9)).toBeNull();
  });
});

describe('warnProgress — 붉어짐 진행도', () => {
  it('10초 밖은 0, 0초는 1, 5초는 절반', () => {
    expect(warnProgress(11)).toBe(0);
    expect(warnProgress(10)).toBe(0);
    expect(warnProgress(5)).toBe(0.5);
    expect(warnProgress(0)).toBe(1);
  });

  it('범위 밖은 클램프된다', () => {
    expect(warnProgress(60)).toBe(0);
    expect(warnProgress(-3)).toBe(1);
  });
});

describe('warnColors — V1 색 결정은 한 곳에서만', () => {
  it('10초 밖이면 기본 배경 그대로', () => {
    // `--bg-sub`(#f9fafb)의 실값. index.css를 바꾸면 restCue.ts도 함께 바꾼다.
    expect(warnColors(11).bg).toBe('rgb(249, 250, 251)');
  });

  it('0초면 진홍', () => {
    expect(warnColors(0).bg).toBe('rgb(183, 28, 48)');
  });

  it('중간은 선형 보간 — 계단이 아니라 램프다', () => {
    expect(warnColors(5).bg).toBe('rgb(216, 139, 150)');
  });

  it('글자 반전 문턱은 4초다 — 5초에는 아직 검정', () => {
    expect(warnColors(5).inverted).toBe(false);
    expect(warnColors(4).inverted).toBe(true);
    expect(warnColors(11).inverted).toBe(false);
  });
});
