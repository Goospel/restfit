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

- [T-232](troubleshooting/T-232.md) · jsdom 환경에서 fake-indexeddb를 왕복한 Blob이 평범한 객체로 돌아와 photoStore의 어휘 검증에 통째로 걸린다 — 저장은 'ok'인데 목록은 항상 빈다(node 환경에서는 멀쩡해서 저장소 테스트는 초록이다)
- [T-231](troubleshooting/T-231.md) · 워크트리에서 vitest가 「15 files passed」 초록을 찍었지만 실제로는 4파일이 아예 안 돌았다 — 워커 기동 실패가 unhandled error로 묻힌다. 원인이 둘(devDeps 누락 · 콜드 스타트 타임아웃)이라 npm install만으로는 안 끝난다
- [T-230](troubleshooting/T-230.md) · 돌연변이 테스트를 되돌리려고 git checkout -- <file>을 썼더니 그 파일의 미커밋 구현이 통째로 날아갔다 — 파일 단위 checkout은 「내 편집분」이 아니라 HEAD로 되돌린다
- [T-229](troubleshooting/T-229.md) · 화면 테스트를 넣으려고 vitest environment를 jsdom으로 전역 전환했더니 무관한 shareLinks 문서 대조 테스트가 통째로 죽었다 — jsdom에서는 import.meta.url이 file: URL이 아니다
- [T-228](troubleshooting/T-228.md) · 미니앱에서 연 토스쇼핑 쉐어링크는 뒤로 가기로 못 돌아온다 — 플랫폼에 방법이 없고 토스가 개선 중인 알려진 문제라, 고치려 들지 말고 안내로 덮는다
- [T-227](troubleshooting/T-227.md) · iCloud 메모 본문은 canvas로 그려져 DOM에 텍스트가 없다 — 편집기의 복사 기능으로 시스템 클립보드에 담고 `Get-Clipboard`로 읽는다
- [T-226](troubleshooting/T-226.md) · 인라인 스타일에서 `border` shorthand를 쓰는 베이스에 `borderColor`만 덮으면 React가 리렌더에서 그 값을 지운다 — 첫 렌더에는 멀쩡해서 눈으로 못 잡는다
- [T-225](troubleshooting/T-225.md) · 뒤로 갈수록 가늘어지는 띠를 선(stroke)으로 그렸더니 원근이 안 났다 — 굵기는 path 하나에 하나뿐이라 겉모양만 좁아진다. 면으로 채우면 이번엔 굽은 데 안쪽이 제 살을 파고들어 덩어리가 된다
- [T-224](troubleshooting/T-224.md) · 탭바를 플로팅으로 고쳤는데 2차 심사도 같은 사유로 반려 — safe-area가 0으로 오면 「+12px」이 그대로 띄운 거리가 되어 밑변에 붙은 바로 읽힌다
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
