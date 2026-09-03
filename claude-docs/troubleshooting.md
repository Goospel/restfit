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

- [T-247](troubleshooting/T-247.md) · MCP 인자에 한글을 `\uXXXX` 이스케이프로 써서 릴리즈 노트에 「팔굴혀퐀기」 같은 깨진 글자가 박혔다 — 검수 요청과 동시에 확정되는 값이라 REVIEWING에서는 고칠 수도 없다
- [T-246](troubleshooting/T-246.md) · `.ait` 번들은 평범한 zip이 아니라 `AITBUNDL` 헤더 뒤에 zip이 붙은 컨테이너다 — ZipFile로 바로 열면 엔트리 0개가 조용히 나와서, 번들에 수정이 들어갔는지 보는 계측기가 「전부 없음」으로 죽는다
- [T-245](troubleshooting/T-245.md) · 코드 한 줄 안 바뀐 광고가 4차 검수에서 「예상하기 어려운 시점」으로 반려됐다 — 세 번 통과한 동작이라 회귀가 아니라 기준이 바뀐 것이고, 답은 광고를 CTA로 바꾸는 게 아니라 오기 전에 말하는 것이다
- [T-244](troubleshooting/T-244.md) · claude.ai 아티팩트 시안을 눈으로 검증하려는데 확장 크롬은 스크롤이 iframe에 안 닿고, 내부 패널은 `file://`이 정적 스냅샷이며 http 탭은 스크롤 뒤 스크린샷이 검게 나온다 — 정적 서버 + `body.style.transform`으로 뚫는다
- [T-243](troubleshooting/T-243.md) · 이 레포는 작업 트리가 CRLF라 `\n`을 품은 검색·치환 패턴이 에러 없이 0건이 된다 — 돌연변이 스크립트는 「변조 실패」로, CSS 블록 정규식은 「규약 없음」으로 조용히 어긋났다
- [T-242](troubleshooting/T-242.md) · 한 `act`에 12초를 통째로 밀었더니 React가 48번의 틱을 한 렌더로 합쳐, 초 단위로 지나가야 할 중간 상태가 통째로 증발 — 「경계마다 한 번씩」 테스트가 마지막 신호 하나만 봤다
- [T-241](troubleshooting/T-241.md) · 비동기 사진 도착을 「그 날짜 버튼이 뜰 때까지」로 기다렸더니, 같은 날 기록만으로도 버튼이 이미 있어 대기가 즉시 통과 — 사진이 안 온 화면을 단언해 「사진이 안 뜬다」로 오판
- [T-240](troubleshooting/T-240.md) · CRLF 파일에 `\n` 기준 문자열 치환을 돌리면 매칭 실패로 아무것도 안 바뀐 채 조용히 성공 — 돌연변이가 적용 안 된 채 테스트가 통과해 「생존(공허한 테스트)」으로 오판할 뻔했다
- [T-239](troubleshooting/T-239.md) · 돌연변이 측정 하네스의 백업이 `cp $F /tmp/W.bak || cp $F ../W.bak`였는데 앞엣것이 성공해 폴백이 안 돌았고, 복원은 없는 `../W.bak`을 가리켜 조용히 실패 — 돌연변이 6종이 누적된 채 측정돼 「단조 증가하는 실패 수」가 사살처럼 보였다
- [T-238](troubleshooting/T-238.md) · 토스 iOS 웹뷰는 `allowsInlineMediaPlayback`이 기본 꺼짐 — 카메라 프리뷰가 네이티브 전체화면으로 강탈되고 인라인 `<video>`는 정지 프레임이 된다. 캡처(drawImage)는 성공하므로 「사진은 찍히는데 프리뷰만 죽은」 비대칭이 감별 신호
- [T-237](troubleshooting/T-237.md) · 복구용 effect가 자기 deps(cam)를 바꾸면 자기 자신을 다시 부른다 — 재취득한 자원마저 나쁜 상태면 판정→재취득→판정으로 영영 돌고(3초에 getUserMedia 3951회), 그 사이 상태가 진동해 수동 폴백 버튼조차 못 누른다
- [T-236](troubleshooting/T-236.md) · vitest 4가 `--reporter=basic`을 없앴는데 하네스는 그 실패를 「테스트 0건 실패」로 읽어 돌연변이 18종 전부를 「생존 = 공허한 테스트」로 보고했다 — 계측기가 죽으면 판정이 사라지는 게 아니라 **정반대 결론**이 나온다
- [T-235](troubleshooting/T-235.md) · 가짜 타이머를 쓰는 테스트가 실패하면 복구 줄(`vi.useRealTimers()`)까지 못 가고, 그 뒤 파일 전체가 5초 타임아웃으로 무너진다 — 빨간불 1개가 24개로 보여 새 테스트가 아니라 멀쩡한 기존 코드를 의심하게 된다
- [T-234](troubleshooting/T-234.md) · fake-indexeddb의 내부 클래스(lib/FDBDatabase 등)는 package exports가 타입을 안 내보내 import하면 tsc가 TS7016으로 막는다 — 프로토타입에 스파이를 걸어야 할 땐 실제 인스턴스에서 꺼낸다
- [T-233](troubleshooting/T-233.md) · 모듈 수준 vi.mock의 호출 기록은 파일 전체에 누적된다 — 「몇 번 불렸나」를 재는 테스트가 앞선 테스트의 호출까지 세서, 단독 실행은 초록인데 파일 전체 실행에서만 빨간불이 뜬다
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
