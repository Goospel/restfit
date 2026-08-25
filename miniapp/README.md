# miniapp — Phase 0.5 실측

**한 번의 실기기 테스트로 둘을 잰다.** 배경은 [설계 §10](../docs/2026-08-25-design.md).

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
- **`StrictMode`를 일부러 쓰지 않는다.** React 18 StrictMode는 개발 모드에서 effect를 두 번 실행해 마운트 로그를 오염시킨다. 관측 도구가 관측을 망치면 안 된다.
- **TDS(`@toss/tds-mobile`)를 아직 넣지 않았다.** 실측에 불필요하다. 다만 React는 **18로 핀**해 뒀다 — TDS 2.5.1의 peer가 19를 받지 않아 나중에 충돌하지 않도록.
- `awaitAdEvent`는 Phase 3 광고 통합에서 **그대로 재사용**한다. 콜백을 Promise로 감싸는 자리라 정리 함수 누락·중복 종료·타임아웃을 테스트로 못 박아 뒀다.

## 개발

```bash
npm install
npm test      # 31건 (returnTracker · verifyLog · adProbe)
npm run dev   # http://localhost:5310
npm run build # tsc -b && vite build → dist/
```

브라우저에서 복귀 감지를 흉내 내려면 콘솔에서:

```js
Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});
document.dispatchEvent(new Event('visibilitychange'));
Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'visible'});
document.dispatchEvent(new Event('visibilitychange'));
```
