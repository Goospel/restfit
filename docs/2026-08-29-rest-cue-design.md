# 휴식 마지막 10초 준비 신호 — 소리 + 붉어지는 화면 (2026-08-29)

> 시안 화면 3종 × 소리 3종 비교에서 **V1(배경 전체가 물든다) + S1(미리 알림형)로 확정** —
> 사용자 결정 2026-08-29. 시안(체험 데모 포함):
> https://claude.ai/code/artifact/a33029d7-4413-49cf-8ef4-1dbd6de2c546

## 1. 배경 · 목표

휴식이 끝나면 화면은 자동으로 다음 세트로 넘어가지만(`Workout.tsx`의 `endRest` 자동 호출),
폰을 내려놓고 쉬는 사람은 그 순간을 놓친다. **남은 10초부터 소리와 화면으로 「다음 세트
준비」 신호**를 보내, 몸이 화면보다 먼저 알게 한다.

## 2. 확정 결정

| # | 결정 | 내용 |
|---|---|---|
| 1 | 화면 효과 | **V1 — 배경 전체가 물든다.** −10초부터 배경이 붉게 램프, 깊어지면 글자가 흰색으로 뒤집힌다. 마지막 3초는 초당 1회 심장박동 펄스. V2(비네트)·V3(숫자만) 기각 — 「점점 빨개지는 화면」 요구에 V1이 정면으로 답한다 |
| 2 | 소리 | **S1 — 미리 알림형.** −10초 두 음 알림(딩–동) 1회 → 조용 → −3·−2·−1초 틱 → 0초 시작음. S2(매초 틱) 기각: 세션당 열두 번 반복되기엔 시끄럽다. S3(미니멀) 기각: 3·2·1 시동 효과가 없다 |
| 3 | 음원 | **웹 오디오 합성음.** 음원 파일 없음 — 번들 +0바이트. 실패는 조용히 넘어간다(광고와 같은 규율 — 신호는 기능이지 뼈대가 아니다) |
| 4 | 소리 없는 완결 | 웹뷰·무음 스위치·기기 정책으로 소리가 안 날 수 있다 — **화면이 소리와 같은 정보를 다 전달한다**(색 램프 · 펄스 · 「다음 세트 준비」 문구) |
| 5 | 광고 관계 | **신호는 광고에 양보하지 않는다.** 타이머가 절대 시각이듯 신호도 시각 기준으로 돈다. 전면 광고를 늦게 닫으면 닫는 순간 이미 물든 화면이 보인다. 광고 음성과 비프가 겹칠 수 있으나 비프가 짧아 실해가 없다 |
| 6 | 놓친 신호 | **몰아서 내지 않는다.** 백그라운드에 갔다 오면 복귀 시점의 상태만 — 한 틱에 여러 경계를 건너뛰었으면 **가장 마지막 신호 하나만** 낸다 |
| 7 | 안전 | 펄스는 **1초 1회**(3Hz 이상 점멸 금지 — 광과민성). `prefers-reduced-motion`이면 펄스 생략(색 램프는 모션이 아니라 유지) |

## 3. 설계

### 3.1 신호 판정 — 순수 로직 (`miniapp/src/logic/restCue.ts` 신설)

`restRemaining`이 **올림 정수(초)** 를 돌려주므로(`session.ts:82`) 판정은 정수 경계 통과다.

```ts
export type Cue = 'warn' | 'tick' | 'go';

/** 직전 틱의 남은 초 → 이번 틱의 남은 초로 건너올 때 낼 신호. 없으면 null. */
export function cueAt(prevLeft: number, left: number): Cue | null;
```

- `prevLeft > 10 && left <= 10` → `'warn'` (단, `left > 0`일 때)
- `left`가 3·2·1에 **새로 도달**(`prevLeft > left`)  → `'tick'`
- `prevLeft > 0 && left === 0` → `'go'`
- 한 틱에 여러 경계를 건넜으면(스로틀 복귀: 12→0) **우선순위 go > tick > warn으로 하나만**(결정 6)
- `prevLeft === left`면 항상 null — 250ms 틱이 초당 4번 도는데 같은 신호가 반복되면 안 된다

```ts
/** 붉어짐 진행도 0~1. left > 10이면 0, left 0이면 1. */
export function warnProgress(left: number): number; // clamp((10 - left) / 10)

/** V1 색. 배경 rgb 문자열과 「글자 흰색 전환」 여부를 한 곳에서 정한다. */
export function warnColors(left: number): { bg: string; inverted: boolean };
```

- `bg`: `#f9fafb`(rgb 249,250,251 — `--bg-sub` 실값) → 진홍 `rgb(183,28,48)` 선형 보간.
  CSS 변수 `--bg-sub`를 직접 보간할 수 없어 실값을 쓴다 — **주석으로 `--bg-sub`와 짝임을 명시**해
  index.css를 바꾸는 사람이 여기도 바꾸게 한다.
- `inverted`: `left <= 4` — 배경이 어두워진 뒤 글자를 흰색 계열로 뒤집는 문턱.
  경계는 상수 하나로 두고 색 결정은 전부 이 함수에서 나온다(화면에 if를 흩뿌리지 않는다).

### 3.2 소리 — `miniapp/src/restSound.ts` 신설 (부수효과 모듈, 얇게)

```ts
export function primeSound(): void;      // AudioContext 생성/resume — 사용자 제스처 직후에만 의미
export function playCue(cue: Cue): void; // warn/tick/go 합성음 재생. 실패는 조용히 무시
```

- **S1 음표**: warn = 880Hz 0.16s + 660Hz 0.22s(0.18s 뒤) · tick = 1046Hz 0.07s · go = 1318Hz 2회(0.10s·0.18s). 게인 0.14~0.18, sine.
- `primeSound`는 **「세트 완료」 탭 핸들러에서** 부른다 — 브라우저 오디오는 사용자 제스처
  뒤에만 열리는데, 휴식은 항상 그 탭 직후라 조건이 저절로 만족된다.
- AudioContext는 모듈 싱글턴. 전 구간 try/catch — 웹 오디오가 없는 환경(구형 웹뷰·jsdom)에서
  앱이 그대로 돈다. **로직은 넣지 않는다** — 판정은 전부 `restCue.ts`(순수)에 있고 이 모듈은
  스피커일 뿐이다.

### 3.3 화면 배선 (`Workout.tsx` 휴식 분기)

- `prevLeftRef`를 두고 `left`가 바뀔 때 `cueAt(prev, left)` → `playCue`. 휴식이 아닐 때는
  ref를 초기화해 다음 휴식의 첫 비교가 「휴식 길이 → …」로 시작하게 한다.
- 배경: `warnColors(left)`의 `bg`를 휴식 `<main>` 인라인 스타일에. `transition: 'background 1s linear'`를
  함께 걸어 1초 단위 계단을 눈에는 연속 램프로 보이게 한다.
- 글자: `inverted`면 타이머·라벨·「다음 ·」·「휴식 건너뛰기」를 흰색 계열로. 색 값은 화면에
  흩뿌리지 말고 휴식 분기 안에서 한 번 정해 재사용.
- **「다음 세트 준비」 문구**: `left <= 10 && left > 0`일 때 타이머 아래 표시(굵게, 붉은색 →
  inverted면 흰색).
- **펄스**: `left <= 3 && left > 0`일 때 타이머 숫자에 `key={left}` + CSS 애니메이션 클래스 —
  초가 바뀔 때 리마운트로 1회 재생(scale 1→1.07→1, 160ms). `@keyframes`와
  `@media (prefers-reduced-motion: reduce) { animation: none }`은 `index.css`에.
- 0초 자동 전환(`endRest`)은 기존 그대로 — 이 개편은 소리·색만 얹는다.

### 3.4 관측·테스트 규율

- ⚠️ **트랜지션 걸린 속성은 판정 근거가 못 된다**(글로벌 원칙) — 테스트는 computed style이
  아니라 **인라인 스타일 문자열**(목표값)을 단언한다. jsdom은 애니메이션을 안 돌리므로 안전.
- 소리는 화면 테스트에서 `restSound`를 `vi.mock`으로 스파이 — 「경계 통과 시 playCue가 맞는
  인자로 불렸다」만 본다. 웹 오디오 자체는 테스트하지 않는다(jsdom에 없다).

## 4. 파일 변경 계획

| 구분 | 파일 |
|---|---|
| 신설 | `miniapp/src/logic/restCue.ts` + `restCue.test.ts` / `miniapp/src/restSound.ts` |
| 수정 | `miniapp/src/screens/Workout.tsx`(휴식 분기 배선) · `Workout.test.tsx` · `miniapp/src/index.css`(펄스 keyframes + reduced-motion) |
| 불변 | `session.ts`(타이머·전환 로직) · `adPlan.ts`(광고 판단) · 탭바 |

## 5. 테스트 계획 (TDD — Red 먼저)

- **`restCue.test.ts`** (순수 — jsdom 불필요):
  - `cueAt(11, 10) === 'warn'` / `cueAt(10, 10) === null`(반복 금지) / `cueAt(10, 9) === null`
  - `cueAt(4, 3) === 'tick'`, `(3, 2)`, `(2, 1)` / `cueAt(1, 0) === 'go'`
  - 몰아치기: `cueAt(12, 0) === 'go'` 하나만 / `cueAt(12, 2) === 'tick'` / `cueAt(45, 44) === null`
  - `warnProgress(11) === 0` / `warnProgress(0) === 1` / `warnProgress(5) === 0.5`
  - `warnColors(11).bg`가 기본 배경 리터럴 / `warnColors(0).bg === 'rgb(183, 28, 48)'` / `inverted`: `left 5 → false`, `left 4 → true`
- **`Workout.test.tsx`** (fake timers로 휴식 진입 후 시간 전진):
  - left > 10: 「다음 세트 준비」 없음 · 배경이 기본값
  - left = 8: 문구 표시 · 배경 인라인 스타일이 `warnColors(8).bg`와 일치
  - 경계 통과 시 `playCue('warn')`·`('tick')`·`('go')` 스파이 호출(각 1회)
  - 「세트 완료」 탭에서 `primeSound` 호출
  - 「휴식 건너뛰기」로 나가면 이후 신호 없음
- **돌연변이 후보**: warn 경계 10→9 / tick 대상 {3,2,1}→{3,2} / go 조건 제거 / 몰아치기 우선순위 뒤집기 / inverted 문턱 4→2 / `prevLeft === left` 반복 가드 제거 / primeSound 미배선.

## 6. 비목표

- 소리 끄기 설정(기기 볼륨이 토글) · 진동 · 음원 파일 · 휴식 길이·자동 전환 로직 변경 ·
  광고 로직 변경 · 탭바.
- 휴식 화면 밖(세트 진행·완료 화면)의 소리 — 신호는 휴식 마지막 10초에만 산다.
