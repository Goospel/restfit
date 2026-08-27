# 덤벨 · `dumbbell`

**우선순위 1위.** 맨몸만 가진 사람에게 가장 많은 운동을 열어주는 기구라 기구 탭 맨 위에 뜬다.
**네 구간이 다 차서** 화면에 무게 구간 칩이 뜬다(2026-08-27).

공통 규칙(뽑는 법·필드 역할·점검 절차)은 [README](README.md).

## 검색어

```
덤벨    아령    조절식 덤벨
```

## ⚠️ 이 기구의 함정

- **1개인지 2개인지가 값을 가른다.** 상품명이 「5kg」이어도 2개 세트면 값이 두 배로 보인다 — `note`에 `2개입`을 적는다
- **원판 교체식은 `adjustable`이다.** 봉에 원판을 끼우는 것도 조절식으로 센다(케틀벨의 `HNF 케틀벨 그립`과 같은 취급)
- 조절식은 **최대 무게를 이름에 남긴다** — 배지가 「조절식」이라, 떼면 같은 제품군 둘이 구분되지 않는다

## 무게 구간 — 경계는 **5kg · 15kg**

온보딩에서 사용자가 고르는 라벨과 같은 경계다(`WEIGHT_OPTIONS.dumbbell`).

| `weight` | 범위 | 채웠나 |
|---|---|---|
| `light` | 5kg 이하 | ✅ |
| `medium` | 5~15kg | ✅ |
| `heavy` | 15kg 이상 | ✅ |
| `adjustable` | 조절식 | ✅ |

⚠️ **경계값은 아래 구간에 넣는다** — 5kg은 `light`, 15kg 이상만 `heavy`다(케틀벨의 8·16kg과 같은 규칙).

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
| 가벼움 | 0.5 | 스케쳐스 와이드핏 육각 아령 | 2개입 | https://toss.im/_m/5HC4HFK |
| 가벼움 | 1 | 아리프 네오프렌 미용 아령 | 네오프렌 · 2개입 | https://toss.im/_m/jQzzdoH5 |
| 가벼움 | 2 | 앳플리 홈트 미용 아령 | 2개입 | https://toss.im/_m/h1WyOgEu |
| 가벼움 | 2 | 아이워너 뷰티 육각 덤벨 | 컬러 · 2개입 | https://toss.im/_m/r98DATe8 |
| 가벼움 | 3 | 아이워너 맨즈 육각 아령 | 2개입 | https://toss.im/_m/hG718JX1 |
| 가벼움 | 3 | 아이워너 네오프렌 사각 아령 | 네오프렌 · 1개 | https://toss.im/_m/reDrK7pt |
| 가벼움 | 3 | 스포틀러 CPU 덤벨 | 1개 | https://toss.im/_m/59tgqnan |
| 가벼움 | 4 | 아이워너 맨즈 육각 아령 | 2개입 | https://toss.im/_m/pUTPzHqt |
| 가벼움 | 4 | 아이워너 PVC 뷰티 육각 아령 | PVC · 2개입 | https://toss.im/_m/tjLNJOKk |
| 가벼움 | 5 | 아이워너 맨즈 육각 아령 | 2개입 | https://toss.im/_m/jnf2rJC3 |
| 가벼움 | 5 | 멜킨 육각덤벨 | 1개 | https://toss.im/_m/PmXcXdir |
| 보통 | 7 | 아이워너 맨즈 육각 아령 | 2개입 | https://toss.im/_m/tVlnkEa8 |
| 보통 | 8 | 아이워너 맨즈 육각 아령 | 2개입 | https://toss.im/_m/rAq097Oo |
| 보통 | 8 | PEV 육각 아령 | PEV · 2개입 | https://toss.im/_m/PCy5obL |
| 보통 | 10 | 아리프 PEV 육각 덤벨 | PEV · 냄새 적음 · 2개입 | https://toss.im/_m/1igqN1Xb |
| 보통 | 10 | 아이워너 맨즈 육각 아령 | 2개입 | https://toss.im/_m/3XwAp4u4 |
| 무거움 | 16 | 아이워너 PEV 육각 아령 | PEV · 냄새 적음 | https://toss.im/_m/Hzw9w5fi |
| 무거움 | 28 | 티에스 멀티 덤벨 | 1개 | https://toss.im/_m/3Up4kIc8 |
| 무거움 | 30 | 베스코 ELITE 12각 PEV 아령 | PEV · 1개 | https://toss.im/_m/TJtMPzAi |
| 조절식 | | 바이줌 5단 무게조절 덤벨 5kg | 5단계 | https://toss.im/_m/NwRg9Fk7 |
| 조절식 | | 아디다스 무게조절 크롬 덤벨 5kg | 크롬 · 1개 | https://toss.im/_m/BLUzy7Zg |
| 조절식 | | 타니 무게조절 덤벨 바벨 세트 10kg | 덤벨·바벨 겸용 | https://toss.im/_m/JBOcKDHf |
| 조절식 | | 스포틀러 무게조절 덤벨 바벨 세트 15kg | 덤벨·바벨 겸용 | https://toss.im/_m/3qUFQPVl |
| 조절식 | | 이고웰 무게조절 덤벨 바벨 세트 20kg | 덤벨·바벨 겸용 | https://toss.im/_m/h23O6MG5 |
| 조절식 | | 아나바 조절 덤벨 바벨 세트 20kg | 덤벨·바벨 겸용 | https://toss.im/_m/fyM6wvnt |
| 조절식 | | 티에스 무게조절 덤벨 세트 20kg | 덤벨만 | https://toss.im/_m/xx8HuSWb |
| 조절식 | | 트라히어 TY 무게조절 덤벨 바벨 세트 20kg | 덤벨·바벨 겸용 | https://toss.im/_m/xNJszaen |
| 조절식 | | 롤튼 무게조절 덤벨 36kg | 16단계 | https://toss.im/_m/dFbLG9K |
| — | | 아리프 육각 덤벨 세트 | ⚠️ 7개 세트의 **합이** 12kg이라 개당 무게를 모른다 · 거치대 포함 | https://toss.im/_m/DfUxzTcd |

## 점검 기록

| 날짜 | 본 것 | 결과 |
|---|---|---|
| 2026-08-27 | 28건 발급·반영 | 발급 직후라 점검 불필요. 다음 점검 2026-11 무렵 |
