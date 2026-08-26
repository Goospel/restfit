import type { EquipKey, Exercise } from '../data/exercises';
import { unlockGain, type Unlock } from './equipment';
import { effectiveOwned, type EquipSpec } from './equipSpec';

/**
 * 살 만한 기구를 고른다. **아무거나 나열하지 않는 것이 이 파일의 전부다.**
 *
 * 기구를 전부 보여주면 추천이 아니라 카탈로그이고, 카탈로그는 아무도 안 믿는다.
 * 그래서 두 겹으로 거른다 — **후보 목록**(사람이 정한다)과 **최소 해금 수**(데이터가 정한다).
 */

/**
 * 홈트에 실제로 놓을 수 있는 것만. ⚠️ **바벨은 일부러 뺐다.**
 *
 * 바벨은 운동 수로 2위(+95)라 데이터만 보면 덤벨 다음이지만, 원룸에 랙과 200cm 봉을 놓으라는
 * 말이 된다. 안전 문제도 혼자 드는 사람에게는 다르게 걸린다. **숫자가 못 잡는 판단이라 목록으로 박았다.**
 *
 * 짐볼(+9)·메디신볼(+2)·복근롤러(+1)·폼롤러(**+0**)도 뺐다 — 특히 폼롤러는 근력 운동이
 * 하나도 안 늘어난다. 스트레칭 도구지 근력 기구가 아니다.
 */
export const SHOP_CANDIDATES: readonly EquipKey[] = ['dumbbell', 'kettlebell', 'bench', 'band', 'pullupBar'];

/**
 * 이만큼은 늘어나야 권한다.
 *
 * 벤치가 정확히 이 경계에 걸린다 — 맨몸만 가진 사람에겐 **+4**라 안 보이고, 덤벨을 가진
 * 순간 **+12**가 되어 나타난다. 조건문 하나 없이 「지금 뭘 가졌나」가 추천을 바꾸는 자리다.
 */
export const MIN_GAIN = 10;

export type Recommendation = Unlock & { key: EquipKey };

/**
 * 살 만한 기구를 많이 열어주는 순서로.
 *
 * ⚠️ 기준선은 `effectiveOwned`로 잡는다 — 조절식 벤치를 가진 사람은 인클라인까지 이미
 * 할 수 있으므로, 그걸 빼고 세면 base가 낮아져 **다른 기구의 배수가 부풀어 보인다.**
 *
 * ⚠️ **근력만 센다.** 스트레칭까지 넣으면 맨몸 기준이 부풀어 덤벨 배수가 주저앉는다.
 * `unlockGain`은 이 필터를 호출부에 맡기지만 여기서는 안에서 한다 — 맡기면 잊고,
 * 실제로 이 함수의 첫 테스트가 그 함정에 그대로 걸렸다.
 */
export function recommend(exercises: Exercise[], owned: EquipKey[], spec: EquipSpec): Recommendation[] {
  const strength = exercises.filter((e) => e.category === 'strength');
  const have = effectiveOwned(owned, spec);
  return SHOP_CANDIDATES.filter((k) => !owned.includes(k))
    .map((k) => ({ key: k, ...unlockGain(strength, have, k) }))
    .filter((p) => p.gain >= MIN_GAIN)
    // 같은 수면 SHOP_CANDIDATES 순서가 유지된다(정렬이 안정적이다).
    .sort((a, b) => b.gain - a.gain);
}
