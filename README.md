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

## 스택

Next.js 16 (서버 모드) · React 19 · TypeScript · Tailwind 4 · SQLite · Vitest
배포: AWS EC2 t4g.small + Elastic IP · nginx · cron

## 상태

**Phase 1 (판정 로직)** 진행 예정. 쉐어링크 Open API 승인 대기 중이며, **승인 전에도 Phase 1은 목 데이터로 전부 진행 가능**하다.

## 개발 셋업

```bash
git config core.hooksPath .githooks
```

pre-commit 훅이 troubleshooting 목차의 stale·형식 오류를 검사해 커밋을 거부한다.
