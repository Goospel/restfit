import { useMemo, useState } from 'react';

import { EXERCISES, type EquipKey } from '../data/exercises';
import { EQUIPMENT_KO } from '../data/labels';
import {
  BAND_KO,
  DISCLOSURE,
  filterByBand,
  HAS_ANY_LINK,
  productBadge,
  productBands,
  RETURN_NOTICE,
  SHARE_LINKS,
  type Product,
  type ProductBand,
} from '../data/shareLinks';
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
export function Shop({
  owned,
  spec,
  onEditEquipment,
}: {
  owned: EquipKey[];
  spec: EquipSpec;
  onEditEquipment: () => void;
}) {
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

      {/*
       * 내 보유 기구. **추천보다 위**에 둔다 — 아래 목록이 무엇을 기준으로 뽑혔는지가
       * 이 한 줄이고, 기구를 바꾸는 유일한 입구이기도 하다.
       *
       * 추천이 소진돼 빈 상태여도 이 카드는 남는다. 기구를 **줄이는** 정리도 여기로 한다.
       */}
      <div style={{ ...ui.card, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, padding: 14 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>
            {owned.length > 0 ? `내 보유 기구 ${owned.length}개` : '내 보유 기구 없음'}
          </div>
          {/*
           * 이름은 **한 줄 말줄임**이다. 정확한 개수는 윗줄의 n이 이미 말하므로,
           * 이름이 잘려도 사라지는 정보가 없다 — 줄바꿈을 허용하면 카드 높이가 기구 수에
           * 따라 널뛰어 추천 목록이 화면 밖으로 밀린다.
           *
           * 기구가 없으면 「0개」 대신 지금 무엇으로 돌고 있는지를 말한다 — 0은 고장으로 읽힌다.
           */}
          <div
            style={{
              marginTop: 3,
              fontSize: 13,
              color: 'var(--text-sub)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {owned.length > 0
              ? owned.map((k) => EQUIPMENT_KO[k]).join(' · ')
              : '맨몸 운동만으로 루틴을 만들고 있어요'}
          </div>
        </div>
        <span style={ui.spacer} />
        <button
          // `ui.chip`은 원래 **누르지 않는 라벨**이라 세로 여백이 얇다. 버튼으로 쓰니 손가락 몫을 더한다.
          style={{ ...ui.chip, flexShrink: 0, padding: '9px 12px', fontSize: 13 }}
          onClick={onEditEquipment}
        >
          바꾸기
        </button>
      </div>

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

                    {/*
                      `key`가 기구다 — 다른 기구를 펼치면 컴포넌트가 새로 마운트되어
                      **필터가 저절로 초기화된다.** 리셋을 손으로 부르는 코드가 필요 없다.
                    */}
                    {isOpen && <ProductList key={p.key} products={products} onOpen={openUrl} />}
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

/**
 * 펼쳐진 상품 목록. **무게 구간 칩으로 좁힌다.**
 *
 * 목록을 짧게 유지하려고 우리가 미리 3~5개만 골라 두면, 고르는 일을 대신해 버리는 꼴이라
 * 「내 무게에 맞는 게 없는」 사람이 생긴다. 많이 담고 **거를 수단을 주는 쪽**이 낫다.
 *
 * 칩은 **구간이 둘 이상일 때만** 뜬다 — 하나뿐이면 「전체」와 결과가 같아서 누를 이유가 없다.
 */
function ProductList({
  products,
  onOpen,
}: {
  products: readonly Product[];
  onOpen: (url: string) => void;
}) {
  const [band, setBand] = useState<ProductBand | null>(null);
  const bands = productBands(products);
  const shown = filterByBand(products, band);

  return (
    <>
      {bands.length > 1 && (
        <div style={S.chips}>
          {/* 「전체」에는 개수를 안 붙인다 — 바로 위 「상품 N개」가 이미 같은 수를 말한다. */}
          <Chip label="전체" active={band === null} onClick={() => setBand(null)} />
          {bands.map((b) => (
            <Chip
              key={b.band}
              label={BAND_KO[b.band]}
              count={b.count}
              active={band === b.band}
              onClick={() => setBand(b.band)}
            />
          ))}
        </div>
      )}

      {/*
        ⚠️ **누르기 전에** 읽혀야 하는 안내라 목록 위에 둔다 — 아래에 두면 스크롤해야 보이고,
        그때는 이미 눌러 나간 뒤다. 자세한 사정은 `RETURN_NOTICE` 주석.
      */}
      <p style={S.notice}>{RETURN_NOTICE}</p>

      <ul style={S.list}>
        {shown.map((prod) => (
          <li key={prod.url}>
            <button style={S.item} onClick={() => onOpen(prod.url)}>
              {/*
                배지가 없어도 자리는 남긴다 — 지우면 그 줄만 이름이 왼쪽으로 튀어나와,
                무게순으로 세워 둔 정렬이 그 한 줄 때문에 흐트러진다.
              */}
              <span style={S.badge}>{productBadge(prod)}</span>
              <span style={{ minWidth: 0 }}>
                <span style={S.name}>{prod.name}</span>
                {prod.note && <span style={S.note}>{prod.note}</span>}
              </span>
              <span style={S.arrow}>›</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * 개수를 라벨에 붙인다 — **눌러 보기 전에 얼마나 좁혀지는지 알아야** 누를지 정한다.
 *
 * 선택은 색만으로 알리지 않는다(`aria-pressed` + 배경 + 테두리) — 색을 구분하기 어려운 사람에게
 * 색 하나는 정보가 아니다. 기구 선택 화면에서 같은 이유로 체크 표시를 붙였다.
 *
 * ⚠️ 선택 배경은 `--blue`가 아니라 **`--blue-dark`** 다. 12px 글씨는 WCAG AA가 4.5:1을 요구하는데
 * `--blue`(#3182f6) 위의 흰 글씨는 **3.71:1로 미달**이고 `--blue-dark`(#1b64da)는 5.41:1이다(실측).
 */
function Chip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      style={{
        ...ui.chip,
        // `ui.chip`은 원래 **누르지 않는 라벨**이라 세로 여백이 얇다. 버튼으로 쓰는 여기서는 손가락 몫을 더한다.
        padding: '9px 12px',
        ...(active
          ? { background: 'var(--blue-dark)', borderColor: 'var(--blue-dark)', color: '#fff' }
          : null),
      }}
      onClick={onClick}
      aria-pressed={active}
    >
      {label}
      {count !== undefined && ` ${count}`}
    </button>
  );
}

/** 이보다 낮은 배수는 안 띄운다. 맨몸 사용자의 덤벨(2.7배)처럼 셀 만한 것만 남긴다. */
const MIN_RATIO_TO_SHOW = 1.5;

const S: Record<string, React.CSSProperties> = {
  // 칩이 화면 폭을 넘으면 접힌다 — 가로 스크롤은 옆으로 흐르는 것이 있다는 사실 자체가 안 보인다.
  chips: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  /**
   * 경고가 아니라 **길 안내**다 — 빨간색·아이콘을 붙이면 「위험한 링크」로 읽혀 누르기를 망설이게 된다.
   * 색은 본문 계열로 두고, 배경 한 겹으로 목록과 구분만 한다.
   *
   * ⚠️ 배경은 `--bg-sub`가 아니라 **`--bg`(흰색)** 다. 이 안내가 앉는 카드가 이미 `--bg-sub`라
   * 같은 색을 주면 경계가 사라져 그냥 본문으로 읽힌다.
   */
  notice: {
    margin: '10px 0 0',
    padding: '8px 10px',
    borderRadius: 8,
    background: 'var(--bg)',
    fontSize: 12,
    lineHeight: 1.5,
    color: 'var(--text-sub)',
  },
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
  /**
   * 무게 배지. **오른쪽 정렬 + `tabular-nums`** 라야 자릿수가 달라도(4kg·10kg·22.6kg)
   * `kg`이 세로로 맞아떨어져 목록이 무게순이라는 게 눈에 들어온다.
   * 폭은 가장 긴 값(`22.6kg`)에 맞춘 고정값이다 — 내용에 따라 늘면 정렬이 무너진다.
   */
  badge: {
    width: 52,
    flexShrink: 0,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--text-sub)',
    fontVariantNumeric: 'tabular-nums',
  },
  name: { display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)' },
  note: { display: 'block', fontSize: 12, color: 'var(--text-weak)', marginTop: 2 },
  arrow: { marginLeft: 'auto', fontSize: 20, color: 'var(--text-weak)', lineHeight: 1 },
};
