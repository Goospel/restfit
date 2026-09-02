/**
 * 운동 단계 설명. **동적 import라 별도 청크다** — 260KB가 첫 로드에 끼면 시트를 안 여는 사람까지
 * 그 값을 치른다. 여는 사람만 받고, 한 번 받으면 브라우저가 캐시한다(설계 §2#6).
 *
 * 키가 없으면 빈 배열이다 — 설명이 0단계인 운동 5개와 「아직 없음」이 같은 길로 처리된다.
 * **청크를 못 받아도 빈 배열이다** — 동적 import는 네트워크를 타서 오프라인이면 reject한다.
 * 던지게 두면 unhandled rejection이 남고 사진·닫기까지 못 쓴다. 설명만 없는 시트로 마감한다(설계 §3.3).
 */
export async function loadInstructions(id: string): Promise<string[]> {
  try {
    const m = await import('./instructions.json');
    return (m.default as Record<string, string[]>)[id] ?? [];
  } catch {
    return [];
  }
}
