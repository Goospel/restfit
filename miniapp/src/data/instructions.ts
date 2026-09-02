/**
 * 운동 단계 설명. **동적 import라 별도 청크다** — 260KB가 첫 로드에 끼면 시트를 안 여는 사람까지
 * 그 값을 치른다. 여는 사람만 받고, 한 번 받으면 브라우저가 캐시한다(설계 §2#6).
 *
 * 키가 없으면 빈 배열이다 — 설명이 0단계인 운동 5개와 「아직 없음」이 같은 길로 처리된다.
 */
export async function loadInstructions(id: string): Promise<string[]> {
  const m = await import('./instructions.json');
  return (m.default as Record<string, string[]>)[id] ?? [];
}
