/**
 * free-exercise-db(873개, Unlicense) → 홈트 기준으로 정제해 src/data/exercises.json 을 만든다.
 *
 * 한 번 돌려 결과를 커밋한다. 런타임에는 이 스크립트가 관여하지 않는다.
 *   node scripts/build-exercises.mjs            # 원본을 내려받아 빌드
 *   EX_SRC=./ex.json node scripts/build-exercises.mjs   # 로컬 원본으로 빌드
 *
 * 핵심 결정 세 가지
 *  1) 장비는 단일 값이 아니라 **집합**(`requires`)이다. 덤벨 벤치프레스는 덤벨 + 벤치가 둘 다 있어야 한다.
 *     원본의 `equipment`는 단일 값이라 이걸 표현하지 못한다.
 *  2) **제외가 기본값**이다. `other` 122개는 스트롱맨·썰매·박스·TRX 같은 잡동사니라
 *     홈트에서 쓸 수 있는 것만 골라 담는다. 잘못 뺀 운동은 안 보일 뿐이지만,
 *     잘못 넣은 운동(집에서 아틀라스 스톤)은 앱을 못 믿게 만든다.
 *  3) 헬스장 전용(머신·케이블·스미스)은 통째로 버린다. 홈트 앱에서는 노이즈다.
 */
import { readFileSync, writeFileSync } from 'node:fs';

import { DROP, NAME_OVERRIDE, PHRASES, TERMS } from './ko-terms.mjs';

const SRC = process.env.EX_SRC ?? 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const OUT = new URL('../src/data/exercises.json', import.meta.url);

/** 홈트 장비 어휘. 이 목록에 없는 장비를 요구하는 운동은 실리지 않는다. */
export const EQUIPMENT = ['dumbbell', 'barbell', 'kettlebell', 'band', 'pullupBar', 'bench', 'exerciseBall', 'foamRoller', 'medicineBall', 'abRoller'];

/** 원본 equipment → 홈트 어휘. 값이 `null`이면 맨몸(요구 장비 없음), 없으면 제외. */
const REMAP = {
  'body only': [],
  null: [], // 스트레칭 62 + 플라이오 8 + 맨몸 근력 6. 맨몸으로 합치되 category로 구분한다
  dumbbell: ['dumbbell'],
  barbell: ['barbell'],
  'e-z curl bar': ['barbell'], // 이지바는 따로 사는 사람이 드물다. 바벨로 합친다
  kettlebells: ['kettlebell'],
  bands: ['band'],
  'exercise ball': ['exerciseBall'],
  'foam roll': ['foamRoller'],
  'medicine ball': ['medicineBall'],
  // machine(67) · cable(81) → 헬스장 전용. 제외
};

/**
 * `other` 122개 중 홈트에서 실제로 할 수 있는 것만. 나머지 89개는 제외된다.
 * 제외되는 것들: 스트롱맨(아틀라스 스톤·통나무·타이어), 썰매, 박스·콘·허들 점프,
 * TRX/링/평행봉/로프, 자전거·스케이팅, 목 운동, 체인.
 */
const OTHER_ALLOW = {
  Ab_Roller: ['abRoller'],
  // SMR = self-myofascial release. 폼롤러로 민다
  'Anterior_Tibialis-SMR': ['foamRoller'],
  'Foot-SMR': ['foamRoller'],
  'Neck-SMR': ['foamRoller'],
  // 맨몸 스트레칭 — 의자 정도만 있으면 된다
  Behind_Head_Chest_Stretch: [],
  Chair_Leg_Extended_Stretch: [],
  Chair_Upper_Body_Stretch: [],
  Chest_And_Front_Of_Shoulder_Stretch: [],
  IT_Band_and_Glute_Stretch: [],
  Intermediate_Groin_Stretch: [],
  Intermediate_Hip_Flexor_and_Quad_Stretch: [],
  Lying_Bent_Leg_Groin: [],
  Lying_Hamstring: [],
  'On-Your-Back_Quad_Stretch': [],
  Overhead_Lat: [],
  Peroneals_Stretch: [],
  Posterior_Tibialis_Stretch: [],
  Quad_Stretch: [],
  Round_The_World_Shoulder_Stretch: [],
  Seated_Hamstring_and_Calf_Stretch: [],
  Standing_Biceps_Stretch: [],
  Standing_Elevated_Quad_Stretch: [],
  Standing_Hamstring_and_Calf_Stretch: [],
  // 철봉 — 문틀 풀업바로 되는 것만. 평행봉·링·로프는 뺐다
  'Band_Assisted_Pull-Up': ['pullupBar', 'band'],
  Gironda_Sternum_Chins: ['pullupBar'],
  Kipping_Muscle_Up: ['pullupBar'],
  Mixed_Grip_Chin: ['pullupBar'],
  Muscle_Up: ['pullupBar'],
  'One_Arm_Chin-Up': ['pullupBar'],
  One_Handed_Hang: ['pullupBar'],
  'Rocky_Pull-Ups_Pulldowns': ['pullupBar'],
  Side_To_Side_Chins: ['pullupBar'],
  Weighted_Pull_Ups: ['pullupBar'],
  // 원판을 쓰는 운동. 원판은 바벨과 같이 들어온다
  Front_Plate_Raise: ['barbell'],
  Plate_Pinch: ['barbell'],
  Plate_Twist: ['barbell'],
  Reverse_Plate_Curls: ['barbell'],
  Standing_Olympic_Plate_Hand_Squeeze: ['barbell'],
  Svend_Press: ['barbell'],
  // 무게만 들면 되는 것 — 덤벨이 가장 흔하다
  'Otis-Up': ['dumbbell'],
  Weighted_Squat: ['dumbbell'],
  Seated_Band_Hamstring_Curl: ['band'],
  'Weighted_Sit-Ups_-_With_Bands': ['band'],
  Weighted_Bench_Dip: ['bench'],
};

/**
 * 벤치가 추가로 필요한지 이름으로 가린다.
 *
 * 프리웨이트에서만 적용한다 — 덤벨 27 · 바벨 27 · 밴드 1개가 걸리고 전부 실제로 벤치가 필요하다.
 * 맨몸(`Incline Push-Up`, `Bench Dips`)에는 적용하지 않는다. 의자·소파로 되고,
 * `Hyperextensions With No Hyperextension Bench`처럼 이름이 오히려 반대인 것도 있다.
 * ponytail: 이름 기반 휴리스틱이다. 오분류가 보이면 개별 예외를 여기 적는다.
 */
const NEEDS_BENCH = /bench|incline|decline/i;
const FREE_WEIGHT = new Set(['dumbbell', 'barbell', 'band']);

function requiresOf(e) {
  if (e.equipment === 'other') return OTHER_ALLOW[e.id] ?? null;
  const base = REMAP[e.equipment ?? null];
  if (base === undefined) return null;
  if (base.some((k) => FREE_WEIGHT.has(k)) && NEEDS_BENCH.test(e.name)) return [...base, 'bench'];
  return base;
}

/** 이미 한글로 바뀐 조각인지. 구절 치환 결과를 다시 토큰으로 씹지 않기 위해. */
const isKorean = (s) => /[가-힣]/.test(s);

const unmapped = new Map();

/** 영어 운동명 → 한글. 미매핑 토큰은 `unmapped`에 모아 두고 마지막에 한꺼번에 터뜨린다. */
function toKorean(e) {
  if (NAME_OVERRIDE[e.id]) return NAME_OVERRIDE[e.id];
  // 슬래시는 **글자 사이일 때만** 단어 구분자다 — 'Adductor/Groin'은 갈라야 하고 '3/4'는 붙어 있어야 한다.
  let s = e.name.replace(/(?<=[a-zA-Z])\/(?=[a-zA-Z])/g, ' ');
  // 긴 구절부터 — 'Sit-Up'을 먼저 걸면 'Sit-Ups'가 '싯업s'로 잘린다.
  for (const [en, ko] of [...PHRASES].sort((a, b) => b[0].length - a[0].length)) s = s.split(en).join(ko);
  const out = [];
  // `/`로는 자르지 않는다 — '3/4 Sit-Up'의 분수가 '3 4'로 갈라진다.
  for (const rawToken of s.split(/\s+/)) {
    const token = rawToken.replace(/[(),.]/g, '');
    if (!token) continue;
    // 한글이거나 숫자·기호뿐인 조각(3/4, 180°)은 그대로 둔다.
    if (isKorean(token) || !/[a-z]/i.test(token)) {
      out.push(token);
      continue;
    }
    const key = token.toLowerCase();
    if (DROP.has(key)) continue;
    const ko = TERMS[key];
    if (ko === undefined) {
      unmapped.set(key, (unmapped.get(key) ?? 0) + 1);
      out.push(token);
      continue;
    }
    out.push(ko);
  }
  return out.join(' ').replace(/\s*([＋＆])\s*/g, ' $1 ').trim();
}

const raw = SRC.startsWith('http')
  ? await fetch(SRC).then((r) => {
      if (!r.ok) throw new Error(`원본 내려받기 실패: ${r.status}`);
      return r.json();
    })
  : JSON.parse(readFileSync(SRC, 'utf8'));

const out = [];
const dropped = [];
for (const e of raw) {
  const requires = requiresOf(e);
  if (requires === null) {
    dropped.push(e.name);
    continue;
  }
  const unknown = requires.filter((k) => !EQUIPMENT.includes(k));
  if (unknown.length) throw new Error(`${e.id}: 어휘에 없는 장비 ${unknown}`);
  out.push({
    id: e.id,
    name: toKorean(e),
    nameEn: e.name,
    requires: requires.sort(),
    category: e.category,
    level: e.level,
    force: e.force ?? null,
    mechanic: e.mechanic ?? null,
    primaryMuscles: e.primaryMuscles,
    secondaryMuscles: e.secondaryMuscles,
    images: e.images,
  });
}
out.sort((a, b) => a.id.localeCompare(b.id));

// 영어가 조용히 섞여 나가는 것을 막는다 — 화면에 뜨고 나서야 알아채면 늦다.
if (unmapped.size) {
  const list = [...unmapped].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}(${n})`);
  throw new Error(`한글 사전에 없는 토큰 ${unmapped.size}종: ${list.join(' ')}`);
}

writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n', 'utf8');

// 사람이 눈으로 확인할 요약. 해금 수치가 설계와 맞는지 여기서 바로 보인다.
const has = (o, req) => req.every((r) => o.includes(r));
const strength = out.filter((e) => e.category === 'strength');
const n = (owned) => strength.filter((e) => has(owned, e.requires)).length;
console.log(`원본 ${raw.length} → 채택 ${out.length} / 제외 ${dropped.length}`);
console.log(`근력 ${strength.length}개 기준 해금 수치:`);
const base = n([]);
console.log(`  맨몸만        ${base}`);
for (const k of EQUIPMENT) {
  const gain = n([k]) - base;
  if (gain > 0) console.log(`  + ${k.padEnd(12)} ${n([k])}  (+${gain}, ${(n([k]) / base).toFixed(2)}배)`);
}
