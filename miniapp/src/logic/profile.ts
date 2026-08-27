/**
 * 운동 프로필 — **몸 상태와 훈련 수준.** 기구(가진 것)·목적(원하는 것)에 이어지는 세 번째 축이다.
 *
 * 받는 것이 딱 둘인 이유: 온보딩 질문 하나가 완료율을 3~7% 깎는다. 성별·키·몸무게는
 * 이 앱의 알고리즘에서 **바뀌는 분기가 아예 없어서** 묻지 않는다 — 분기가 없는 질문은
 * 마찰만 남긴다(설계 §2).
 *
 * 루틴이 이 값을 **실제로 먹는다**(PR 3) — `avoid`는 `isAvoided`로 풀에서 하드 제외되고,
 * `experience`는 선발 순서를 티어별로 정렬한다. 다만 프로필이 `null`인 사람에게는 둘 다
 * 건너뛰어 **현행과 배열 단위로 같은 루틴**이 나간다(설계 §3.1).
 */

import type { Exercise } from '../data/exercises';

/**
 * 훈련 수준. 볼륨·강도·진행 속도를 바꾸는 **유일한 공인 축**(ACSM)이라 이것만 묻는다.
 *
 * ⚠️ **`advanced`는 온보딩 질문으로 도달할 수 없다.** 질문("최근 6개월, 주 2회 이상
 * 꾸준히 운동했나요?")이 예/아니요라 나오는 값은 beginner·intermediate 둘뿐이다.
 * 상급은 세션 피드백 누적으로 **승급해야만** 닿는다. 그래서 설정 화면 라디오는 3개를
 * 다 그린다 — 승급으로 도달한 사람에게 자기 상태가 안 보이면 안 된다.
 */
export type Experience = 'beginner' | 'intermediate' | 'advanced';

/**
 * 불편한 부위. **부상 이력은 재부상의 최강 위험인자**라 개인화 중 우선순위가 가장 높다.
 *
 * 손목이 빠진 이유: 운동 데이터에 손목 부하를 나타내는 필드가 없다. `forearms`는 손목
 * 통증과 다른 축이라 푸시업·플랭크가 안 걸린다 — **정직하게 구현할 수 없는 선택지는
 * 주지 않는다.** 이름으로 짐작해 거르는 건 무성 실패 계측기라 기각했다(설계 §2).
 */
export type AvoidArea = 'knee' | 'shoulder' | 'lowerBack';

export type Profile = { experience: Experience; avoid: AvoidArea[] };

/**
 * 세션 체감 난이도. **온보딩 체력 테스트를 대신하는 장치다**(설계 §3.5 상충 판단).
 *
 * 3지선다인 이유: 탭 1회로 끝나야 매 세션 답한다. 5단계 척도는 정밀해 보이지만
 * 「어느 정도 쉬움」과 「쉬움」을 사람이 일관되게 못 가르고, 판정에 쓰는 것은 결국
 * 「올려/그대로/내려」 셋뿐이다 — 안 쓰는 해상도는 마찰만 남는다.
 */
export type Feel = 'easy' | 'ok' | 'hard';

export const FEEL_KEYS: readonly Feel[] = ['easy', 'ok', 'hard'];

/** 완료 화면 버튼 문구. 왼쪽이 쉬움 — 왼→오른쪽이 가벼움→무거움이라 순서가 곧 의미다. */
export const FEEL_LABEL: Record<Feel, string> = { easy: '쉬움', ok: '적당', hard: '힘듦' };

export function isFeel(v: unknown): v is Feel {
  return typeof v === 'string' && (FEEL_KEYS as readonly string[]).includes(v);
}

/** 승급 임계. 강등보다 **둔하다** — 아래 `nextExperience` 주석이 이유다. */
const PROMOTE_STREAK = 3;
/** 강등 임계. */
const DEMOTE_STREAK = 2;

/**
 * 피드백 스트릭으로 훈련 수준을 옮긴다. **순수 함수 — 기록 저장 시점에 한 번 판정한다.**
 *
 * `recentFeels`는 **최근 것이 앞**이고, 건너뛴 세션은 `undefined`로 자리를 차지한다.
 * 그 빈자리가 스트릭을 끊는 것이 이 함수의 핵심 안전장치다 — 무응답을 easy로 세거나
 * 압축해서 건너뛰면 **아무 말도 안 한 사람을 오승급**시킨다. 승급은 되돌리는 데
 * 2세션이 걸리니, 보수적인 쪽이 싸다.
 *
 * ⚠️ **강등(2연속)이 승급(3연속)보다 민감한 것은 의도다.** 대칭이 예뻐 보여도,
 * 두 오류의 값이 다르다 — 너무 쉬운 루틴은 지루할 뿐이지만 너무 어려운 루틴은
 * 이탈과 부상으로 간다(설계 §3.6).
 *
 * 쿨다운 상태는 두지 않는다. 계속 쉽다는 사람은 세션마다 한 단계씩 올라 beginner에서
 * advanced까지 최속 4세션이다 — 계속 쉬우면 빨리 올리는 게 맞고, 상태 하나를 아낀다.
 */
export function nextExperience(current: Experience, recentFeels: (Feel | undefined)[]): Experience {
  // 앞에서부터 n개가 전부 같은 답인가. 기록이 n개보다 적으면 스트릭이 아니다 —
  // `every`는 짧은 배열에서 공허하게 참이라 길이를 먼저 본다.
  const streak = (f: Feel, n: number) => recentFeels.length >= n && recentFeels.slice(0, n).every((x) => x === f);
  const i = EXPERIENCE_KEYS.indexOf(current);
  if (streak('hard', DEMOTE_STREAK)) return EXPERIENCE_KEYS[Math.max(0, i - 1)];
  if (streak('easy', PROMOTE_STREAK)) return EXPERIENCE_KEYS[Math.min(EXPERIENCE_KEYS.length - 1, i + 1)];
  return current;
}

export const EXPERIENCE_KEYS: readonly Experience[] = ['beginner', 'intermediate', 'advanced'];

/** 화면에 그리는 순서이기도 하다 — 위에서 아래로 몸통을 훑는 순서가 아니라 흔한 순서다. */
export const AVOID_KEYS: readonly AvoidArea[] = ['knee', 'shoulder', 'lowerBack'];

/**
 * 설정 화면의 라디오 문구.
 *
 * 설명을 함께 주는 이유: 「중급」이 무슨 뜻인지 사람마다 다르게 잡는다. 온보딩 질문과
 * **같은 기준(6개월·주 2회)** 을 그대로 노출해야 온보딩에서 답한 값과 여기 보이는 값이
 * 같은 뜻으로 읽힌다.
 */
export const EXPERIENCE_LABEL: Record<Experience, { label: string; desc: string }> = {
  beginner: { label: '초급', desc: '운동을 시작한 지 얼마 안 됐어요' },
  intermediate: { label: '중급', desc: '최근 6개월, 주 2회 이상 꾸준히 했어요' },
  advanced: { label: '상급', desc: '무거운 동작도 자세가 잡혀 있어요' },
};

export const AVOID_LABEL: Record<AvoidArea, string> = {
  knee: '무릎',
  shoulder: '어깨',
  lowerBack: '허리',
};

/** 저장소에서 읽은 값이 쓸 수 있는 훈련 수준인지. 옛 버전이 남긴 값이 들어올 수 있다. */
export function isExperience(v: unknown): v is Experience {
  return typeof v === 'string' && (EXPERIENCE_KEYS as readonly string[]).includes(v);
}

export function isAvoidArea(v: unknown): v is AvoidArea {
  return typeof v === 'string' && (AVOID_KEYS as readonly string[]).includes(v);
}

/**
 * 부위 → 뺄 근육. **매핑 방식이 부위마다 다르고, 셋 다 실측으로 정했다**(근력 408종 기준).
 *
 * 세 줄이 다르게 생긴 것은 실수가 아니다 — 원본 데이터가 부위마다 다른 곳에 근육을
 * 기재해 놨기 때문이라, 같은 규칙을 셋에 똑같이 걸면 하나는 과잉 차단이고 하나는 무력해진다.
 *
 * - `knee` — 주동근만으로 **50종**. 스쿼트·런지류가 전부 quadriceps primary라 이걸로 충분하다.
 * - `shoulder` — 주동근만으로 **83종**. ⚠️ **보조근까지 걸면 가슴 47종 중 43종이 전멸한다**(실측).
 *   벤치류의 어깨 관여가 secondary에 기재돼 있어서다. 그건 필터가 아니라 상체 몰살이라,
 *   여기만은 `secondary`를 **비운다**. 빈 배열이 곧 근거다.
 * - `lowerBack` — 주동근 ∪ 보조근으로 **43종**. ⚠️ 반대 방향의 함정이다. 주동근만 보면
 *   **3종뿐**이라 필터가 사실상 아무 일도 안 한다 — 스쿼트·데드리프트의 축성 부하가
 *   secondary에 기재돼 있어, 허리만은 보조근까지 봐야 의미를 가진다.
 *
 * 한계: 이것은 의학적 처방이 아니라 **보수적 근사**다(설계 §3.2). 화면은 "많이 쓰는 운동을
 * 뺍니다" 수준으로만 말하고 치료 효능을 주장하지 않는다.
 */
export const AVOID_MUSCLES: Record<AvoidArea, { primary: string[]; secondary: string[] }> = {
  knee: { primary: ['quadriceps', 'calves', 'adductors', 'abductors'], secondary: [] },
  shoulder: { primary: ['shoulders', 'neck'], secondary: [] },
  lowerBack: { primary: ['lower back'], secondary: ['lower back'] },
};

/**
 * 이 운동이 불편 부위에 걸리는가. 하나라도 걸리면 뺀다 — **안전 쪽으로 기운다.**
 *
 * ⚠️ 이 제외는 **하드 필터**다. 난이도(`experience`)는 풀이 마르면 다음 티어로 넘어가는
 * 선호이지만, 통증 부위는 폴백으로 되살리면 안 된다. 전부 걸러져 루틴이 비면 그 화면이
 * 「불편 부위 설정 확인」을 안내한다(설계 §3.2·§6).
 */
export function isAvoided(e: Exercise, avoid: AvoidArea[]): boolean {
  return avoid.some((area) => {
    const { primary, secondary } = AVOID_MUSCLES[area];
    return (
      e.primaryMuscles.some((m) => primary.includes(m)) || e.secondaryMuscles.some((m) => secondary.includes(m))
    );
  });
}
