/**
 * 번역 묶음(`part-N.ko.json` 8개) → 원본 대조 검사 → `src/data/instructions.json`.
 *
 * `build-exercises.mjs`와 같은 관계다 — **한 번 돌려 결과를 커밋한다.** 런타임에는 관여하지 않는다.
 *   PARTS_DIR=/tmp/tr EX_SRC=/tmp/src-exercises.json node scripts/merge-instructions.mjs
 *   node scripts/merge-instructions.mjs /tmp/tr        # 원본은 URL에서 내려받는다
 *
 * **번역은 이 스크립트가 하지 않는다.** free-exercise-db(Unlicense)의 영어 `instructions`를
 * Claude 서브에이전트가 80개씩 8묶음으로 나눠 번역해 스크래치패드에 써 두고, 이 스크립트는
 * 그것을 **합치고 검사만** 한다. 번역을 코드로 못 하니, 검사를 코드로 한다.
 *
 * 번역 규칙(설계 §4.2 — 검사가 못 잡는 것은 표본 검수가 잡는다):
 *  1) 단계 수 유지. 단 마지막이 「권장 횟수만큼 반복한다」류면 **그 한 단계만 뺀다** — 횟수는 앱이 정한다.
 *     그래서 아래 검사는 「원문과 같거나 정확히 1 적다」만 통과시킨다.
 *  2) 평서형 「~한다」, 한 단계 60자 이하 목표·80자 상한.
 *  3) 용어는 화면 어휘를 따른다(MUSCLE_KO · EQUIPMENT_KO · exercises.json의 name).
 *  4) 영문자를 남기지 않는다. 예외 토큰은 SMR · kg · cm뿐.
 *
 * 설명이 0단계인 운동 5개는 키 자체가 없다 — 화면은 사진만 보여 준다(설계 §2#6).
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const EXERCISES = JSON.parse(readFileSync(new URL('../src/data/exercises.json', import.meta.url), 'utf8'));

const PARTS_DIR = process.env.PARTS_DIR ?? process.argv[2];
const SRC = process.env.EX_SRC ?? 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const OUT = new URL('../src/data/instructions.json', import.meta.url);

/** 한 단계의 상한. 이보다 길면 시트에서 세 줄이 되어 「짧은 번역」이라는 결정 자체가 무너진다. */
const MAX_LEN = 80;
/** 한국 헬스에서도 그대로 쓰는 토큰. 이것만 빼고 영문자를 본다. */
const ALLOW = /SMR|kg|cm/g;

if (!PARTS_DIR) throw new Error('번역 묶음 디렉터리가 없다 — PARTS_DIR 환경변수나 첫 인자로 준다');

const raw = SRC.startsWith('http')
  ? await fetch(SRC).then((r) => {
      if (!r.ok) throw new Error(`원본 내려받기 실패: ${r.status}`);
      return r.json();
    })
  : JSON.parse(readFileSync(SRC, 'utf8'));

/** 원본 단계 수. 번역이 문장을 통째로 빠뜨린 것을 잡는 유일한 근거다. */
const srcSteps = new Map(raw.map((e) => [e.id, e.instructions ?? []]));
const ids = new Set(EXERCISES.map((e) => e.id));

const merged = new Map();
const problems = [];
const files = readdirSync(PARTS_DIR).filter((f) => /^part-.*\.ko\.json$/.test(f)).sort();
if (!files.length) throw new Error(`${PARTS_DIR}에 part-*.ko.json이 없다`);

for (const file of files) {
  const part = JSON.parse(readFileSync(join(PARTS_DIR, file), 'utf8'));
  for (const [id, steps] of Object.entries(part)) {
    const where = `${file} ${id}`;
    if (merged.has(id)) problems.push(`${where}: 다른 묶음과 중복된 키`);
    // 채택 640개 밖의 id는 화면에 뜰 일이 없다 — 들어와 있으면 묶음을 잘못 만든 것이다.
    if (!ids.has(id)) problems.push(`${where}: exercises.json에 없는 id`);
    const n = (srcSteps.get(id) ?? []).length;
    if (!(steps.length === n || steps.length === n - 1)) {
      problems.push(`${where}: 단계 ${steps.length}개 (원문 ${n}개 — 같거나 정확히 1 적어야 한다)`);
    }
    for (const [i, s] of steps.entries()) {
      if (typeof s !== 'string' || !s.trim()) problems.push(`${where} #${i + 1}: 빈 단계`);
      else if (s.length > MAX_LEN) problems.push(`${where} #${i + 1}: ${s.length}자 (상한 ${MAX_LEN})`);
      const left = String(s).replace(ALLOW, '');
      if (/[A-Za-z]{3,}/.test(left)) problems.push(`${where} #${i + 1}: 영문이 남았다 — ${s}`);
    }
    merged.set(id, steps);
  }
}

if (problems.length) {
  for (const p of problems.slice(0, 40)) console.error(`  ✗ ${p}`);
  console.error(`문제 ${problems.length}건 — instructions.json을 쓰지 않는다`);
  process.exit(1);
}

// exercises.json 순서로 쓴다 — 묶음 순서대로 두면 묶기를 다시 할 때마다 diff가 통째로 흔들린다.
const out = {};
for (const e of EXERCISES) if (merged.has(e.id)) out[e.id] = merged.get(e.id);

const json = JSON.stringify(out, null, 1) + '\n';
writeFileSync(OUT, json, 'utf8');

const keys = Object.keys(out);
const steps = keys.reduce((n, id) => n + out[id].length, 0);
// 원문보다 한 단계 적은 것 = 규칙 1의 「권장 횟수만큼 반복한다」를 뺀 것.
const dropped = keys.filter((id) => out[id].length === (srcSteps.get(id) ?? []).length - 1).length;
const bytes = Buffer.byteLength(json);
console.log(`묶음 ${files.length}개 → 키 ${keys.length} / 단계 ${steps} (평균 ${(steps / keys.length).toFixed(1)})`);
console.log(`「반복」 단계 삭제 ${dropped}개 · 최장 ${Math.max(...keys.flatMap((id) => out[id].map((s) => s.length)))}자`);
console.log(`raw ${(bytes / 1024).toFixed(1)}KB · gzip ${(gzipSync(json).length / 1024).toFixed(1)}KB`);
console.log(`설명이 없는 운동 ${EXERCISES.length - keys.length}개는 키가 없다 — 사진만 보여 준다`);
