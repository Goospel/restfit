import { EQUIPMENT, type EquipKey } from '../data/exercises';

/**
 * 기구 상세. **「모름」이 1급 선택지다.**
 *
 * 기준을 모르는 사람이 많다 — 밴드가 대표적이고(여러 개를 놓고 편한 걸 골라 쓴다),
 * 덤벨 무게를 정확히 아는 사람도 드물다. 모른다고 답해도 앱이 그대로 돌아야 한다.
 *
 * 이 정보가 실제로 하는 일은 둘뿐이다:
 *  - **무게** → 운동 화면 첫 세트 기본값(지금은 처음 하는 운동이면 0으로 시작한다)
 *  - **벤치 등판** → 루틴 필터. 인클라인·디클라인 34개가 여기 달려 있다
 *
 * 밴드 강도는 앱이 쓰지 않는다 — 밴드 운동 23개는 강도와 무관하게 전부 된다. 기록용이다.
 */

/** 무게 구간. */
export type WeightBand = 'light' | 'medium' | 'heavy' | 'unknown';

/** 벤치 등판. 「모름」은 **평벤치로 친다** — 모른다고 답한 사람이 못 하는 운동을 받으면 안 된다. */
export type BenchKind = 'flat' | 'adjustable' | 'unknown';

/** 밴드 강도. 「여러 개 섞여 있음」이 가장 흔한 실제 상황이라 맨 위에 둔다. */
export type BandKind = 'mixed' | 'light' | 'medium' | 'heavy' | 'unknown';

/** 무게를 묻는 기구. 풀업바·벤치·짐볼 따위에는 무게 개념이 없다. */
export const WEIGHED = ['dumbbell', 'barbell', 'kettlebell', 'medicineBall'] as const;
export type WeighedKey = (typeof WEIGHED)[number];

export type EquipSpec = Partial<Record<WeighedKey, WeightBand>> & {
  bench?: BenchKind;
  band?: BandKind;
};

export type WeightOption = { key: WeightBand; label: string; kg: number | null };

/**
 * 구간과 대표값. **기구마다 다르다** — 덤벨 15kg은 무겁고 바벨 15kg은 가볍다.
 * 대표값은 구간의 중간쯤이다. 어차피 사용자가 화면에서 고쳐 쓰므로 정확할 필요는 없고,
 * 0에서 시작하는 것보다 낫기만 하면 된다.
 */
export const WEIGHT_OPTIONS: Record<WeighedKey, WeightOption[]> = {
  dumbbell: [
    { key: 'light', label: '가벼움 · 5kg 이하', kg: 3 },
    { key: 'medium', label: '보통 · 5~15kg', kg: 10 },
    { key: 'heavy', label: '무거움 · 15kg 이상', kg: 20 },
    { key: 'unknown', label: '모르겠어요', kg: null },
  ],
  barbell: [
    { key: 'light', label: '가벼움 · 20kg 이하', kg: 15 },
    { key: 'medium', label: '보통 · 20~50kg', kg: 35 },
    { key: 'heavy', label: '무거움 · 50kg 이상', kg: 60 },
    { key: 'unknown', label: '모르겠어요', kg: null },
  ],
  kettlebell: [
    { key: 'light', label: '가벼움 · 8kg 이하', kg: 6 },
    { key: 'medium', label: '보통 · 8~16kg', kg: 12 },
    { key: 'heavy', label: '무거움 · 16kg 이상', kg: 20 },
    { key: 'unknown', label: '모르겠어요', kg: null },
  ],
  medicineBall: [
    { key: 'light', label: '가벼움 · 3kg 이하', kg: 2 },
    { key: 'medium', label: '보통 · 3~6kg', kg: 4 },
    { key: 'heavy', label: '무거움 · 6kg 이상', kg: 8 },
    { key: 'unknown', label: '모르겠어요', kg: null },
  ],
};

export const BENCH_OPTIONS: { key: BenchKind; label: string; desc: string }[] = [
  { key: 'flat', label: '평평한 벤치', desc: '각도가 고정된 벤치' },
  { key: 'adjustable', label: '각도 조절 벤치', desc: '등판을 세우거나 눕힐 수 있어요' },
  { key: 'unknown', label: '모르겠어요', desc: '평벤치 기준으로 루틴을 짭니다' },
];

export const BAND_OPTIONS: { key: BandKind; label: string }[] = [
  { key: 'mixed', label: '여러 개 있어요' },
  { key: 'light', label: '약한 편' },
  { key: 'medium', label: '보통' },
  { key: 'heavy', label: '강한 편' },
  { key: 'unknown', label: '모르겠어요' },
];

/** 화면에서 직접 고르는 기구. 조절식 벤치는 **벤치 상세에서** 정해진다. */
export const PICKABLE = EQUIPMENT.filter((k) => k !== 'benchAdjustable');

/** 운동 화면 첫 세트에 채울 무게. 아는 게 없으면 0(= 지금까지의 동작). */
export function defaultWeightFor(requires: readonly EquipKey[], spec: EquipSpec): number {
  for (const k of WEIGHED) {
    if (!requires.includes(k)) continue;
    const band = spec[k];
    const kg = band ? WEIGHT_OPTIONS[k].find((o) => o.key === band)?.kg : null;
    if (kg != null) return kg;
  }
  return 0;
}

/**
 * 필터에 넘길 보유 목록.
 *
 * 조절식 벤치를 가진 사람은 **평벤치 운동도 된다.** 데이터는 둘을 갈라 두었으므로
 * 여기서 두 키를 함께 세운다. 반대로 평벤치·모름이면 조절식이 서지 않아 인클라인이 걸러진다.
 */
export function effectiveOwned(owned: readonly EquipKey[], spec: EquipSpec): EquipKey[] {
  const adjustable = owned.includes('bench') && spec.bench === 'adjustable';
  return adjustable ? [...owned, 'benchAdjustable'] : [...owned];
}
