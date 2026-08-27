# 케틀벨 · `kettlebell`

**네 구간이 다 찬 유일한 기구.** 여기서 만든 규칙(무게 배지·구간 칩·`note` 어휘)을 나머지 기구가 따라간다 —
어떻게 적는지 헷갈리면 [`shareLinks.ts`](../../miniapp/src/data/shareLinks.ts)의 케틀벨 블록을 본보기로 본다.

공통 규칙(뽑는 법·필드 역할·점검 절차)은 [README](README.md).

## 검색어

```
케틀벨    조절식 케틀벨
```

## ⚠️ 이 기구의 함정

- **소프트냐 철제냐가 고르는 기준이다.** 같은 무게가 여럿이라 `note` 없이는 스무 줄이 구분되지 않는다 — `소프트 · 바닥 보호` · `철제` · `저소음` · `덤벨 겸용`
- **상품명에 무게가 없는 것이 있다.** 그럴 땐 `weight`를 **비운다**(추측 금지). 칩으로는 안 잡히고 「전체」에서만 보이며 배지도 빈다
- 조절식은 **최대 무게를 이름에 남긴다**(`바이줌 조절 케틀벨 13kg` / `22.6kg`)

## 무게 구간 — 경계는 **8kg · 16kg**

온보딩에서 사용자가 고르는 라벨과 같은 경계다(`WEIGHT_OPTIONS.kettlebell`).

| `weight` | 범위 | 채웠나 |
|---|---|---|
| `light` | 8kg 이하 | ✅ |
| `medium` | 8~16kg | ✅ |
| `heavy` | 16kg 이상 | ✅ |
| `adjustable` | 조절식 | ✅ |

## 수집함

```
상품명 | 링크 | note
```

<!-- 여기 아래에 붙여넣기 -->


<!-- 여기 위까지 -->

## 반영된 링크

[`shareLinks.ts`](../../miniapp/src/data/shareLinks.ts)에 들어가 화면에 뜨고 있는 것들. **순서가 곧 화면 순서다**(무게순).
⚠️ 코드와 이 표가 어긋나면 **테스트가 실패한다**(`기구 문서 ↔ shareLinks.ts`) — 한쪽만 고치면 안 된다.

| 구간 | kg | 상품명 | note | 링크 |
|---|---:|---|---|---|
| 가벼움 | 4 | 앳플리 소프트 케틀벨 | 소프트 · 바닥 보호 | https://toss.im/_m/Fs0BdFhh |
| 가벼움 | 4 | 아디다스 아이언 케틀벨 | 철제 | https://toss.im/_m/XdyRAek7 |
| 가벼움 | 4 | K4스포츠 컬러 케틀벨 | 컬러 코팅 | https://toss.im/_m/ljIh1c0l |
| 가벼움 | 4 | CABOSS 소프트 케틀벨 | 소프트 | https://toss.im/_m/zNj6D6Ny |
| 가벼움 | 4.5 | 타미나스포츠 케틀벨 | | https://toss.im/_m/NVINBNJD |
| 가벼움 | 6 | 타미나 말랑말랑 케틀벨 | 소프트 | https://toss.im/_m/bnRI1Q01 |
| 가벼움 | 6 | 여성용 케틀벨 | | https://toss.im/_m/TfC2HRMp |
| 가벼움 | 8 | 이노이 솔리드 케틀벨 | 철제 | https://toss.im/_m/PBIhgbhh |
| 가벼움 | 8 | 이고웰 말랑말랑 케틀벨 | 소프트 · 저소음 | https://toss.im/_m/3N5rFpeC |
| 가벼움 | 8 | 홈트러브 소프트 케틀벨 | 소프트 | https://toss.im/_m/hKCoIq2q |
| 보통 | 9 | 뭅뭅 브랜뉴 케틀벨 | 덤벨 겸용 | https://toss.im/_m/PBkKHZiw |
| 보통 | 10 | 이고웰 말랑말랑 케틀벨 | 소프트 · 저소음 | https://toss.im/_m/Lw9ELaNo |
| 보통 | 10 | 온플로 플로우벨 | 덤벨 겸용 | https://toss.im/_m/jmlOWcjc |
| 보통 | 10 | 유레카 다이나믹 케틀벨 | | https://toss.im/_m/l8R8NzM9 |
| 보통 | 12 | 아리프 레드라인 케틀벨 | 철제 | https://toss.im/_m/jsYGp7v3 |
| 보통 | 14 | 반석스포츠 K케틀벨 | 철제 · 국산 | https://toss.im/_m/zzBcQfk7 |
| 보통 | 14 | 피테코 케틀벨 | 철제 | https://toss.im/_m/5xICevjr |
| 무거움 | 16 | 아리프 레드라인 케틀벨 | 철제 | https://toss.im/_m/3ASLcWf7 |
| 무거움 | 20 | 이고웰 스트롱 케틀벨 | 덤벨 겸용 | https://toss.im/_m/vpzpApKj |
| 조절식 | | 바이줌 조절 케틀벨 13kg | 5단계 | https://toss.im/_m/NwXHc2Jt |
| 조절식 | | 멜킨 트위스트벨 20kg | 7단계 | https://toss.im/_m/JK7IOFw4 |
| 조절식 | | 바이줌 조절 케틀벨 22.6kg | 5단계 | https://toss.im/_m/ZbP3TdiB |
| 조절식 | | HNF 케틀벨 그립 | 그립만 · 원판 별도 | https://toss.im/_m/leT1Irxs |
| — | | 케틀벨 | ⚠️ 상품명에 무게가 없어 구간을 못 정했다 | https://toss.im/_m/7LnJNuk7 |

## 점검 기록

| 날짜 | 본 것 | 결과 |
|---|---|---|
| 2026-08-27 | 24건 발급·반영 | 발급 직후라 점검 불필요. 다음 점검 2026-11 무렵 |
