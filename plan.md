# plan — 토스쇼핑 가격 이력 검증 미니앱

앞으로 할 일. 완료 기록은 [changeLog.md](changeLog.md), 함정은 [claude-docs/troubleshooting.md](claude-docs/troubleshooting.md).
설계는 [docs/2026-08-25-design.md](docs/2026-08-25-design.md), 아이템 선정 경위는 [docs/ideas.md](docs/ideas.md).

**범례** ✅완료 / 🔜다음 / ⬜예정 / ⏸의도적 보류 / ⚠️리스크·전제

---

## ⚠️ 전제

- ⬜ **쉐어링크 Open API 신청** *(사용자 진행)* — 어드민에서 Access·Secret Key 발급 + 출발지 IP 등록
  - 시범운영 중이라 승인 기간 불확실
  - **승인 전에도 Phase 0.5와 Phase 1은 전부 진행 가능** — 대기하지 않는다
- ⬜ EC2 t4g.medium + Elastic IP → 어드민에 IP 등록
- ⬜ 미니앱 이름 결정 (⚠️ **"토스" 사용 불가**)

---

## Phase 0 — 프로젝트 셋업 ✅

- ✅ 아이템 확정 및 경위 기록 (`docs/ideas.md`)
- ✅ 설계 문서
- ✅ 작업 추적 3종 + troubleshooting 분할 시스템 (pre-commit 훅 동작 실측 확인)
- ✅ git 초기화 + 초기 커밋
- ✅ **설계 개정** — 웹사이트 → 앱인토스 미니앱 단독, Spring Boot + Postgres

## Phase 0.5 — ⚠️ 쉐어링크 복귀 검증 (최우선) 🔜

**이게 실패하면 수익 모델이 성립하지 않는다.** 나머지 Phase는 전부 이 검증 통과를 전제한다.
설계 [§2](docs/2026-08-25-design.md) 참조.

- ✅ 미니앱 스캐폴드 — Vite + React **18** + `@apps-in-toss/web-framework`
  - ⚠️ React 19 불가 (TDS 2.5.1 peer 제약). TDS는 검증에 불필요해 아직 안 넣었고 React 18 핀만 걸어 뒀다
- ✅ 복귀 감지 로직 TDD (`returnTracker` · `verifyLog` — 15건, 돌연변이 4종으로 실효성 확인)
- ✅ 검증 화면 — URL 입력 + `Device.openURL` / 구 `openURL` 버튼 + 복귀 로그(localStorage 영속)
- ✅ 브라우저에서 전 경로 실측 — `visibilitychange` → 감지 → 화면 반영 확인
- ⬜ **미니앱 배포** *(사용자)* — `npm run build` → `npx ait build` → `npx ait deploy`
- ⬜ **수동 쉐어링크 발급** *(사용자)* — 토스쇼핑 앱에서 상품 공유 → "쉐어링크 공유하기". **Open API 승인 불필요**
- ⬜ **실기기 검증** *(사용자)* — 두 버튼 모두. 판정 기준은 [miniapp/README.md](miniapp/README.md)
- ⬜ 결과를 `changeLog` + (실패 시) `troubleshooting`에 기록

> 이 스캐폴드는 본 프로젝트의 시작점이라 **버리는 코드가 아니다.**

## Phase 1 — 판정 로직 (API 승인 불필요)

순수 로직이라 목 데이터로 전부 TDD 가능하다.

- ⬜ Spring Boot 프로젝트 초기화 (Gradle + JUnit)
- ⬜ 도메인 타입 — `PricePoint`, `Verdict`, API 응답 DTO
- ⬜ **`verdict()` TDD**
  - Red: 관측일 부족 / 역대최저 / 2% 경계 / 최근에 더 쌌음 / 공백 있는 이력
- ⬜ **`inflatedOriginal()` TDD** — 원가가 이력에 있음/없음/이력 0건
- ⬜ **하루특가 판정 TDD** — 어제와 같은 가격 / 실제로 내려간 경우
- ⬜ **응답 정규화 TDD** — `resultType: FAIL` / `display_price<=0` / `original<display` / 필드 누락
- ⬜ Postgres 스키마 + 마이그레이션 (설계 §5)

## Phase 2 — 수집기 ⚠️API 필요

- ⬜ OAuth2 토큰 발급·캐싱 (유효기간 약 1년, 재발급 남용 금지)
- ⬜ API 클라이언트 — 커서 페이징, 429 `Retry-After`, 5xx 백오프, **`resultType` 검사**
- ⬜ **1차 실측 수집** — 카테고리 트리 크기·하루특가 편성 규모를 잰다
  - ⚠️ **단계별 한도 배분(10,000/일)은 이 실측으로 확정한다.** 미리 숫자를 박지 않는다
- ⬜ `@Scheduled` 파이프라인 (설계 §6 우선순위: 하루특가 → 전체베스트 → 카테고리 → 누락 보충)
- ⬜ 커서 저장 / 한도 소진 시 다음날 이어받기
- ⬜ 추적 대상 은퇴 규칙
- ⬜ 쉐어링크 발급 + `sharelinks` 캐싱
- ⬜ `SHARELINK_OPENAPI_ACCESS_DENIED` 시 즉시 중단 + 알림

## Phase 3 — API + 미니앱 화면

- ⬜ `GET /api/deals` · `/api/best` · `/api/products/{id}` · `/api/categories` · `/api/categories/{id}/products`
- ⬜ 미니앱 홈 — 오늘의 진짜 특가 + 마감 임박
- ⬜ 미니앱 상품 상세 — **가격 그래프(인라인 SVG)** · 판정 뱃지 · 쉐어링크 버튼 · **대가성 문구**
- ⬜ 미니앱 카테고리
- ⬜ **판정 불가 구간 UI** — *"N일째 추적 중"*. 미니앱은 노출이 즉시 시작돼 공백이 그대로 드러나므로 중요하다

## Phase 4 — 배포

- ⬜ EC2 프로비저닝 — Spring Boot + PostgreSQL 직접 설치, nginx(TLS 종단), certbot
- ⬜ `pg_dump` 일 1회 백업
- ⬜ 미니앱 배포 파이프라인 (`ait build` → `ait deploy`)
  - ⚠️ BookTimer T-150 — 수동 3단계는 스테일 번들을 심사에 올린 적이 있다. 스크립트 하나로 묶고 산출물을 검증한다
- ⬜ 앱인토스 심사 제출

---

## ⏸ 의도적 보류

- ⏸ **앱인토스 리워드 광고** — 부수입 경로. Phase 0.5 검증이 실패했을 때의 대안으로 남긴다
- ⏸ **웹사이트 채널** — 앱인토스 단독으로 확정. SEO 설계는 전부 폐기됐다
- ⏸ **크로스 플랫폼 가격 비교** — 동일 상품 식별이 미해결 난제
- ⏸ **자취·이사 플래너** — 별도 프로젝트. 경위는 [docs/ideas.md §2](docs/ideas.md)

---

## ⚠️ 상시 주의

- **대가성 문구**를 쉐어링크가 노출되는 모든 화면에 표시 (운영정책 필수)
- 조회 API의 `productUrl`은 **추적되지 않는다.** 반드시 발급 API의 `shortUrl`을 쓴다
- 수수료 10%는 **이벤트 요율**이다. 코드에 하드코딩하지 않는다
- `resultType`을 반드시 확인한다. **HTTP 200이어도 `FAIL`일 수 있다**
- 미니앱 React는 **18**로 핀한다 (TDS peer 제약)
