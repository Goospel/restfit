/**
 * 운동명 한글화 사전.
 *
 * **왜 통째 번역이 아니라 토큰 치환인가**: 한국 헬스 용어는 대부분 영어 음차이고 어순도 그대로다
 * ("Incline Dumbbell Curl" → "인클라인 덤벨 컬"). 647개를 손으로 옮기면 같은 단어가
 * 파일마다 다르게 적히지만, 사전은 한 번 정하면 끝까지 일관된다.
 *
 * 미매핑 토큰이 하나라도 남으면 빌드가 **실패한다**. 영어가 조용히 섞여 들어가는 게 최악이다.
 *
 * ponytail: 음차 위주라 스트레칭 이름이 다소 뻣뻣하다("라잉 햄스트링").
 * Phase 2에서 화면에 띄워 보고 어색한 것만 NAME_OVERRIDE로 잡는다.
 */

/** 이름 통째로 갈아끼우는 예외. 토큰 치환으로는 어순이 깨지는 것들. id 기준. */
export const NAME_OVERRIDE = {
  'Kettlebell_Turkish_Get-Up_Lunge_style': '케틀벨 터키시 겟업 (런지)',
  'Kettlebell_Turkish_Get-Up_Squat_style': '케틀벨 터키시 겟업 (스쿼트)',
  'Rocky_Pull-Ups_Pulldowns': '로키 풀업',
  All_Fours_Quad_Stretch: '네발기기 쿼드 스트레치',
  'Otis-Up': '오티스 업',
  // SMR(폼롤러로 근막을 미는 것) 13종 — 부위명이 앞 단어에 흩어져 있어 토큰 치환으로는 겹치거나 어색해진다.
  'Anterior_Tibialis-SMR': '전경골근 SMR',
  'Brachialis-SMR': '상완근 SMR',
  'Calves-SMR': '종아리 SMR',
  'Foot-SMR': '발바닥 SMR',
  'Hamstring-SMR': '햄스트링 SMR',
  'Iliotibial_Tract-SMR': '장경인대 SMR',
  'Latissimus_Dorsi-SMR': '광배근 SMR',
  'Lower_Back-SMR': '허리 SMR',
  'Neck-SMR': '목 SMR',
  'Peroneals-SMR': '비골근 SMR',
  'Piriformis-SMR': '이상근 SMR',
  'Quadriceps-SMR': '대퇴사두 SMR',
  'Rhomboids-SMR': '능형근 SMR',
};

/** 여러 단어가 붙어 하나의 용어인 것. 토큰 치환보다 **먼저** 적용된다. */
export const PHRASES = [
  ['Clean and Jerk', '클린 앤 저크'],
  ['Clean and Press', '클린 앤 프레스'],
  ['Skull Crusher', '스컬크러셔'],
  ['Bench Press', '벤치프레스'],
  ['Good Mornings', '굿모닝'],
  ['Good Morning', '굿모닝'],
  ['Mountain Climbers', '마운틴 클라이머'],
  ["Child's Pose", '아기 자세'],
  ['Cat Stretch', '고양이 자세'],
  ["World's Greatest Stretch", '월드 그레이티스트 스트레치'],
  ['Around The Worlds', '어라운드 더 월드'],
  ['Push-Up', '푸시업'],
  ['Push-up', '푸시업'],
  ['Push Up', '푸시업'],
  ['Push-Ups', '푸시업'],
  ['Pull-Up', '풀업'],
  ['Pull-Ups', '풀업'],
  ['Pull Ups', '풀업'],
  ['Pull Up', '풀업'],
  ['Chin-Up', '친업'],
  ['Sit-Up', '싯업'],
  ['Sit-Ups', '싯업'],
  ['Get-Up', '겟업'],
  ['Glute-Ham', '글루트햄'],
  ['Step-up', '스텝업'],
  ['Body-Up', '바디업'],
  ['Butt-Ups', '버트업'],
  ['Pull-In', '풀인'],
  ['Bottoms-Up', '바텀업'],
];

/** 버리는 단어 — 관사·전치사. 한글 운동명에서는 안 쓴다. */
export const DROP = new Set(['a', 'an', 'the', 'of', 'on', 'to', 'or', '-', 'style', 'version']);

/**
 * 토큰 → 한글. 조회 전에 소문자로 낮추고 괄호·마침표를 떼어낸다.
 * 복수형은 대부분 단수와 같은 한글이라 따로 적었다(규칙으로 깎으면 `dips`→`dip` 같은 게 틀린다).
 */
export const TERMS = {
  // ── 장비
  dumbbell: '덤벨', dumbbells: '덤벨', db: '덤벨', barbell: '바벨', kettlebell: '케틀벨', kettlebells: '케틀벨',
  band: '밴드', bands: '밴드', bar: '바', 'ez-bar': '이지바', ez: '이지', 't-bar': '티바', 'v-bar': '브이바',
  ball: '볼', physioball: '짐볼', medicine: '메디신', plate: '플레이트', chain: '체인', chains: '체인',
  bench: '벤치', board: '보드', box: '박스', blocks: '블록', pin: '핀', pins: '핀', rack: '랙',
  roller: '롤러', ab: '복근', towel: '수건', chair: '의자', wall: '벽', floor: '플로어', landmine: '랜드마인',
  jammer: '재머', handle: '핸들', 'two-dumbbell': '투 덤벨', smith: '스미스', bike: '바이크', air: '에어',
  cambered: '캠버드', exercise: '엑서사이즈', stability: '스태빌리티',

  // ── 동작
  press: '프레스', presses: '프레스', curl: '컬', curls: '컬', squat: '스쿼트', squats: '스쿼트',
  raise: '레이즈', raises: '레이즈', row: '로우', rows: '로우', extension: '익스텐션', deadlift: '데드리프트',
  flye: '플라이', flyes: '플라이', fly: '플라이', crunch: '크런치', crunches: '크런치', lunge: '런지', lunges: '런지',
  shrug: '슈러그', pullover: '풀오버', dip: '딥', dips: '딥', clean: '클린', snatch: '스내치', jerk: '저크',
  thrust: '스러스트', thruster: '스러스터', swing: '스윙', swings: '스윙', twist: '트위스트',
  rotation: '로테이션', rotations: '로테이션', bridge: '브릿지', plank: '플랭크', rollout: '롤아웃',
  jump: '점프', hops: '홉', throw: '쓰로우', slam: '슬램', kick: '킥', kicks: '킥', kickback: '킥백',
  pull: '풀', pulls: '풀', pulldowns: '풀다운', pullup: '풀업', pullups: '풀업', pushups: '푸시업',
  chin: '친', chins: '친업', hang: '행', hanging: '행잉', walk: '워크', walking: '워킹', run: '런',
  running: '러닝', sprints: '스프린트', skipping: '스키핑', step: '스텝', ups: '업', up: '업',
  bend: '벤드', lift: '리프트', squeeze: '스퀴즈', squeezes: '스퀴즈', pinch: '핀치', touchers: '터처',
  touches: '터치', toe: '토', drag: '드래그', bound: '바운드', vacuum: '진공', catch: '캐치', pass: '패스',
  delivery: '딜리버리', return: '리턴', drill: '드릴', crawl: '크롤', groiners: '그로이너', inchworm: '인치웜',
  cocoons: '코쿤', jackknife: '잭나이프', windmill: '윈드밀', windmills: '윈드밀', circles: '서클',
  scoop: '스쿱', wipers: '와이퍼', movers: '무버', tuck: '턱', tucks: '턱', partials: '파셜',
  flexion: '플렉션', adductions: '어덕션', pronation: '프로네이션', supination: '수피네이션',
  scaption: '스캡션', laterals: '래터럴', 'leg-over': '레그오버', 'leg-up': '레그업', climbers: '클라이머',
  series: '시리즈', claw: '클로', spell: '스펠', caster: '캐스터', flutter: '플러터', scissor: '시저',
  scissors: '시저', superman: '슈퍼맨', locust: '로커스트', pose: '자세', stretch: '스트레치',
  hyperextension: '하이퍼익스텐션', hyperextensions: '하이퍼익스텐션', skullcrusher: '스컬크러셔',
  crusher: '크러셔', crosses: '크로스', crossover: '크로스오버', cross: '크로스', 'cross-body': '크로스바디',
  figure: '피겨', pyramid: '피라미드', position: '포지션', positions: '포지션', stance: '스탠스',
  grab: '그랩', hug: '허그', tilt: '틸트', vertical: '버티컬', sit: '싯', release: '릴리즈',
  heaving: '히빙', looking: '보기', pike: '파이크', handstand: '핸드스탠드', balance: '밸런스',

  // ── 자세·변형
  standing: '스탠딩', seated: '시티드', lying: '라잉', 'side-lying': '사이드 라잉', kneeling: '니링',
  prone: '프론', supine: '수파인', incline: '인클라인', decline: '디클라인', flat: '플랫',
  'bent-over': '벤트오버', bent: '벤트', 'bent-arm': '벤트암', 'bent-knee': '벤트니',
  'straight-arm': '스트레이트암', straight: '스트레이트', 'stiff-legged': '스티프 레그', stiff: '스티프',
  'one-arm': '원암', 'two-arm': '투암', 'single-arm': '싱글암', 'one-leg': '원레그', 'one-legged': '원레그',
  'on-your-back': '누워서', handed: '핸드', single: '싱글', double: '더블', two: '투', one: '원',
  half: '하프', full: '풀', alternating: '얼터네이팅', alternate: '얼터네이트', 'see-saw': '시소',
  seesaw: '시소', 'close-grip': '클로즈그립', 'wide-grip': '와이드그립', wide: '와이드', close: '클로즈',
  narrow: '내로우', grip: '그립', neutral: '뉴트럴', reverse: '리버스', hammer: '해머',
  'palms-down': '팜다운', 'palms-up': '팜업', 'palm-up': '팜업', 'palm-in': '팜인', 'palms-in': '팜인',
  palms: '팜', palm: '팜', pronated: '프로네이티드', supinated: '수피네이티드', '-pronated': '프로네이티드',
  overhead: '오버헤드', front: '프론트', rear: '리어', side: '사이드', sides: '사이드', lateral: '래터럴',
  medium: '미디엄', high: '하이', low: '로우', elevated: '엘리베이티드', weighted: '웨이티드',
  bodyweight: '맨몸', freehand: '맨몸', assisted: '어시스티드', isometric: '아이소메트릭',
  dynamic: '다이나믹', speed: '스피드', power: '파워', fast: '패스트', quick: '퀵', deficit: '데피싯',
  sumo: '스모', split: '스플릿', linear: '리니어', diagonal: '다이애고널', star: '스타', open: '오픈',
  'anti-gravity': '안티그래비티', advanced: '어드밴스드', intermediate: '중급', natural: '내추럴',
  olympic: '올림픽', powerlifting: '파워리프팅', military: '밀리터리', romanian: '루마니안',
  russian: '러시안', turkish: '터키시', cuban: '쿠반', arnold: '아놀드', zottman: '조트만',
  spider: '스파이더', preacher: '프리처', concentration: '컨센트레이션', gorilla: '고릴라',
  goblet: '고블릿', renegade: '리네게이드', frankenstein: '프랑켄슈타인', janda: '얀다',
  jefferson: '제퍼슨', jm: 'JM', tate: '테이트', zercher: '저처', bradford: '브래드포드', sissy: '시시',
  hack: '핵', pistol: '피스톨', plyo: '플라이오', clock: '클락', rocket: '로켓', rocking: '로킹',
  rocky: '로키', gironda: '지론다', sternum: '스터넘', kipping: '키핑', muscle: '머슬', monster: '몬스터',
  pirate: '파이럿', ships: '십', frog: '프로그', butt: '버트', dead: '데드', long: '롱', mid: '미드',
  middle: '미들', upper: '어퍼', lower: '로워', inner: '이너', 'inner-biceps': '이너 바이셉스',
  external: '익스터널', internal: '인터널', downward: '다운워드', upward: '업워드', backward: '백워드',
  around: '어라운드', over: '오버', below: '빌로우', above: '어보브', behind: '비하인드', through: '스루',
  between: '비트윈', against: '어게인스트', across: '어크로스', into: '인투', from: '프롬',
  with: '＋', and: '＆', in: '인', off: '오프', apart: '어파트', at: '앳', all: '올', fours: '포즈',
  range: '레인지', no: '노', your: '유어', world: '월드', worlds: '월드', "world's": '월드',
  greatest: '그레이티스트', "runner's": '러너', "dancer's": '댄서', "child's": '아기',
  response: '리스폰스', multiple: '멀티플', point: '포인트', technique: '테크닉', start: '스타트',
  acceleration: '가속', '3-part': '3파트', '3': '3', '4': '4', '8': '8', '90': '90', "180's": '180도',
  heel: '힐', iron: '아이언', para: '파라', carioca: '카리오카', bottoms: '바텀', car: '카',
  drivers: '드라이버', guillotine: '길로틴', svend: '스벤드', plie: '플리에', trail: '트레일',
  bug: '버그', wind: '윈드', straddle: '스트래들', torso: '토르소', good: '굿', morning: '모닝',
  moving: '무빙', mountain: '마운틴', cat: '캣', inverted: '인버티드', manual: '매뉴얼',
  push: '푸시', upright: '업라이트', extended: '익스텐디드', facing: '페이싱', feet: '풋',
  mixed: '믹스드', round: '라운드', 'back-leg': '백 레그',

  // ── 부위
  chest: '체스트', back: '백', shoulder: '숄더', shoulders: '숄더', leg: '레그', legs: '레그',
  calf: '카프', calves: '카프', triceps: '트라이셉스', tricep: '트라이셉스', biceps: '바이셉스',
  bicep: '바이셉스', glute: '글루트', glutes: '글루트', hamstring: '햄스트링', hamstrings: '햄스트링',
  ham: '햄', quad: '쿼드', quads: '쿼드', quadriceps: '대퇴사두', wrist: '손목', neck: '목', hip: '힙',
  hips: '힙', knee: '무릎', knees: '무릎', ankle: '발목', groin: '사타구니', adductor: '내전근',
  delt: '델트', deltoid: '델트', oblique: '오블리크', spinal: '척추', body: '바디', arm: '암', arms: '암',
  hand: '핸드', hands: '핸드', finger: '손가락', forearm: '전완', elbow: '엘보', elbows: '엘보',
  head: '헤드', flexor: '플렉서', flexors: '플렉서', lat: '랫', latissimus: '광배', dorsi: '광배',
  rhomboids: '능형근', piriformis: '이상근', gastrocnemius: '비복근', soleus: '가자미근',
  achilles: '아킬레스', brachialis: '상완근', ceiling: '천장', pelvic: '골반', stomach: '복부',
  scapular: '스캐퓰러', anterior: '전면', posterior: '후면', it: 'IT',
  tibialis: '경골근', peroneals: '비골근',
  // *-SMR 계열은 전부 NAME_OVERRIDE로 잡는다. 새 SMR 운동이 생기면 여기서 빌드가 깨져 눈에 띈다.
};
