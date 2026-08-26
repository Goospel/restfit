# 화면 시안

**단일 출처는 Figma 파일이다** — [restfit — 홈트가어렵나](https://www.figma.com/design/GB48ngYQ1J324DxQPwIh0m)

여기 PNG는 전부 거기서 뽑은 **산출물**이라 직접 편집하지 않는다. 시안을 고치면 다시 뽑아야 이 폴더가 stale이 되지 않는다. 아이콘의 [`icon.svg` → `png/`](../icon/README.md) 와 같은 관계다.

| 파일 | 화면 | 노드 |
|---|---|---|
| `01-home.png` | 오늘의 루틴 — **기록이 0인 첫 사용자 상태** | [5-2](https://www.figma.com/design/GB48ngYQ1J324DxQPwIh0m?node-id=5-2) |
| `02-workout.png` | 운동 진행 (세트 기록) | [6-2](https://www.figma.com/design/GB48ngYQ1J324DxQPwIh0m?node-id=6-2) |
| `03-rest.png` | 휴식 타이머 — 현재 | [2-2](https://www.figma.com/design/GB48ngYQ1J324DxQPwIh0m?node-id=2-2) |
| `04-rest-banner.png` | 휴식 타이머 — **배너 광고안** | [2-13](https://www.figma.com/design/GB48ngYQ1J324DxQPwIh0m?node-id=2-13) |
| `05-history.png` | 기록 | [6-32](https://www.figma.com/design/GB48ngYQ1J324DxQPwIh0m?node-id=6-32) |
| `06-equipment.png` | 보유 기구 | [5-49](https://www.figma.com/design/GB48ngYQ1J324DxQPwIh0m?node-id=5-49) |

390 x 844 (iPhone 14/15 논리 해상도). 보유 기구가 아래에서 잘리는 것은 **실기기와 같다** — 기구 10개가 한 화면에 안 들어가 스크롤한다.

## 무엇을 담고 있나

`04-rest-banner.png` 하나만 **코드에 없는 안**이다. Phase 3에서 배너 광고(`TossAds.attachBanner`)를 쓸 경우의 레이아웃이고, 「휴식 건너뛰기」를 가리지 않도록 12px 띄워 두었다(필수 CTA 가리기 금지 조항).

⚠️ **전면 광고(`showFullScreenAd`)는 이 레이아웃과 무관하다** — 시스템이 화면 전체를 덮으므로 우리가 자리를 비워 둘 것이 없다. 배너를 실제로 쓸지는 Phase 0.5 실측 결과에 달렸다([plan.md](../../plan.md)).

나머지 5장은 **코드를 그대로 옮긴 복제본**이다. 디자인 시스템 컴포넌트가 아니라 개별 프레임이고, 색·간격은 `miniapp/src/index.css`의 CSS 변수 값을 하드코딩했다. 그래서 **코드를 고치면 시안이 저절로 따라오지 않는다.**

## 다시 뽑는 법

Figma MCP가 붙은 Claude 세션에서 노드별로 `get_screenshot` → 반환된 URL을 `curl -L -o`로 내려받는다.

⚠️ `get_screenshot`은 **읽기 호출**이라 한도를 쓴다(Starter 플랜 월 20회). 6장이면 6회다. 반대로 Figma에 **쓰는** 호출은 한도가 없다.

⚠️ 한글은 `Noto Sans KR`로 만들었다. 폰트를 바꿀 땐 [T-219](../../claude-docs/troubleshooting/T-219.md)를 먼저 읽는다 — 목록에 있고 로드가 성공해도 실재하지 않는 폰트가 있다.
