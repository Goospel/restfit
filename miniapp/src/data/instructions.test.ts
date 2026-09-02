import { describe, expect, it } from 'vitest';

import { EXERCISES } from './exercises';
import INSTRUCTIONS from './instructions.json';

/**
 * 번역 데이터에 대한 회귀 가드.
 *
 * 문장이 맞는지는 사람이 표본으로 읽는다(설계 §7). 여기서 막는 것은 **형식이 무너지는 것** —
 * 한 줄만 손으로 고치다가 영어가 섞이거나, 배치를 다시 돌려 절반만 들어오는 경우다.
 * `scripts/merge-instructions.mjs`도 같은 검사를 하지만 그쪽은 원본이 있어야 돌고,
 * 커밋된 결과를 지키는 것은 이 테스트다.
 */
const STEPS: Record<string, string[]> = INSTRUCTIONS;
const ENTRIES = Object.entries(STEPS);

describe('instructions.json', () => {
  it('모든 키가 실제 운동 id다', () => {
    // 없는 id는 화면에 뜰 일이 없다 — 있으면 묶음을 잘못 합친 것이고, 조용히 죽은 데이터가 된다.
    const ids = new Set(EXERCISES.map((e) => e.id));
    expect(ENTRIES.filter(([id]) => !ids.has(id)).map(([id]) => id)).toEqual([]);
  });

  it('키가 600개 이상이다', () => {
    // ★ 번역이 절반만 들어간 채로 머지되는 것을 막는다. 설명이 0단계인 5개는 키가 없는 게 정상이다.
    expect(ENTRIES.length).toBeGreaterThanOrEqual(600);
  });

  it('빈 배열이 없다 — 키가 있으면 단계가 있다', () => {
    // 빈 배열은 「키가 없다」와 화면에서 같은 뜻이라, 남아 있으면 데이터만 늘린다.
    expect(ENTRIES.filter(([, v]) => !Array.isArray(v) || v.length === 0).map(([id]) => id)).toEqual([]);
  });

  it('모든 단계가 비어 있지 않고 80자 이하다', () => {
    // 80자를 넘으면 시트에서 세 줄이 된다 — 「짧은 번역」이라는 결정 자체가 무너진다(설계 §4.2).
    const bad = ENTRIES.flatMap(([id, v]) =>
      v.filter((s) => typeof s !== 'string' || !s.trim() || s.length > 80).map((s) => `${id}: ${s}`),
    );
    expect(bad).toEqual([]);
  });

  it('영문이 남아 있지 않다', () => {
    // 사용자는 영어를 못 읽는다. SMR·kg·cm는 한국에서도 그대로 쓰는 토큰이라 예외다.
    const bad = ENTRIES.flatMap(([id, v]) =>
      v.filter((s) => /[A-Za-z]{3,}/.test(s.replace(/SMR|kg|cm/g, ''))).map((s) => `${id}: ${s}`),
    );
    expect(bad).toEqual([]);
  });
});
