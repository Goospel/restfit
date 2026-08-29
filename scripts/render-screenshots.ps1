#Requires -Version 5.1
<#
.SYNOPSIS
콘솔 등록용 이미지를 만든다 — 세로 스크린샷 4장(636x1048)과 가로 썸네일 1장(1932x828).

.DESCRIPTION
assets/screenshots/raw/*.png (앱 화면 원본, 390x844 dPR2 = 780x1688)를 재료로
assets/screenshots/store/ 에 콘솔 규격 이미지를 낸다.

⚠️ 이 파일은 UTF-8 **BOM 포함**으로 저장한다. PowerShell 5.1은 BOM 없는 UTF-8을
   CP949로 잘못 읽어 아래 한글 리터럴이 깨진다(글로벌 「Windows 셸 원칙」 3번).

왜 앱 화면을 그대로 못 쓰나: 콘솔이 요구하는 636x1048은 **비율이 1.65:1**로 폰(2.16:1)보다
뭉뚱하다. 그냥 늘리면 아래가 텅 비어 앱이 빈약해 보인다. 그래서 캔버스에 문구를 얹고
화면은 비율을 지킨 채 넣는다.

⚠️ 콘솔은 **1px이라도 다르면 거부**한다. Chrome은 실패해도 종료코드가 0인 경우가
있으므로 성공 판정은 종료코드가 아니라 **산출된 파일의 실제 크기**로 한다.

.EXAMPLE
powershell -NoProfile -File scripts/render-screenshots.ps1
#>
[CmdletBinding()]
param(
    # ⚠️ 레포 상대 경로다. `param` 기본값에서는 `$PSScriptRoot`가 아직 비어 있어
    #    절대 경로를 못 만든다(`\..\assets\…`가 되어 파일을 못 찾는다) — 본문에서 조립한다.
    [string]$RawDir = "assets/screenshots/raw",
    [string]$OutDir = "assets/screenshots/store"
)

$ErrorActionPreference = 'Stop'

$repo = Split-Path $PSScriptRoot -Parent
$RawDir = Join-Path $repo $RawDir
$OutDir = Join-Path $repo $OutDir

# 콘솔 규격. 바꾸지 말 것 — 다른 값은 업로드가 거부된다.
$SHOT_W = 636;  $SHOT_H = 1048   # PREVIEW + VERTICAL
$THUMB_W = 1932; $THUMB_H = 828  # THUMBNAIL + HORIZONTAL

# 세로 스크린샷의 앱 화면 크기. 원본 비율(780x1688)에서 폭 400이면 높이 866이 되어,
# 남는 182px가 문구 영역이 된다. 폭을 바꾸면 문구가 밀려 잘린다.
$IMG_W = 400; $IMG_H = 866

<#
장별 문구. `hi`는 파랗게 강조되는 조각으로, `title` 안에서 그 부분만 감싼다. `|`는 줄바꿈.
⚠️ 앱이 실제로 하는 말과 어긋나면 심사에서 걸린다 — 화면에 없는 기능을 적지 않는다.
#>
$SHOTS = @(
    @{ file = '01-home.png';    title = '오늘 뭘 할지,|이미 정해뒀습니다'; hi = '이미 정해뒀습니다'; sub = '기구만 고르면 매일 루틴이 나와요' }
    # ⚠️ 운동(세트 입력) 화면이 아니라 **휴식** 화면을 쓴다. 운동 화면은 하단 탭이 감춰지고
    #    콘텐츠도 적어 캔버스 절반이 비었다 — 큰 타이머가 세로를 채우는 휴식 쪽이 낫다.
    @{ file = '02-rest.png';    title = '쉬는 시간까지|챙겨드려요';         hi = '챙겨드려요';        sub = '세트를 마치면 타이머가 저절로 시작돼요' }
    @{ file = '03-shop.png';    title = '덤벨 하나면|96개가 열립니다';      hi = '96개가 열립니다';   sub = '뭘 사야 할지 숫자로 알려드려요' }
    @{ file = '04-history.png'; title = '운동한 날이|달력에 쌓입니다';      hi = '달력에 쌓입니다';   sub = '날짜를 누르면 그날의 기록이 열려요' }
)

$FONT = "'Malgun Gothic','맑은 고딕',system-ui,sans-serif"

$chrome = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) { throw "Chrome을 찾을 수 없습니다. 설치 경로를 확인하세요." }

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

$tmp = Join-Path $env:TEMP ("restfit-shots-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp -Force | Out-Null

Add-Type -AssemblyName System.Drawing

<# 로컬 PNG를 HTML에서 참조할 file:/// URL. 역슬래시는 Chrome이 못 읽는다. #>
function Get-FileUrl([string]$Path) {
    if (-not (Test-Path $Path)) { throw "원본이 없습니다: $Path" }
    return "file:///" + ((Resolve-Path $Path).Path -replace '\\', '/')
}

<#
HTML 한 장을 지정 크기 PNG로 굽는다.
⚠️ 성공 판정은 종료코드가 아니라 **산출된 파일의 실제 픽셀**이다. 이 함수의 존재 이유가 그것이다.
#>
function Invoke-Render([string]$Name, [string]$Body, [string]$OutPng, [int]$W, [int]$H) {
    $html = Join-Path $tmp ($Name -replace '\.png$', '.html')
    # ⚠️ BOM 없는 UTF-8로 쓴다 — meta charset이 있어서 BOM은 오히려 앞에 깨진 글자를 남긴다.
    [System.IO.File]::WriteAllText($html, $Body, (New-Object System.Text.UTF8Encoding($false)))

    if (Test-Path $OutPng) { Remove-Item $OutPng -Force }
    $url = "file:///" + ($html -replace '\\', '/')

    # ⚠️ PowerShell 5.1은 native exe의 stderr를 ErrorRecord로 감싸서, exit code가 0이어도
    #    $ErrorActionPreference='Stop' 아래서는 NativeCommandError로 죽는다.
    #    Chrome은 정상 동작 중에도 stderr로 진행 상황을 뱉으므로 이 구간만 Continue로 낮춘다.
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & $script:chrome --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 `
            --screenshot="$OutPng" --window-size="$W,$H" $url 2>&1 | Out-Null
    }
    finally { $ErrorActionPreference = $prevEAP }

    if (-not (Test-Path $OutPng)) { throw "렌더 실패: $Name 이 생성되지 않았습니다." }

    $img = [System.Drawing.Image]::FromFile($OutPng)
    $w = $img.Width; $h = $img.Height
    $img.Dispose()
    if ($w -ne $W -or $h -ne $H) {
        throw "크기 불일치: $Name 이 ${w}x${h} 입니다 (기대 ${W}x${H})."
    }
    Write-Host "  $Name  ${w}x${h}"
}

try {
    # ── 세로 스크린샷 4장 ──────────────────────────────────────────
    foreach ($s in $SHOTS) {
        $imgUrl = Get-FileUrl (Join-Path $RawDir $s.file)

        $title = ($s.title -replace '\|', '<br>')
        if ($s.hi) { $title = $title.Replace($s.hi, "<b>$($s.hi)</b>") }

        $body = @"
<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    width:${SHOT_W}px; height:${SHOT_H}px; overflow:hidden;
    display:flex; flex-direction:column; align-items:center;
    background:#f2f4f6; font-family:$FONT; -webkit-font-smoothing:antialiased;
  }
  .cap { padding:44px 40px 0; text-align:center; }
  h1 { font-size:30px; line-height:1.35; font-weight:800; color:#191f28; letter-spacing:-0.5px; }
  h1 b { color:#3182f6; font-weight:800; }
  p  { margin-top:10px; font-size:15px; color:#6b7684; }
  img {
    width:${IMG_W}px; height:${IMG_H}px; margin-top:auto;
    border-radius:22px 22px 0 0; box-shadow:0 -2px 24px rgba(0,0,0,.10);
  }
</style></head><body>
  <div class="cap"><h1>$title</h1><p>$($s.sub)</p></div>
  <img src="$imgUrl">
</body></html>
"@
        Invoke-Render $s.file $body (Join-Path $OutDir $s.file) $SHOT_W $SHOT_H
    }

    # ── 가로 썸네일 1장 ────────────────────────────────────────────
    # 목록에 뜨는 대표 이미지다. **기능이 아니라 태도로 연다** — 「루틴을 대신 짜준다」는
    # 흔한 약속이라 구미를 못 당긴다(사용자 지적, 2026-08-26). 앱 이름이 던진 질문에
    # 홈 화면이 답하는 톤을 그대로 가져왔다.
    $u1 = Get-FileUrl (Join-Path $RawDir '03-shop.png')
    $u2 = Get-FileUrl (Join-Path $RawDir '01-home.png')
    $u3 = Get-FileUrl (Join-Path $RawDir '02-rest.png')

    $thumb = @"
<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    width:${THUMB_W}px; height:${THUMB_H}px; overflow:hidden; display:flex; align-items:center;
    background:#f2f4f6; font-family:$FONT; -webkit-font-smoothing:antialiased;
  }
  .left { padding-left:120px; width:900px; flex-shrink:0; }
  .kicker { font-size:40px; color:#8b95a1; font-weight:700; margin-bottom:18px; }
  /* ⚠️ nowrap이라 문구를 늘리면 잘린다. 「그래서 만들어 봤습니다.」 12자가 60px에서 딱 맞는다. */
  h1 { font-size:60px; line-height:1.32; font-weight:800; color:#191f28; letter-spacing:-1.5px; white-space:nowrap; }
  h1 b { color:#3182f6; }
  p { margin-top:30px; font-size:28px; color:#6b7684; line-height:1.55; }
  .shots { position:relative; flex:1; height:${THUMB_H}px; }
  .shots img { position:absolute; width:318px; border-radius:24px; box-shadow:0 18px 46px rgba(0,0,0,.16); }
  /* 셋째 장이 캔버스 끝에서 살짝 잘리는 건 의도다 — 딱 맞으면 「셋뿐」으로 읽힌다. */
  .s1 { left:0px;   top:150px; transform:rotate(-5deg); }
  .s2 { left:336px; top:104px; z-index:2; }
  .s3 { left:672px; top:150px; transform:rotate(5deg); }
</style></head><body>
  <div class="left">
    <div class="kicker">네, 어렵습니다.</div>
    <h1>그래서 만들어 봤습니다.<br><b>같이 해봅시다.</b></h1>
    <p>집에 있는 기구만 고르면<br>오늘 할 운동이 정해집니다</p>
  </div>
  <div class="shots">
    <img class="s1" src="$u1"><img class="s2" src="$u2"><img class="s3" src="$u3">
  </div>
</body></html>
"@
    Invoke-Render 'thumbnail.png' $thumb (Join-Path $OutDir 'thumbnail.png') $THUMB_W $THUMB_H
}
finally {
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "완료 — 세로 $($SHOTS.Count)장 + 썸네일 1장을 $OutDir 에 만들었습니다."
