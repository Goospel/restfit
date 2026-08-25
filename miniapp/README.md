# miniapp — 홈트가어렵나

앱 본체(홈·기구·운동·기록)와 **Phase 0.5 실측 도구**가 함께 들어 있다. 배경은 [설계](../docs/2026-08-25-design.md).

---

## 실기기에 올리기 (실측 전제)

**광고는 토스 앱 안에서만 뜬다.** 브라우저에서는 SDK가 없어 아무것도 안 나온다 — 그래서 실측 전에 배포가 먼저다.

```bash
npm run release          # npm run build && ait build → home-workout-hard.ait
npx ait token add        # 콘솔에서 받은 API 키를 default 프로필에 저장 (~/.ait/credentials)
npx ait deploy           # 업로드. intoss-private scheme이 나온다
```

1. **앱인토스 콘솔에 앱을 등록**하고 **API 키**를 받는다 ← *이게 없으면 `deploy`에서 막힌다*
2. `ait deploy`가 뱉는 **`intoss-private://…` scheme**을 폰으로 열면 **심사 없이** 토스 앱 안에서 실행된다
3. 콘솔에서 **광고 그룹 ID**를 발급받는다
4. 앱에서 **기록 탭 → `개발자용 · Phase 0.5 실측`** 으로 들어가 아래 ①②를 잰다

> `npm run release`가 두 단계를 묶는 이유: `ait build`는 `dist/`를 **있는 그대로** 싸기 때문에, 빌드를 빼먹으면 옛 번들이 그대로 올라간다(BookTimer T-150이 그 사고였다).

> ⚠️ **`ait deploy`는 `<appName>.ait`를 찾는 게 아니라 「패키지 루트에서 발견되는 첫 `.ait` 파일」을 올린다.** `appName`을 바꾸면 옛 이름의 아티팩트가 그대로 남아서, 그게 먼저 잡히면 **엉뚱한 번들이 배포된다.** 이름을 바꾼 뒤에는 `ls *.ait`로 **한 개만 있는지 확인**하거나 `ait deploy --location home-workout-hard.ait`로 못박는다.

---

## ① 광고를 세션당 몇 번 틀 수 있는가 ★★★

**이 서비스의 수익 전체가 이 가정 위에 있다.** 휴식마다 광고를 트는 모델인데 5회에서 막히면 절반 이하로 줄어든다.

### 절차

1. 앱인토스 콘솔에서 **광고 그룹 ID**를 발급받아 입력란에 넣는다
2. **「광고 1회 시도」를 반복해서 누른다.** 실제 흐름과 같은 순서(`load` → `show`)로 요청한다
3. **몇 번째에서 막히는지**, 어떤 에러가 나오는지 로그로 확인한다

### 읽는 법

```
광고 #3 load 요청
광고 #3 load OK — loaded
광고 #3 show OK — impression      ← 정상
```

```
광고 #6 load 요청
광고 #6 load 실패 — no fill       ← 여기서 막혔다. 6회가 상한
```

`timeout`은 15초(load) / 90초(show) 안에 아무 이벤트도 안 온 경우다.

⚠️ **앱인토스 광고 정책에 노출 빈도 제한이 있는지도 함께 확인한다.** 정책이 막으면 실측 이전에 끝이다.

---

## ② 미니앱에서 쉐어링크 복귀가 되는가

[앱인토스 개발자 커뮤니티](https://techchat-apps-in-toss.toss.im/t/toss-im/4625)에 앱 복귀가 불안정하다는 제보가 있고 토스 답변은 *"내부 개선 논의 중"*(미해결)이다. 제보자는 결국 토스쇼핑 링크를 빼고 쿠팡을 쓰고 있다.

**쉐어링크는 보조 수익이라 실패해도 치명적이지 않다.** 실패하면 광고 단독으로 간다.

### 절차

1. **쉐어링크를 수동으로 발급** — 토스쇼핑 앱에서 아무 상품이나 열고 상단 공유 아이콘 → **쉐어링크 공유하기**
   > Open API 승인이 **필요 없다.** 승인을 기다리지 않고 지금 잴 수 있다.
2. 링크를 붙여넣고 **`Device.openURL`** 을 누른다
3. 토스쇼핑에서 잠시 머문 뒤 미니앱으로 돌아온다
4. **`openURL (구 API)`** 로도 반복한다

### 읽는 법

| 로그 흐름 | 뜻 |
|---|---|
| `호출 →` → `복귀 감지` | ✅ **정상.** 세션이 유지된 채 돌아왔다 |
| `호출 →` → `앱 마운트` | ❌ **세션이 꼬여 재시작됐다.** 화면에 경고가 뜬다 |
| 아무것도 없음 | ❌ **복귀 자체가 실패했다** |

### 두 버튼을 다 눌러야 하는 이유

프레임워크에서 `openURL`은 **deprecated**이고 `Device.openURL`이 후속인데, **커뮤니티 제보는 구 API 기준**이었다. 시그니처가 같아 같은 브리지일 가능성이 높지만 후속에서 고쳐졌을 수도 있다.

---

## 설계 메모

- **로그는 localStorage에 남는다.** 재려는 실패 모드 중 하나가 "세션이 꼬여 재시작"인데, 메모리에만 두면 재시작 순간 「호출 → 재시작」 순서가 통째로 사라져 정작 알고 싶은 증거를 잃는다.
- **재시작 판정은 「열기 호출 다음에 마운트가 왔는가」로 좁혔다.** 단순히 "마운트 2번 이상"으로 세면 **어제 로그에도 걸린다**(로그가 저장소에 남으니까). 오탐 하나면 실측 전체를 못 믿게 된다.
- **`StrictMode`는 Phase 2에서 다시 켰다.** 처음엔 이중 마운트가 실측 로그를 오염시킬까 봐 껐는데, 재시작 판정이 「열기 호출 **다음에** 마운트가 왔는가」라 이중 마운트에 영향받지 않는다. 반대로 타이머·광고 effect의 정리 누락은 StrictMode가 아니면 못 잡는다. **관측을 지키려다 진짜 버그를 놓치는 쪽이 더 비쌌다.**
- **TDS(`@toss/tds-mobile`)를 아직 넣지 않았다.** 실측에 불필요하다. 다만 React는 **18로 핀**해 뒀다 — TDS 2.5.1의 peer가 19를 받지 않아 나중에 충돌하지 않도록.
- `awaitAdEvent`는 Phase 3 광고 통합에서 **그대로 재사용**한다. 콜백을 Promise로 감싸는 자리라 정리 함수 누락·중복 종료·타임아웃을 테스트로 못 박아 뒀다.

## 개발

```bash
npm install
npm test        # 140건
npm run dev     # http://localhost:5310
npm run build   # tsc -b && vite build → dist/
npm run release # build + ait build → .ait 아티팩트
npm run data    # 운동 데이터 재생성 (원본 정제 → src/data/exercises.json)
```

브라우저에서 복귀 감지를 흉내 내려면 콘솔에서:

```js
Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});
document.dispatchEvent(new Event('visibilitychange'));
Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'visible'});
document.dispatchEvent(new Event('visibilitychange'));
```
