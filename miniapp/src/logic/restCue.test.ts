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
    expect(warnColors(11).bg).toBe('rgb(242, 238, 231)');
  });

  it('0초면 진홍', () => {
    expect(warnColors(0).bg).toBe('rgb(183, 28, 48)');
  });

  it('중간은 선형 보간 — 계단이 아니라 램프다', () => {
    expect(warnColors(5).bg).toBe('rgb(213, 133, 140)');
  });

  it('글자 반전 문턱은 4초다 — 5초에는 아직 검정', () => {
    expect(warnColors(5).inverted).toBe(false);
    expect(warnColors(4).inverted).toBe(true);
    expect(warnColors(11).inverted).toBe(false);
  });
});

describe('warnColors — 대비는 눈이 아니라 계산으로 잠근다', () => {
  /**
   * 배경이 **연속으로 변하는** 화면이라 「이 색이 예뻐 보인다」는 계측기가 못 된다.
   * 램프 중간 어딘가에서만 글자가 녹는 일이 실제로 났다(문구 색이 램프 종점 색과 같아서
   * 배경이 짙어질수록 같아졌다 — 최저 2.50:1). 그래서 **전 구간을 돌며 WCAG 대비를 센다.**
   */
  const parse = (c: string) =>
    c.startsWith('#') ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : c.match(/\d+/g)!.map(Number);

  /** WCAG 2.1 상대휘도. */
  function luminance(color: string): number {
    const [r, g, b] = parse(color).map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  const contrast = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  /** 남은 10초 전 구간(신호가 사는 구간)에서 가장 나쁜 대비와 그 초. */
  function worst(pick: (c: ReturnType<typeof warnColors>) => string) {
    let min = Infinity;
    let at = -1;
    for (let left = 10; left >= 0; left--) {
      const c = warnColors(left);
      const ratio = contrast(pick(c), c.bg);
      if (ratio < min) [min, at] = [ratio, left];
    }
    return { min, at };
  }

  it('대비 계산이 먼저 맞다 — 흰 바탕의 검정은 21:1, 자기 자신은 1:1', () => {
    // ★ 계측기의 눈금부터 잠근다. 이게 틀리면 아래 두 단언은 늘 초록인 장식이 된다.
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrast('rgb(183, 28, 48)', '#b71c30')).toBeCloseTo(1, 5);
  });

  it('「다음 세트 준비」 문구는 전 구간에서 본문 AA(4.5:1)를 넘는다', () => {
    // 15px bold는 WCAG large-text(18.66px bold) 미만이라 완화 기준을 못 쓴다.
    const { min, at } = worst((c) => c.phrase);
    // 최악 지점을 메시지에 싣는다 — 「어딘가에서 녹는다」만 알면 고칠 데를 다시 찾아야 한다.
    expect(min, `최저 ${min.toFixed(2)}:1 @ 남은 ${at}초`).toBeGreaterThanOrEqual(4.5);
  });

  it('타이머 숫자는 전 구간에서 large-text AA(3:1)를 넘는다', () => {
    // 72px bold라 완화 기준이 적용된다 — 이 문턱이 `inverted`가 4초인 이유다.
    const { min } = worst((c) => c.text);
    expect(min).toBeGreaterThanOrEqual(3);
  });
});
