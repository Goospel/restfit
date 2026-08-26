import { useMemo, useState } from 'react';

import { EXERCISES, type EquipKey } from '../data/exercises';
import { EQUIPMENT_KO } from '../data/labels';
import { DISCLOSURE, HAS_ANY_LINK, SHARE_LINKS } from '../data/shareLinks';
import type { EquipSpec } from '../logic/equipSpec';
import { recommend } from '../logic/recommend';
import { ui } from '../ui';

/**
 * 기구 추천. **쉐어링크가 붙는 유일한 자리다.**
 *
 * **2단이다.** 1단은 「몇 개가 열리는지」, 2단은 「무엇을 사면 되는지」.
 * 상품을 곧바로 늘어놓으면 「+96개」가 상품 사이에 묻혀 **사야 하는 이유를 잃는다** —
 * 숫자로 이유를 먼저 말하고, 그다음에 살 것을 보여준다.
 *
 * ⚠️ **운동 중에는 이 화면이 뜨지 않는다.** 세션이 시작되면 탭이 통째로 감춰지기 때문이다
 * (`App.tsx`). 휴식은 쉬라고 있는 시간이지 쇼핑하라고 있는 시간이 아니다.
 *
 * ⚠️ 링크는 **외부 브라우저로 열린다.** 미니앱 안에 토스쇼핑을 띄우는 SDK·딥링크가
 * 플랫폼에 없다(앱인토스 개발자 커뮤니티 공식 답변). 우리 구현의 한계가 아니다.
 */
export function Shop({ owned, spec }: { owned: EquipKey[]; spec: EquipSpec }) {
  const picks = useMemo(() => recommend(EXERCISES, owned, spec), [owned, spec]);
  /** 펼쳐진 기구. 하나만 열어 둔다 — 다 열면 다시 「쫘라락」이 되어 2단으로 나눈 뜻이 없다. */
  const [expanded, setExpanded] = useState<EquipKey | null>(null);

  /** 미니앱 안에서는 `<a href>`가 아니라 SDK를 거쳐야 외부가 열린다. */
  async function openUrl(url: string) {
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
            const products = SHARE_LINKS[p.key] ?? [];
            const isOpen = expanded === p.key;
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

                {products.length > 0 && (
                  <>
                    <button
                      style={{ ...ui.secondary, marginTop: 12 }}
                      onClick={() => setExpanded(isOpen ? null : p.key)}
                      aria-expanded={isOpen}
                    >
                      상품 {products.length}개 {isOpen ? '▴' : '▾'}
                    </button>

                    {isOpen && (
                      <ul style={S.list}>
                        {products.map((prod) => (
                          <li key={prod.url}>
                            <button style={S.item} onClick={() => openUrl(prod.url)}>
                              <span style={{ minWidth: 0 }}>
                                <span style={S.name}>{prod.name}</span>
                                {prod.note && <span style={S.note}>{prod.note}</span>}
                              </span>
                              <span style={S.arrow}>›</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/*
       * 대가성 문구는 링크가 실제로 있을 때만. 받지도 않는 대가를 고지하면 그 자체가 거짓이다.
       * ⚠️ 문구는 **토스가 지정한 문장을 글자 그대로** 쓴다 — 뜻이 같아도 내가 지은 문장은 규정 위반이다.
       */}
      {HAS_ANY_LINK && <p style={{ ...ui.sub, marginTop: 20, marginBottom: 0, fontSize: 12 }}>{DISCLOSURE}</p>}
    </main>
  );
}

/** 이보다 낮은 배수는 안 띄운다. 맨몸 사용자의 덤벨(2.7배)처럼 셀 만한 것만 남긴다. */
const MIN_RATIO_TO_SHOW = 1.5;

const S: Record<string, React.CSSProperties> = {
  list: { listStyle: 'none', margin: '4px 0 0', padding: 0 },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '12px 2px',
    textAlign: 'left',
    background: 'none',
    border: 0,
    borderTop: '1px solid var(--line)',
  },
  name: { display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)' },
  note: { display: 'block', fontSize: 12, color: 'var(--text-weak)', marginTop: 2 },
  arrow: { marginLeft: 'auto', fontSize: 20, color: 'var(--text-weak)', lineHeight: 1 },
};
