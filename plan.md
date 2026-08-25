# plan — 토스쇼핑 가격 이력 검증 서비스

앞으로 할 일. 완료 기록은 [changeLog.md](changeLog.md), 함정은 [claude-docs/troubleshooting.md](claude-docs/troubleshooting.md).
설계는 [docs/2026-08-25-design.md](docs/2026-08-25-design.md), 아이템 선정 경위는 [docs/ideas.md](docs/ideas.md).

**범례** ✅완료 / 🔜다음 / ⬜예정 / ⏸의도적 보류 / ⚠️리스크·전제

---

## ⚠️ 전제 — 이게 막히면 전부 멈춘다

- ⬜ **쉐어링크 Open API 신청** *(사용자 진행)* — 어드민에서 Access·Secret Key 발급 + 출발지 IP 등록
  - 시범운영 중이라 승인 기간 불확실
  - **승인 전에도 Phase 1은 목 데이터로 전부 진행 가능** — 대기하지 않는다
- ⬜ EC2 t4g.small + Elastic IP 발급 → 어드민에 IP 등록
- ⬜ 도메인 확보 (⚠️ **"토스" 사용 불가** — 정책상 도메인·검색광고에 토스 키워드 금지)

---

## Phase 0 — 프로젝트 셋업 ✅

- ✅ 아이템 확정 및 경위 기록 (`docs/ideas.md`)
- ✅ 설계 문서 (`docs/2026-08-25-design.md`)
- ✅ 작업 추적 3종 + troubleshooting 분할 시스템
- ✅ git 초기화 + 초기 커밋

## Phase 1 — 판정 로직 (API 없이 가능) 🔜

**API 승인을 기다리지 않고 지금 할 수 있는 전부.** 순수 함수라 TDD로 간다.

- 🔜 프로젝트 초기화 — Next.js 16 + TS + Tailwind 4 + Vitest
- ⬜ 타입 정의 — `PricePoint`, `Verdict`, API 응답 스키마
- ⬜ **`verdict()` TDD**
  - Red: 관측일 부족 / 역대최저 / 2% 경계 / 최근에 더 쌌음 / 공백 있는 이력
  - Green → 리팩터
- ⬜ **`inflatedOriginal()` TDD** — 원가가 이력에 있음/없음/이력 0건
- ⬜ **하루특가 판정 TDD** — 어제와 같은 가격 / 실제로 내려간 경우
- ⬜ **응답 정규화 TDD** — `resultType: FAIL` / 비정상 가격(`display_price<=0`, `original<display`) / 필드 누락
- ⬜ SQLite 스키마 + 마이그레이션 (설계 §4)

## Phase 2 — 수집기 ⚠️API 필요

- ⬜ OAuth2 토큰 발급·캐싱 (유효기간 약 1년, 재발급 남용 금지)
- ⬜ API 클라이언트 — 커서 페이징, 429 `Retry-After`, 5xx 지수 백오프, `resultType` 검사
- ⬜ **1차 실측 수집** — 카테고리 트리 크기·하루특가 편성 규모를 잰다
  - ⚠️ **단계별 한도 배분(10,000/일)은 이 실측 결과로 확정한다.** 미리 숫자를 박지 않는다
- ⬜ 수집 파이프라인 (설계 §5 우선순위: 하루특가 → 전체베스트 → 카테고리 → 누락 보충)
- ⬜ 커서 저장 / 한도 소진 시 다음날 이어받기
- ⬜ 추적 대상 은퇴 규칙 (`last_seen_on` 오래된 순)
- ⬜ 쉐어링크 발급 + `sharelinks` 캐싱
- ⬜ `SHARELINK_OPENAPI_ACCESS_DENIED` 시 즉시 중단 + 알림 (IP 변경 감지)

## Phase 3 — 웹

- ⬜ `/p/{id}-{slug}` 상품 상세 — 가격 그래프, 판정 뱃지, 쉐어링크 버튼, **대가성 문구**
- ⬜ `/deals` 하루특가 + `endAt` 카운트다운
- ⬜ `/` 오늘의 진짜 특가
- ⬜ `/category/{id}`
- ⬜ 판정 불가 구간 UI — *"N일째 추적 중"*

## Phase 4 — 배포

- ⬜ EC2 프로비저닝, nginx, certbot
- ⬜ cron 등록 (매일 수집)
- ⬜ SQLite 일 1회 스냅샷 백업
- ⬜ 배포 파이프라인

## Phase 5 — SEO

- ⬜ `sitemap.xml` 자동 생성 (추적 상품 전량)
- ⬜ JSON-LD 구조화 데이터 (`Product` + `AggregateOffer`)
- ⬜ Search Console 등록 + 색인 추적

---

## ⏸ 의도적 보류

- ⏸ **앱인토스 미니앱** — 미니앱에서 쉐어링크를 열면 앱 복귀가 불안정하다(토스 "개선 논의 중"). 고쳐지면 즉시 재검토. SEO 다음의 두 번째 트래픽 채널 후보
- ⏸ **크로스 플랫폼 가격 비교** (토스 vs 쿠팡 vs 네이버) — 동일 상품 식별이 미해결 난제. 시계열이 먼저 서고 나서
- ⏸ **자취·이사 플래너** — 별도 프로젝트. 경위는 [docs/ideas.md §2](docs/ideas.md)
- ⏸ 회원가입·알림·모바일 앱

---

## ⚠️ 상시 주의

- **대가성 문구**를 쉐어링크가 노출되는 모든 페이지에 표시 (운영정책 필수)
- 조회 API의 `productUrl`은 **추적되지 않는다.** 반드시 발급 API의 `shortUrl`을 쓴다
- 수수료 10%는 **이벤트 요율**이다. 코드에 하드코딩하지 않는다
- `resultType`을 반드시 확인한다. HTTP 200이어도 `FAIL`일 수 있다
