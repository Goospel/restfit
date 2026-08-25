# miniapp — 쉐어링크 복귀 검증

Phase 0.5 검증 도구. 재는 것은 **딱 하나**다:

> 미니앱에서 토스쇼핑 쉐어링크를 열고 돌아왔을 때 세션이 살아 있는가?

[앱인토스 개발자 커뮤니티](https://techchat-apps-in-toss.toss.im/t/toss-im/4625)에 앱 복귀가 불안정하다는 제보가 있고
토스 답변은 *"내부 개선 논의 중"*(미해결)이다. **이 서비스의 수익 전부가 그 링크 하나에 달려 있어** 다른 설계보다 먼저 잰다.
배경은 [설계 §2](../docs/2026-08-25-design.md).

## 검증 절차

1. **쉐어링크를 수동으로 발급받는다** — 토스쇼핑 앱에서 아무 상품이나 열고 상단 공유 아이콘 → **쉐어링크 공유하기**
   > Open API 승인이 **필요 없다.** 그래서 승인을 기다리지 않고 지금 잴 수 있다.
2. 미니앱을 배포하고 **실기기**에서 연다
3. 받은 링크를 붙여넣고 **`Device.openURL`** 버튼을 누른다
4. 토스쇼핑에서 잠시 머문 뒤 뒤로 나와 미니앱으로 돌아온다
5. 화면의 로그를 읽는다
6. **`openURL (구 API)`** 버튼으로도 같은 절차를 반복한다

## 판정 — 로그를 이렇게 읽는다

| 로그 흐름 | 뜻 |
|---|---|
| `열기 호출` → `복귀 감지` | ✅ **정상.** 세션이 유지된 채 돌아왔다 |
| `열기 호출` → `앱 마운트` | ❌ **세션이 꼬여 재시작됐다.** 제보된 그 증상이다 (화면에 경고가 뜬다) |
| 아무것도 안 찍힘 | ❌ **복귀 자체가 실패했다** |

로그는 **localStorage에 남는다.** 미니앱이 재시작돼도 "호출 → 재시작" 순서가 화면에 그대로 보이기 때문이다.
메모리에만 두면 정작 알고 싶은 실패 모드에서 증거가 통째로 사라진다.

### 두 버튼을 다 눌러야 하는 이유

프레임워크에서 `openURL`은 **deprecated**이고 `Device.openURL`이 후속이다. 커뮤니티 제보는 **구 API 기준**이었다.
시그니처가 같아 같은 브리지일 가능성이 높지만, 후속 API에서 고쳐졌을 수도 있어 둘 다 잰다.

## 개발

```bash
npm install
npm test      # 감지 로직 15건
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

## 이 앱의 설계 메모

- **`StrictMode`를 일부러 쓰지 않는다.** React 18 StrictMode는 개발 모드에서 effect를 두 번 실행하는데,
  이 앱의 판정 근거가 「앱 마운트가 2번 찍히면 재시작」이라 켜 두면 개발 중 항상 재시작으로 보인다.
  관측 도구가 관측을 오염시키는 셈이라 뺐다.
- **TDS(`@toss/tds-mobile`)를 아직 넣지 않았다.** 검증에 불필요하다. 다만 React는 **18로 핀**해 뒀다 —
  TDS 2.5.1의 peer가 19를 받지 않아 나중에 넣을 때 충돌하지 않도록.
- 감지 로직(`returnTracker`)과 로그 저장(`verifyLog`)에만 테스트가 있다. 나머지는 UI라 실기기가 검증한다.
