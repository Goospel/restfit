import type { EquipKey } from './exercises';

/**
 * 기구별 토스쇼핑 상품. **기구 하나에 여러 개를 둔다.**
 *
 * 화면은 2단이다 — 기구 카드가 「몇 개가 열리는지」를 말하고, 펼치면 살 상품이 나온다.
 * 상품을 곧바로 늘어놓으면 해금 수치가 상품 사이에 묻혀서, 사야 하는 **이유**를 잃는다.
 *
 * **개수가 많아도 된다 — 무게 구간 칩으로 좁히기 때문이다.** 처음엔 기구당 3~5개만 두려 했는데,
 * 그러면 고르는 일을 우리가 대신 해 버리는 꼴이라 「내 무게에 맞는 게 없는」 사람이 생긴다.
 * 많이 담고 **거르는 수단을 주는 쪽**이 낫다(`productBands` · `filterByBand`).
 *
 * ⚠️ **가격은 넣지 않는다.** 정적 파일이라 바뀌어도 따라가지 못하고, 틀린 가격은 없는 것만 못하다.
 * 값은 링크를 눌러 토스쇼핑에서 본다.
 *
 * ⚠️ 추적되는 주소만 넣는다 — 상품 페이지 주소(`productUrl`)를 넣으면 수익이 0으로 잡힌다.
 * 반드시 「링크 발급」으로 받은 **`https://toss.im/_m/…`** 꼴이어야 한다.
 *
 * 발급은 **어드민 웹**에서 한다 — `sharelink.toss.im` → 「링크」 → 상품 조회 → 상품 카드의 「링크 발급」.
 * (토스쇼핑 앱의 「쉐어링크 공유하기」도 같은 주소를 주지만 폰을 켜야 한다.)
 * Open API로 일괄 발급하는 길은 **접었다** — 이유는 plan.md Phase 4.
 */
export type Product = {
  /** 화면에 그대로 뜬다. 상품 페이지의 이름을 줄여서 쓴다 — 전체 이름은 대개 너무 길다. */
  name: string;
  url: string;
  /**
   * 「같은 구간 안에서」 고르는 기준 한 줄. 무게는 이름에 있고 구간은 칩이 말하므로,
   * 여기엔 **그 둘이 못 하는 말만** 적는다(소재·소음·겸용 여부·조절 단수).
   */
  note?: string;
  /**
   * 필터 축. **앱이 이미 아는 어휘를 그대로 쓴다** — 온보딩에서 고른 말과 같아야 사용자가 대응시킨다.
   * kg 경계는 기구마다 다르다(`WEIGHT_OPTIONS`) — 케틀벨은 8kg·16kg이 경계다.
   *
   * ⚠️ **모르면 비워 둔다.** 모르는 것에 구간을 붙이면 그게 거짓이다. 비워 두면 칩으로는 못 찾고
   * 「전체」에서만 보인다 — 정보가 없는 상품이 치르는 마땅한 대가다.
   */
  weight?: ProductBand;
  /**
   * 배지에 뜨는 무게. **이름에서 떼어 왼쪽에 세운다** — 목록이 무게순인데 숫자가 이름 끝에
   * 묻혀 있으면 정렬돼 있다는 사실이 눈에 안 들어온다.
   *
   * ⚠️ 그래서 `name`에는 kg을 남기지 않는다(테스트가 막는다). **조절식만 예외** —
   * 배지가 「조절식」이라 최대 무게를 이름에서 잃으면 같은 제품군이 구분되지 않는다.
   */
  kg?: number;
};

/** 무게 구간. `WeightBand`(`equipSpec`)의 어휘에 조절식을 더한 것이다 — 상품에는 「모름」 대신 「비움」이 있다. */
export type ProductBand = 'light' | 'medium' | 'heavy' | 'adjustable';

/** 칩 라벨. **키 순서가 곧 칩 순서다** — 데이터가 어떤 순서로 들어오든 화면은 가벼운 것부터다. */
export const BAND_KO: Record<ProductBand, string> = {
  light: '가벼움',
  medium: '보통',
  heavy: '무거움',
  adjustable: '조절식',
};

/**
 * 실제로 상품이 있는 구간만, 개수와 함께.
 *
 * **빈 구간의 칩을 띄우면 안 된다** — 눌러도 아무것도 안 나오는 버튼은 고장으로 읽힌다.
 * 개수를 같이 주는 것도 같은 이유다. 눌러 보기 전에 얼마나 좁혀지는지 알아야 누를지 말지 정한다.
 */
export function productBands(products: readonly Product[]): { band: ProductBand; count: number }[] {
  return (Object.keys(BAND_KO) as ProductBand[])
    .map((band) => ({ band, count: products.filter((p) => p.weight === band).length }))
    .filter((b) => b.count > 0);
}

/**
 * 목록 왼쪽에 세우는 배지. 없으면 `null`이고 화면은 **빈 자리로 남긴다** — 배지를 지우면
 * 그 줄만 이름이 왼쪽으로 튀어나와 정렬이 흐트러진다.
 *
 * 조절식은 kg이 있어도 「조절식」이 이긴다. 그 상품에서 알아야 할 것은 **얼마인가**가 아니라
 * **바꿀 수 있는가**이고, 최대 무게는 이름에 남겨 둔다.
 */
export function productBadge(p: Product): string | null {
  if (p.weight === 'adjustable') return '조절식';
  return p.kg === undefined ? null : `${p.kg}kg`;
}

/** `null`은 「전체」다 — 무게를 모르는 상품은 여기서만 보인다. 원본 순서(무게순)는 그대로 지킨다. */
export function filterByBand(products: readonly Product[], band: ProductBand | null): readonly Product[] {
  return band === null ? products : products.filter((p) => p.weight === band);
}

/**
 * ⚠️ **배열 순서가 곧 화면 순서다.** 가벼운 것부터 무거운 것 순으로 적고 조절식을 뒤에 둔다 —
 * 정렬 코드를 두지 않는 대신 여기서 손으로 맞춘다(정적 데이터라 그게 더 싸다).
 */
export const SHARE_LINKS: Partial<Record<EquipKey, readonly Product[]>> = {
  dumbbell: [
    { name: '아이워너 육각 아령', url: 'https://toss.im/_m/jnf2rJC3', weight: 'light', kg: 5, note: '2개입' },
  ],
  kettlebell: [
    { name: '앳플리 소프트 케틀벨', url: 'https://toss.im/_m/Fs0BdFhh', weight: 'light', kg: 4, note: '소프트 · 바닥 보호' },
    { name: '아디다스 아이언 케틀벨', url: 'https://toss.im/_m/XdyRAek7', weight: 'light', kg: 4, note: '철제' },
    { name: 'K4스포츠 컬러 케틀벨', url: 'https://toss.im/_m/ljIh1c0l', weight: 'light', kg: 4, note: '컬러 코팅' },
    { name: 'CABOSS 소프트 케틀벨', url: 'https://toss.im/_m/zNj6D6Ny', weight: 'light', kg: 4, note: '소프트' },
    { name: '타미나스포츠 케틀벨', url: 'https://toss.im/_m/NVINBNJD', weight: 'light', kg: 4.5 },
    { name: '타미나 말랑말랑 케틀벨', url: 'https://toss.im/_m/bnRI1Q01', weight: 'light', kg: 6, note: '소프트' },
    { name: '여성용 케틀벨', url: 'https://toss.im/_m/TfC2HRMp', weight: 'light', kg: 6 },
    { name: '이노이 솔리드 케틀벨', url: 'https://toss.im/_m/PBIhgbhh', weight: 'light', kg: 8, note: '철제' },
    { name: '이고웰 말랑말랑 케틀벨', url: 'https://toss.im/_m/3N5rFpeC', weight: 'light', kg: 8, note: '소프트 · 저소음' },
    { name: '홈트러브 소프트 케틀벨', url: 'https://toss.im/_m/hKCoIq2q', weight: 'light', kg: 8, note: '소프트' },
    { name: '뭅뭅 브랜뉴 케틀벨', url: 'https://toss.im/_m/PBkKHZiw', weight: 'medium', kg: 9, note: '덤벨 겸용' },
    { name: '이고웰 말랑말랑 케틀벨', url: 'https://toss.im/_m/Lw9ELaNo', weight: 'medium', kg: 10, note: '소프트 · 저소음' },
    { name: '온플로 플로우벨', url: 'https://toss.im/_m/jmlOWcjc', weight: 'medium', kg: 10, note: '덤벨 겸용' },
    { name: '유레카 다이나믹 케틀벨', url: 'https://toss.im/_m/l8R8NzM9', weight: 'medium', kg: 10 },
    { name: '아리프 레드라인 케틀벨', url: 'https://toss.im/_m/jsYGp7v3', weight: 'medium', kg: 12, note: '철제' },
    { name: '반석스포츠 K케틀벨', url: 'https://toss.im/_m/zzBcQfk7', weight: 'medium', kg: 14, note: '철제 · 국산' },
    { name: '피테코 케틀벨', url: 'https://toss.im/_m/5xICevjr', weight: 'medium', kg: 14, note: '철제' },
    { name: '아리프 레드라인 케틀벨', url: 'https://toss.im/_m/3ASLcWf7', weight: 'heavy', kg: 16, note: '철제' },
    { name: '이고웰 스트롱 케틀벨', url: 'https://toss.im/_m/vpzpApKj', weight: 'heavy', kg: 20, note: '덤벨 겸용' },
    // 조절식은 이름에 최대 무게를 남긴다 — 배지가 「조절식」이라, 떼어 내면 같은 제품군 둘이 구분되지 않는다.
    { name: '바이줌 조절 케틀벨 13kg', url: 'https://toss.im/_m/NwXHc2Jt', weight: 'adjustable', note: '5단계' },
    { name: '멜킨 트위스트벨 20kg', url: 'https://toss.im/_m/JK7IOFw4', weight: 'adjustable', note: '7단계' },
    { name: '바이줌 조절 케틀벨 22.6kg', url: 'https://toss.im/_m/ZbP3TdiB', weight: 'adjustable', note: '5단계' },
    { name: 'HNF 케틀벨 그립', url: 'https://toss.im/_m/leT1Irxs', weight: 'adjustable', note: '그립만 · 원판 별도' },
    // ⚠️ 상품명에 무게가 없어 구간을 못 정한다. 「전체」에서만 보이고 칩으로는 안 잡히며 배지도 빈다.
    { name: '케틀벨', url: 'https://toss.im/_m/7LnJNuk7' },
  ],
};

/**
 * 링크가 하나도 없으면 대가성 문구를 띄우지 않는다 — 받지도 않는 대가를 고지하면 그게 거짓이다.
 *
 * ⚠️ **키가 아니라 상품 수를 센다.** `{ dumbbell: [] }`처럼 키만 있고 비어 있는 경우가
 * 생기는데, 키로 세면 상품이 하나도 없는 화면에 문구만 뜬다.
 */
export const HAS_ANY_LINK = Object.values(SHARE_LINKS).some((list) => (list?.length ?? 0) > 0);

/**
 * 대가성 고지. ⚠️ **토스가 지정한 문장을 글자 그대로 쓴다.**
 *
 * 쉐어링크를 발급하면 토스가 이 문장을 함께 준다. 뜻이 같아도 내가 지어 쓴 문장은 규정 위반이라,
 * 여기 상수로 박아 두고 화면은 이것만 참조한다.
 */
export const DISCLOSURE =
  '✱ 이 포스팅은 토스쇼핑 쉐어링크 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.';
