# troubleshooting — 함정 + 승격

> 1분+ 디버깅했으면 원인 잡힌 직후 한 항목을 추가한다: **증상 / 원인 / 해결 / 재발방지**.
> 각 항목은 **파일 1개**(`troubleshooting/T-###.md`)다. 아래 목차는 **자동 생성** — 손대지 않는다.

## 규칙

- **항목 1건 = 파일 1개**: `troubleshooting/T-###.md`. T번호는 프로젝트 전역 시퀀스(빈 번호 없이 이어붙인다).
- **4필드 필수**: `- **증상**:` / `- **원인**:` / `- **해결**:` / `- **재발방지**:`. 검사기가 강제한다(누락 시 커밋 거부). 이 스키마가 항목당 길이를 잠근다.
- **frontmatter `summary:`**: 목차 한 줄의 **단일 출처**. 본문 H1은 `# T-### · 제목`(파일명과 번호 일치).
- **승격**: 같은 함정을 2회+ 다른 맥락에서 만나면 프로젝트 로컬 → 글로벌 CLAUDE.md → 훅 하드가드. 승격 후 본문은 지우지 말고 frontmatter에 `promoted: <대상>`을 달아 이력을 보존한다.
- **목차는 자동 생성**: 손으로 고치지 말고 `scripts/rebuild-troubleshooting-index.ps1`을 돌린다. pre-commit 훅이 stale이면 커밋을 거부한다.

## 왜 이 구조인가 (분할 + 자동목차 + 검사기)

단일 파일에 T-###를 쌓으면 (1) 파일이 Read 캡에 근접해 **최신 항목이 잘리고** (2) 목차 한 줄과 본문이 이중 기재라 **목차가 stale로 썩는다**. 목차를 `ls`(파일=항목)로 만들면 파일시스템이 축을 고를 수 없어 drift가 구조적으로 불가능해진다. 검사기(fail-close)를 규약과 함께 둔다 — **검사기 없는 규약은 100% 준수되면서 목적만 증발한다**. 설치·근거: [`SETUP.md`](SETUP.md).

## 항목 목차 (자동 생성 — 직접 편집 금지)

<!-- INDEX:START -->
<!-- ⚙️ 자동 생성 — 직접 편집하지 마세요. scripts/rebuild-troubleshooting-index.ps1 이
     각 항목의 frontmatter(summary)에서 재생성합니다. 내용을 바꾸려면 그 항목의
     summary를 고치세요(단일 출처). 최신 항목이 위. -->

- [T-223](troubleshooting/T-223.md) · 아이콘을 40px 시안으로만 보고 판정했다가 실제 20px에서 셋이 무너졌다 — 불꽃은 물방울, 케틀벨은 손가방, 덤벨은 알파벳 H가 됐다
- [T-222](troubleshooting/T-222.md) · 첫 심사가 탭바 하나로 반려됐다 — 밑변에 붙은 「보통의 하단 탭」은 토스 자체 탭과 형태가 겹쳐 금지고, 좌우·아래를 띄운 pill이어야 한다
- [T-221](troubleshooting/T-221.md) · 미니앱 사용 연령(minAge)은 토스가 정하고 파트너는 콘솔에서 바꿀 수 없다 — 다른 앱이 14세인 것을 근거로 「설정 가능한 값」이라고 추론한 것이 틀렸다
- [T-220](troubleshooting/T-220.md) · 콘솔에 올린 스크린샷은 앱정보 검토가 승인돼야 miniapp_get의 images에 나타난다 — 조회가 빈 배열이라고 업로드 실패로 보면 중복 업로드하게 된다
- [T-219](troubleshooting/T-219.md) · Figma의 listAvailableFontsAsync에 있고 loadFontAsync도 성공을 반환하는 폰트가 실재하지 않을 수 있다 — 텍스트가 폭 0으로 아무것도 안 그려진다
- [T-218](troubleshooting/T-218.md) · ait build의 appName 검증은 「문자열인가 && 빈칸 아닌가」뿐이라 한글이 통과한다 — 빌드 통과를 값의 유효성 증거로 삼으면 deploy에서 깨진다
- [T-217](troubleshooting/T-217.md) · core.autocrlf=true 레포에서는 git diff --numstat이 EOL 뒤집힘을 원리적으로 못 본다 — 훅이 지시한 검증 수단이 장님이다
- [T-216](troubleshooting/T-216.md) · 개발 기계의 시간대가 코드가 가정한 시간대와 같으면 시간대 테스트가 공허해진다 — 돌연변이가 살아남아야만 드러난다
- [T-215](troubleshooting/T-215.md) · .gitignore의 앵커 없는 `data/`가 `miniapp/src/data/` 전체를 삼켰다 — 로컬 테스트는 통과하고 새 클론에서만 깨지는 조용한 실패
- [T-214](troubleshooting/T-214.md) · Git Bash의 /c/... 경로를 Node require()에 넘기면 모듈을 못 찾아 조용히 빈 출력으로 끝난다 — "파일이 없다"로 오인하기 쉽다

<!-- INDEX:END -->
