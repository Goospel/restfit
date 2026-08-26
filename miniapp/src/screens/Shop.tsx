import { useMemo } from 'react';

import { EXERCISES, type EquipKey } from '../data/exercises';
import { EQUIPMENT_KO } from '../data/labels';
import { HAS_ANY_LINK, SHARE_LINKS } from '../data/shareLinks';
import type { EquipSpec } from '../logic/equipSpec';
import { recommend } from '../logic/recommend';
import { ui } from '../ui';

/**
 * 기구 추천. **쉐어링크가 붙는 유일한 자리다.**
 *
 * 설득은 "이거 사세요"가 아니라 **「+96개」라는 숫자**에서 나온다. 그래서 이 화면은
 * 상품을 파는 것처럼 보이지 않아야 한다 — 지금 못 하는 운동이 몇 개 열리는지만 말한다.
 *
 * ⚠️ **운동 중에는 이 화면이 뜨지 않는다.** 세션이 시작되면 탭이 통째로 감춰지기 때문이다
 * (`App.tsx`). 휴식은 쉬라고 있는 시간이지 쇼핑하라고 있는 시간이 아니다.
 */
/** 이보다 낮은 배수는 안 띄운다. 맨몸 사용자의 덤벨(2.7배)처럼 셀 만한 것만 남긴다. */
const MIN_RATIO_TO_SHOW = 1.5;

export function Shop({ owned, spec }: { owned: EquipKey[]; spec: EquipSpec }) {
  const picks = useMemo(() => recommend(EXERCISES, owned, spec), [owned, spec]);

  /** 미니앱 안에서는 `<a href>`가 아니라 SDK를 거쳐야 외부가 열린다. */
  async function open(url: string) {
    try {
      const m = await import('@apps-in-toss/web-framework');
      await m.Device.openURL(url);
    } catch {
      // 토스 앱 밖(브라우저 개발 중)이면 여기로 온다. 화면은 그대로 둔다.
    }
  }

  return (
    <main style={ui.page}>
      <h1 style={ui.h1}>기구 추천</h1>
      <p style={ui.sub}>
        지금 <b>못 하는</b> 운동을 많이 열어주는 것부터 보여드려요. 이미 가진 기구와 별 차이가 없는 것은 넣지 않습니다.
      </p>

      {picks.length === 0 ? (
        <div style={ui.empty}>
          <p>더 권할 기구가 없습니다.</p>
          <p style={{ fontSize: 13 }}>가진 기구로 충분히 할 수 있어요.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {picks.map((p) => {
            const link = SHARE_LINKS[p.key];
            return (
              <div key={p.key} style={ui.card}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ ...ui.h2, fontSize: 17 }}>{EQUIPMENT_KO[p.key]}</span>
                  <span style={ui.spacer} />
                  {/*
                   * 배수는 **셀 만할 때만** 띄운다. 1.1배가 셋씩 늘어서면 정보가 아니라 소음이고,
                   * 「겨우 1.1배」로 읽혀 +18개라는 사실까지 같이 깎아먹는다.
                   */}
                  {p.ratio !== null && p.ratio >= MIN_RATIO_TO_SHOW && (
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue-dark)' }}>
                      {p.ratio.toFixed(1)}배
                    </span>
                  )}
                </div>

                <div style={{ margin: '6px 0 2px' }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--blue)', letterSpacing: -1 }}>
                    +{p.gain}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-sub)' }}>개</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-weak)' }}>
                  지금 {p.before}개 → <b style={{ color: 'var(--text-sub)' }}>{p.after}개</b>
                </div>

                {link && (
                  <button style={{ ...ui.secondary, marginTop: 12 }} onClick={() => open(link)}>
                    토스쇼핑에서 보기
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 대가성 문구는 링크가 실제로 있을 때만. 받지도 않는 대가를 고지하면 그 자체가 거짓이다. */}
      {HAS_ANY_LINK && (
        <p style={{ ...ui.sub, marginTop: 20, marginBottom: 0, fontSize: 12 }}>
          이 링크로 구매하면 앱 운영자가 일정액의 수수료를 받습니다.
        </p>
      )}
    </main>
  );
}
