/**
 * 밴드 아이콘(`src/components/Icon.tsx`의 `ICONS.band`) 생성기.
 *
 *   node scripts/gen-band-icon.mjs
 *
 * **왜 손으로 안 그리나.** 밴드는 머리가 굵고 꼬리로 갈수록 얇아지는 띠다. 선(stroke)으로는
 * 이 그림이 안 나온다 — path 하나에 굵기는 하나뿐이라, 겉모양만 좁아지고 선 굵기는 끝까지
 * 그대로다. 그러면 꼬리가 「가늘어진 띠」가 아니라 「그냥 선」으로 보여 원근이 안 난다.
 * 그래서 중심선을 좌우로 벌린 **닫힌 윤곽선을 면으로 채운다**(`FILLED_ICONS`).
 *
 * **면으로 채우면 생기는 함정.** 띠 반폭이 그 자리 곡률반경보다 커지면 안쪽 모서리가 제 살을
 * 파고들어 덩어리가 된다. 눈으로는 「왠지 뚱뚱하다」로만 보여 원인을 못 찾는다. 그래서
 * `pinch`(반폭÷곡률반경)를 재고, 한도 안에서 최대 굵기를 이분법으로 찾는다.
 *
 * **열쇠는 「같은 비율로 줄이기」다.** 파장·진폭을 함께 `k(t)=1-c·t`로 줄이면 곡률반경도 같은
 * 비율로 줄어 pinch가 길이 내내 일정해진다. 하나만 줄이면 반드시 어디선가 겹친다 —
 * 진폭만 줄이면 머리에서(굵은 데가 급커브를 돈다), 파장만 줄이면 꼬리에서(짧은 파장 + 큰 진폭).
 * 굵기는 `k^q`로 **더 빨리** 줄여도 pinch가 안 늘어(분자만 작아진다) 꼬리를 실오라기로 만든다.
 */
const TAU = Math.PI * 2;

/** 지금 쓰는 값. 모양을 바꾸려면 여기를 만지고 다시 돌린다. */
const SHAPE = {
  axis: 11, //  중심선이 나아가는 길이
  A0: 8, //     머리 쪽 진폭
  lam0: 22, //  머리 쪽 파장
  c: 0.75, //   파장·진폭이 꼬리에서 줄어드는 정도(k = 1 - c·t)
  q: 2.2, //    굵기가 줄어드는 빠르기(클수록 꼬리가 빨리 가늘어진다)
  wMin: 0.08, //꼬리 끝 반폭
  limit: 0.95, //허용 pinch. 1을 넘으면 눈에 보이게 겹친다
  samples: 15, //윤곽선 표본 수. 늘리면 매끄럽지만 path가 길어진다
  pad: 2.0, //   24 그리드 가장자리 여백
};

const round1 = (n) => Math.round(n * 10) / 10;

const line = ({ A0, lam0, c, axis }) => {
  const k = (t) => 1 - c * t;
  // 누적 위상은 1/파장의 적분이라 로그가 나온다.
  const phase = (t) => ((TAU * axis) / lam0) * (-Math.log(1 - c * t) / c);
  return { k, at: (t) => [12 + A0 * k(t) * Math.sin(phase(t)), 12 - axis / 2 + axis * t] };
};

const width = ({ k, w0, wMin, q }) => (t) => wMin + (w0 - wMin) * k(t) ** q;

/** 반폭 ÷ 곡률반경의 최댓값. 1을 넘으면 안쪽이 확실히 겹친다. */
function pinch(at, w, samples = 400) {
  let worst = 0;
  const h = 5e-4;
  for (let i = 2; i < samples - 1; i++) {
    const t = i / samples;
    const [xa, ya] = at(t - h);
    const [xb, yb] = at(t);
    const [xc, yc] = at(t + h);
    const vx = (xc - xa) / (2 * h);
    const vy = (yc - ya) / (2 * h);
    const ax = (xc - 2 * xb + xa) / (h * h);
    const ay = (yc - 2 * yb + ya) / (h * h);
    const cross = Math.abs(vx * ay - vy * ax);
    const R = cross < 1e-9 ? Infinity : Math.hypot(vx, vy) ** 3 / cross;
    worst = Math.max(worst, w(t) / R);
  }
  return worst;
}

/** pinch가 한도 이하가 되는 최대 머리 반폭. */
function maxHead(shape) {
  const { k, at } = line(shape);
  let lo = 0.2;
  let hi = 9;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (pinch(at, width({ k, w0: mid, wMin: shape.wMin, q: shape.q })) <= shape.limit) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** 중심선 + 폭 → 닫힌 윤곽선 점열. */
function outline(at, w, n) {
  const up = [];
  const dn = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const [x, y] = at(t);
    const d = 1e-4;
    const [xa, ya] = at(Math.max(0, t - d));
    const [xb, yb] = at(Math.min(1, t + d));
    const len = Math.hypot(xb - xa, yb - ya) || 1;
    const nx = -(yb - ya) / len;
    const ny = (xb - xa) / len;
    up.push([x + nx * w(t), y + ny * w(t)]);
    dn.push([x - nx * w(t), y - ny * w(t)]);
  }
  return [...up, ...dn.reverse()];
}

/** 24 그리드 한가운데에 꽉 채워 넣는다(가로세로 같은 배율). */
function fit(pts, pad) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const box = 24 - pad * 2;
  const s = Math.min(box / (maxX - minX), box / (maxY - minY));
  return { pts: pts.map(([x, y]) => [12 + (x - (minX + maxX) / 2) * s, 12 + (y - (minY + maxY) / 2) * s]), s };
}

/** 닫힌 점열 → 부드러운 3차 베지에(카트뮬-롬 변환). */
function toPath(pts) {
  const at = (i) => pts[(i + pts.length) % pts.length];
  let d = `M${round1(pts[0][0])} ${round1(pts[0][1])}`;
  for (let i = 0; i < pts.length; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    d += `C${round1(p1[0] + (p2[0] - p0[0]) / 6)} ${round1(p1[1] + (p2[1] - p0[1]) / 6)}`;
    d += ` ${round1(p2[0] - (p3[0] - p1[0]) / 6)} ${round1(p2[1] - (p3[1] - p1[1]) / 6)}`;
    d += ` ${round1(p2[0])} ${round1(p2[1])}`;
  }
  return `${d}z`;
}

const { k, at } = line(SHAPE);
const w0 = maxHead(SHAPE);
const w = width({ k, w0, wMin: SHAPE.wMin, q: SHAPE.q });
const { pts, s } = fit(outline(at, w, SHAPE.samples), SHAPE.pad);
const d = toPath(pts);

console.log(`pinch ${pinch(at, w).toFixed(2)} (한도 ${SHAPE.limit})`);
console.log(`머리 두께 ${(2 * w0 * s).toFixed(1)} → 꼬리 ${(2 * w(1) * s).toFixed(2)} (24 그리드 기준)`);
console.log(`path ${d.length}자\n`);
console.log(d);
