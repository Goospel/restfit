# miniapp — 홈트가어렵나

앱 본체(홈·기구·운동·기록). 배경은 [설계](../docs/2026-08-25-design.md).

> **Phase 0.5 실측 도구(`Probe` 화면)는 걷었다.** 실측은 끝났고(광고 8/8 · 쉐어링크 복귀 정상),
> 결과와 근거는 [plan.md의 Phase 0.5](../plan.md)에 남아 있다. 다시 필요하면 git 이력에 있다.

---

## 실기기에 올리기

**광고는 토스 앱 안에서만 뜬다.** 브라우저에서는 SDK가 없어 아무것도 안 나온다.

```bash
npm run release          # npm run build && ait build → home-workout-hard.ait
npx ait token add        # 콘솔에서 받은 API 키를 default 프로필에 저장 (~/.ait/credentials)
npx ait deploy           # 업로드. intoss-private scheme이 나온다
```

1. **앱인토스 콘솔에 앱을 등록**하고 **API 키**를 받는다 ← *이게 없으면 `deploy`에서 막힌다*
2. `ait deploy`가 뱉는 **`intoss-private://…` scheme**을 폰으로 열면 **심사 없이** 토스 앱 안에서 실행된다

> `npm run release`가 두 단계를 묶는 이유: `ait build`는 `dist/`를 **있는 그대로** 싸기 때문에, 빌드를 빼먹으면 옛 번들이 그대로 올라간다(BookTimer T-150이 그 사고였다).

> ⚠️ **`ait deploy`는 `<appName>.ait`를 찾는 게 아니라 「패키지 루트에서 발견되는 첫 `.ait` 파일」을 올린다.** `appName`을 바꾸면 옛 이름의 아티팩트가 그대로 남아서, 그게 먼저 잡히면 **엉뚱한 번들이 배포된다.** 이름을 바꾼 뒤에는 `ls *.ait`로 **한 개만 있는지 확인**하거나 `ait deploy --location home-workout-hard.ait`로 못박는다.

---

## 개발용 입구는 배포 번들에 없다

기록 탭의 **「온보딩 다시 보기」** 는 개발용이다 — 폰에서는 localStorage를 손댈 방법이 없어, 온보딩을 고쳐도 이 버튼 없이는 실기기에서 두 번 볼 수 없다. 사용자에게는 「내 조건」에 기구·목적 변경이 이미 있어 필요 없다.

`History.tsx`의 `DEV_TOOLS = import.meta.env.MODE !== 'production'` 한 줄이 가른다. `vite build`의 기본 모드가 `production`이라 **릴리스에서는 상수 `false`로 접혀 블록이 트리셰이킹으로 사라진다** — 가리는 게 아니라 번들에 없다.

실기기에서 확인해야 하면 개발 모드로 뽑는다:

```bash
npm run release:dev      # vite build --mode development + ait build → 개발용 입구가 남은 번들
```

⚠️ **심사에 올릴 번들은 반드시 `npm run release`(production)로 다시 뽑는다.** 둘 다 같은 `dist/`를 쓰므로, 개발 번들을 만든 뒤 그대로 `ait deploy` 하면 개발용 입구가 딸려 나간다.

검증은 번들에서 문구를 직접 센다 — 소스에 따옴표째 실린 리터럴이라 minify에 살아남는다:

```bash
rg -c "온보딩 다시 보기" dist/assets/*.js    # production: 0건 / development: 1건
```

---

## 설계 메모

- **`StrictMode`는 Phase 2에서 다시 켰다.** 처음엔 이중 마운트가 실측 로그를 오염시킬까 봐 껐는데, 타이머·광고 effect의 정리 누락은 StrictMode가 아니면 못 잡는다. **관측을 지키려다 진짜 버그를 놓치는 쪽이 더 비쌌다.**
- **TDS(`@toss/tds-mobile`)를 아직 넣지 않았다.** 다만 React는 **18로 핀**해 뒀다 — TDS 2.5.1의 peer가 19를 받지 않아 나중에 충돌하지 않도록.
- `awaitAdEvent`(`adProbe.ts`)는 실측 도구에서 왔지만 **Phase 3 광고 통합이 그대로 쓴다.** 콜백을 Promise로 감싸는 자리라 정리 함수 누락·중복 종료·타임아웃을 테스트로 못 박아 뒀다.

## 개발

```bash
npm install
npm test            # 609건 (2026-09-02 기준)
npm run dev         # http://localhost:5310
npm run build       # tsc -b && vite build → dist/
npm run build:dev   # 개발용 입구가 남는 빌드 (--mode development)
npm run release     # build + ait build → .ait 아티팩트 (심사·출시용)
npm run release:dev # build:dev + ait build (실기기 확인용)
npm run data        # 운동 데이터 재생성 (원본 정제 → src/data/exercises.json)
npm run instructions # 운동 설명 번역 묶음 합치기 (PARTS_DIR·EX_SRC 필요 → src/data/instructions.json)
```

> `instructions`는 번역 자체를 하지 않는다 — Claude 배치가 만든 묶음(`part-N.ko.json`)을 원본과 대조 검사해 합칠 뿐이다. 묶음이 없으면 커밋된 `src/data/instructions.json`이 단일 출처이고, 틀린 문장은 그 키만 손으로 고친다(설계 `docs/2026-09-02-exercise-guide-design.md` §4).
