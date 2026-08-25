# pricelog

토스쇼핑 상품의 **가격 이력을 매일 쌓아, 지금의 할인이 진짜인지 판정**하는 웹사이트.

> "할인율 40%라는데, 이 상품 지난 60일 평균가가 오늘 가격보다 쌌습니다."

---

## 문서 내비게이터

| 문서 | 내용 |
|---|---|
| [plan.md](plan.md) | **앞으로 할 일** — 살아있는 실행 계획 |
| [changeLog.md](changeLog.md) | **완료 기록** — 역순, 왜/무엇을 |
| [claude-docs/troubleshooting.md](claude-docs/troubleshooting.md) | **함정 + 승격** — 1분+ 디버깅했으면 여기 |
| [docs/2026-08-25-design.md](docs/2026-08-25-design.md) | 설계 — 아키텍처·데이터 모델·판정 로직 |
| [docs/ideas.md](docs/ideas.md) | 아이템 선정 경위 + 접은 안들의 **접은 이유와 되살릴 조건** |

**실행 환경은 앱인토스 미니앱 단독**이다. 웹사이트 채널은 없다.

## 스택

| | |
|---|---|
| 미니앱 | Vite + React **18** + `@apps-in-toss/web-framework` + `@toss/tds-mobile` · Vitest |
| 서버 | Spring Boot + PostgreSQL · JUnit · 수집은 `@Scheduled` |
| 인프라 | AWS EC2 t4g.medium + Elastic IP · nginx(TLS 종단) |

⚠️ 미니앱 React는 **18**로 핀한다 — TDS 2.5.1의 peer가 19를 받지 않는다.

## 상태

**Phase 0.5 — 쉐어링크 복귀 검증** 진행 중.

미니앱에서 쉐어링크를 열면 앱 복귀가 불안정하다는 제보가 있고, **수익 전부가 그 링크에 달려 있다.** 나머지 설계는 이 검증 통과를 전제하므로 가장 먼저 잰다. 자세한 배경은 [설계 §2](docs/2026-08-25-design.md).

이 검증에는 **Open API 승인이 필요 없다** — 토스쇼핑 앱에서 수동 발급한 쉐어링크 하나면 된다.

## 개발 셋업

```bash
git config core.hooksPath .githooks
```

pre-commit 훅이 troubleshooting 목차의 stale·형식 오류를 검사해 커밋을 거부한다.
