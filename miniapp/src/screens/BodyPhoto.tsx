import { useEffect, useRef, useState } from 'react';

import { probeCamera, stopStream, type CameraProbeResult, type MediaDevicesLike } from '../camera';
import { captureJpeg, PREVIEW_TRANSFORM, type Captured } from '../logic/capture';
import { listPhotos, openPhotoDb, savePhoto, type BodyPhoto as Photo, type PhotoDb } from '../photoStore';
import { todayKey } from '../storage';
import { ui } from '../ui';

/**
 * 눈바디 촬영. **매일 같은 구도로 찍는 것이 이 화면의 전부다.**
 *
 * 첫 촬영은 격자 + 실루엣으로 기준 구도를 잡고, 이후에는 **기준 사진(남아 있는 가장 오래된
 * 것)**을 반투명 고스트로 겹쳐 사람이 스스로 맞춘다 — 자세 인식 AI는 없다(설계 §4).
 * 고스트를 직전 사진으로 두면 하루 1~2px의 어긋남이 누적돼 한 달 뒤 구도가 딴판이 된다.
 *
 * ⚠️ **미러 일관성**: 프리뷰가 거울상이면 저장본도 같은 방향이어야 한다. 한쪽만 고치면
 * 다음날 고스트와 몸이 좌우로 어긋나 **영영 안 맞는다** — 변환은 `logic/capture.ts` 한 곳에서 나온다.
 *
 * ⚠️ 실패해도 **닫기로 멀쩡히 돌아간다.** 심사자는 권한을 거부부터 눌러 본다(설계 §6.1).
 */

/** 프로브가 감별해 둔 세 갈래를 사용자 문구로 옮긴다. 원문은 작은 글씨로 병기한다(문의 대응용). */
function cameraNotice(detail: string): string {
  if (detail === 'unsupported') return '이 환경에서는 카메라를 쓸 수 없어요';
  // 권한은 사용자가 고칠 수 있는 유일한 실패다 — 「다시 시도」로 뭉개면 영영 안 되는 재시도만 반복한다.
  if (detail.startsWith('NotAllowedError')) return '카메라 권한이 꺼져 있어요. 토스 앱 설정에서 허용해 주세요';
  return '카메라를 여는 데 실패했어요. 잠시 후 다시 시도해 주세요';
}

const QUOTA_NOTICE = '공간이 부족해요 — 오래된 사진을 지워 주세요';
const SAVE_NOTICE = '저장하지 못했어요. 다시 시도해 주세요';
const SHOT_NOTICE = '사진을 찍지 못했어요. 다시 시도해 주세요';

/** 사람이 프롬프트를 읽고 누를 시간은 주되, 웹뷰가 프롬프트를 삼켰을 때 화면이 굳지는 않게. */
const OPEN_TIMEOUT_MS = 10000;

export function BodyPhoto({
  onClose,
  media = navigator.mediaDevices,
  idb,
  capture = captureJpeg,
}: {
  onClose: () => void;
  /** 테스트가 가짜 카메라를 넣는 자리. 실사용에서는 `navigator.mediaDevices`다. */
  media?: MediaDevicesLike;
  /** 테스트가 fake-indexeddb를 넣는 자리. 없으면 `globalThis.indexedDB`. */
  idb?: IDBFactory;
  /** jsdom에는 2D 컨텍스트가 없어 캡처만 목으로 갈아 끼운다. */
  capture?: typeof captureJpeg;
}) {
  /** `null`은 「아직 여는 중」이다 — 실패와 구별돼야 화면이 「켜는 중」과 안내로 갈린다. */
  const [cam, setCam] = useState<CameraProbeResult | null>(null);
  /** `undefined`는 로딩, `null`은 「이 기기에서는 못 쓴다」. */
  const [db, setDb] = useState<PhotoDb | null | undefined>(undefined);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [ghostOn, setGhostOn] = useState(true);
  const [count, setCount] = useState<number | null>(null);
  const [shot, setShot] = useState<Captured | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  /**
   * 카메라를 연다. **스트림의 수명이 이 effect 하나에 갇힌다** — 화면을 닫으면 반드시 꺼진다.
   *
   * 늦게 도착한 스트림(이미 언마운트된 뒤)도 끈다. 붙일 화면이 없는데 그냥 두면
   * **카메라가 켜진 채로 남아** 다음 진입이 막힌다.
   */
  useEffect(() => {
    let dead = false;
    let live: MediaStream | null = null;
    void probeCamera(media, { timeoutMs: OPEN_TIMEOUT_MS }).then((r) => {
      if (dead) {
        if (r.ok) stopStream(r.stream);
        return;
      }
      if (r.ok) live = r.stream;
      setCam(r);
    });
    return () => {
      dead = true;
      if (live) stopStream(live);
    };
  }, [media]);

  /**
   * ⚠️ **`shot`이 deps에 있어야 한다.** 확인 화면으로 갈 때 `<video>`가 통째로 사라졌다가
   * 「다시 찍기」에서 **새 노드로** 돌아온다 — 스트림을 처음 한 번만 붙이면 돌아온 프리뷰는
   * 영영 까맣고, 사용자는 카메라가 고장 난 줄 안다.
   */
  useEffect(() => {
    if (cam?.ok && video.current) video.current.srcObject = cam.stream;
  }, [cam, shot]);

  // 기준 사진은 목록의 **첫 장**(가장 오래된 것)이다 — `listPhotos`가 날짜 오름차순이라 그렇다.
  useEffect(() => {
    let dead = false;
    void openPhotoDb(idb).then(async (opened) => {
      const list = opened ? await listPhotos(opened) : [];
      if (dead) return;
      setDb(opened);
      setPhotos(list);
    });
    return () => {
      dead = true;
    };
  }, [idb]);

  const baseline = photos[0];

  /**
   * blob URL은 **만든 곳이 놓아준다.** 안 놓으면 사진을 넘길 때마다 새고, 조용히 메모리만 자란다.
   */
  const ghostUrl = useObjectUrl(ghostOn ? baseline?.blob : undefined);
  const shotUrl = useObjectUrl(shot?.blob);

  // 카운트다운. 0에 닿는 순간이 셔터다 — 폰을 세우고 물러선 사람에게는 이것이 유일한 촬영 경로다.
  useEffect(() => {
    if (count === null) return;
    if (count === 0) {
      setCount(null);
      void shoot();
      return;
    }
    const t = setTimeout(() => setCount(count - 1), 1000);
    return () => clearTimeout(t);
  }, [count]);

  async function shoot() {
    if (!video.current || !canvas.current) return;
    const got = await capture(video.current, canvas.current);
    // 프레임이 아직 0×0이거나 2D 컨텍스트가 없는 경우다. 빈 사진을 저장하는 것보다 낫다.
    if (!got) return setNotice(SHOT_NOTICE);
    setNotice(null);
    setShot(got);
  }

  async function save() {
    if (!shot || !db) return;
    setSaving(true);
    const result = await savePhoto(db, {
      // 날짜가 키다 — 같은 날 다시 찍으면 교체된다(「하루 1장」).
      date: todayKey(),
      blob: shot.blob,
      capturedAt: Date.now(),
      width: shot.width,
      height: shot.height,
    });
    setSaving(false);
    if (result === 'ok') return onClose();
    // 원인을 갈라 말한다 — 쿼터에 「다시 시도」는 영영 안 되는 일을 권하는 것이다.
    setNotice(result === 'quota' ? QUOTA_NOTICE : SAVE_NOTICE);
  }

  const close = (
    <button style={ui.ghost} onClick={onClose}>
      닫기
    </button>
  );

  if (!cam) return <Center>카메라를 켜는 중이에요…{close}</Center>;

  if (!cam.ok) {
    return (
      <Center>
        <p style={{ ...ui.h2, margin: '0 0 6px' }}>{cameraNotice(cam.detail)}</p>
        {/* 원문 병기. 「실패했습니다」로 뭉개면 문의가 와도 무엇이 막혔는지 알 길이 없다. */}
        <p style={{ ...ui.sub, wordBreak: 'break-all' }}>{cam.detail}</p>
        {close}
      </Center>
    );
  }

  /**
   * ⚠️ **저장소가 준비되기 전에는 셔터를 안 연다.** 안 그러면 방금 찍은 사진을 들고 저장을
   * 눌렀는데 **아무 일도 안 일어나는** 순간이 생긴다(DB가 아직 `undefined`라 저장 함수가
   * 조용히 되돌아간다). 실측으로 잡힌 경합이고, 기다리는 편이 그 침묵보다 낫다.
   *
   * 기준 사진도 이때 같이 온다 — 프리뷰가 먼저 뜨고 고스트가 뒤늦게 얹히는 깜빡임도 없어진다.
   */
  if (db === undefined) return <Center>사진을 불러오는 중이에요…{close}</Center>;

  // 찍고 나서 못 넣는 것보다 찍기 전에 아는 것이 낫다(프라이빗 모드·구형 웹뷰).
  if (db === null) {
    return (
      <Center>
        <p style={{ ...ui.h2, margin: '0 0 6px' }}>이 기기에서는 사진을 저장할 수 없어요</p>
        {close}
      </Center>
    );
  }

  return (
    <main style={{ ...ui.pageFull, background: '#000', color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>눈바디</span>
        <span style={ui.spacer} />
        <button style={{ ...ui.ghost, color: '#fff' }} onClick={onClose}>
          닫기
        </button>
      </div>

      <div style={frameStyle}>
        {shot ? (
          <img src={shotUrl ?? undefined} alt="방금 찍은 사진" style={fillStyle} />
        ) : (
          <>
            <video ref={video} autoPlay playsInline muted style={{ ...fillStyle, transform: PREVIEW_TRANSFORM }} />
            {/* 격자는 첫 촬영에도 이후에도 항상 그린다 — 수평·중앙 맞추기의 최소 도구다. */}
            <div data-grid style={gridStyle} aria-hidden />
            {ghostUrl && <img src={ghostUrl} alt="기준 사진" style={{ ...fillStyle, opacity: 0.4 }} />}
            {/* 사진이 한 장이라도 생기면 실루엣은 안 그린다 — 고스트가 그 일을 더 잘한다. */}
            {!baseline && <Silhouette />}
            {count !== null && <div style={countStyle}>{count}</div>}
          </>
        )}
      </div>

      {notice && <p style={{ ...ui.sub, color: 'var(--red)', textAlign: 'center', margin: '10px 0 0' }}>{notice}</p>}

      {shot ? (
        <div style={{ ...ui.row, marginTop: 12 }}>
          <button style={{ ...ui.secondary, flex: 1 }} onClick={() => setShot(null)}>
            다시 찍기
          </button>
          <button style={{ ...ui.primary, flex: 1, ...(saving ? ui.disabled : null) }} disabled={saving} onClick={save}>
            저장
          </button>
        </div>
      ) : (
        <>
          <p style={{ ...ui.sub, color: '#b0b8c1', textAlign: 'center', margin: '12px 0 0' }}>
            {baseline
              ? '기준 사진에 몸을 맞춰 같은 구도로 찍어요.'
              : '이 구도가 기준이 됩니다. 벽·조명·거리를 기억해 두세요.'}
          </p>
          <div style={{ ...ui.row, marginTop: 12 }}>
            <button style={{ ...ui.secondary, flex: 1 }} disabled={count !== null} onClick={() => void shoot()}>
              촬영
            </button>
            {/* 폰을 기대 세우고 물러서면 버튼에 손이 안 닿는다 — 전신 촬영의 유일한 경로다. */}
            <button style={{ ...ui.primary, flex: 1 }} disabled={count !== null} onClick={() => setCount(3)}>
              3초 후 촬영
            </button>
          </div>
          {baseline && (
            <button style={{ ...ui.ghost, width: '100%', color: '#b0b8c1' }} onClick={() => setGhostOn(!ghostOn)}>
              {ghostOn ? '고스트 끄기' : '고스트 켜기'}
            </button>
          )}
        </>
      )}

      {/* 검수·사용자 양쪽에 같은 문장으로 답한다. 사실이다 — 서버는 0대다(설계 §6.1). */}
      <p style={{ ...ui.sub, color: '#8b95a1', textAlign: 'center', margin: '10px 0 0' }}>
        사진은 이 기기에만 저장되며 어디로도 전송되지 않습니다.
      </p>

      {/* 캡처용. 화면에는 안 보인다. */}
      <canvas ref={canvas} style={{ display: 'none' }} />
    </main>
  );
}

/**
 * blob URL 하나의 수명. **만든 곳이 revoke까지 책임진다**(설계 §4.6) — 화면을 닫거나
 * 원본이 바뀌면 즉시 놓아준다.
 */
function useObjectUrl(blob: Blob | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) return setUrl(null);
    const made = URL.createObjectURL(blob);
    setUrl(made);
    return () => {
      URL.revokeObjectURL(made);
      setUrl(null);
    };
  }, [blob]);
  return url;
}

/** 실패·로딩 화면. 문구만 다르고 형태는 같다. */
function Center({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ ...ui.pageFull, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
      {children}
    </main>
  );
}

/**
 * 전신 외곽 하나짜리 선. **정밀할 필요가 없다** — 「화면 세로를 몸으로 채우고 중앙에 서라」를
 * 말하는 그림이면 족하다(설계 §4.1).
 */
function Silhouette() {
  return (
    <svg
      role="img"
      aria-label="실루엣 가이드"
      viewBox="0 0 100 200"
      preserveAspectRatio="xMidYMid meet"
      style={{ ...fillStyle, opacity: 0.35 }}
      fill="none"
      stroke="#fff"
      strokeWidth={1.5}
    >
      <circle cx="50" cy="28" r="12" />
      <path d="M50 40 v55 M50 48 l-20 22 M50 48 l20 22 M50 95 l-13 60 M50 95 l13 60" strokeLinecap="round" />
    </svg>
  );
}

/** 프리뷰·고스트·실루엣이 정확히 포개지는 자리. 하나라도 어긋나면 정렬 자체가 거짓말이 된다. */
const frameStyle: React.CSSProperties = {
  position: 'relative',
  flex: 1,
  marginTop: 12,
  borderRadius: 14,
  overflow: 'hidden',
  background: '#111',
};

const fillStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

/** 3×3. 선 4개를 그라디언트로 그린다 — 라이브러리도 요소도 안 늘린다. */
const gridStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage:
    'linear-gradient(to right, rgba(255,255,255,0.35) 1px, transparent 1px),' +
    'linear-gradient(to bottom, rgba(255,255,255,0.35) 1px, transparent 1px)',
  backgroundSize: '33.333% 33.333%',
};

const countStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  fontSize: 96,
  fontWeight: 800,
  color: '#fff',
  textShadow: '0 2px 12px rgba(0,0,0,0.6)',
};
