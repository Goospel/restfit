import { AVOID_KEYS, AVOID_LABEL, type AvoidArea } from '../logic/profile';
import { specChipStyle, ui } from '../ui';

/**
 * 불편한 부위 선택. 온보딩 2단계와 설정 화면이 **같은 컴포넌트**를 쓴다.
 *
 * 특히 **아래 두 줄이 갈라지면 안 된다.** 한쪽에만 면책이 붙으면 다른 쪽은 치료 효능을
 * 주장하는 화면이 된다 — 심사와 안전이 함께 걸린 문구라 출처를 하나로 묶었다.
 *
 * 「없음」이 1급 선택지인 이유: 대부분은 아픈 데가 없다. 아무것도 안 고른 상태와
 * 「없음을 골랐다」가 값으로는 같지만(`[]`), 눌러서 끌 자리가 없으면 **한 번 고른 부위를
 * 되돌릴 방법이 없다**고 느낀다.
 */
export function AvoidPicker({
  value,
  onChange,
  disabled,
}: {
  value: AvoidArea[];
  onChange: (next: AvoidArea[]) => void;
  disabled?: boolean;
}) {
  // ⚠️ 잠긴 동안에는 「없음」도 켜지 않는다. 값이 빈 배열이라 켜는 게 자연스러워 보이지만,
  // 아직 **고르지도 않은 답**이 이미 골라진 것처럼 읽힌다 — 잠금은 「값이 없다」는 뜻이지
  // 「없음을 골랐다」가 아니다.
  const none = !disabled && value.length === 0;

  function toggle(k: AvoidArea) {
    // 어휘 순서로 다시 만든다 — 누른 순서대로 담으면 같은 조합이 저장소에 여러 모양으로
    // 남아, 나중에 저장값을 눈으로 대조할 때 다른 설정처럼 보인다.
    onChange(value.includes(k) ? value.filter((x) => x !== k) : AVOID_KEYS.filter((a) => a === k || value.includes(a)));
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button style={specChipStyle(none, disabled)} aria-pressed={none} disabled={disabled} onClick={() => onChange([])}>
          없음
        </button>
        {AVOID_KEYS.map((k) => {
          const on = value.includes(k);
          return (
            <button
              key={k}
              style={specChipStyle(on, disabled)}
              aria-pressed={on}
              disabled={disabled}
              onClick={() => toggle(k)}
            >
              {AVOID_LABEL[k]}
            </button>
          );
        })}
      </div>
      <p style={{ ...ui.sub, fontSize: 12, margin: '8px 2px 0' }}>불편한 부위를 많이 쓰는 운동을 뺍니다.</p>
      <p style={{ ...ui.sub, fontSize: 12, margin: '2px 2px 0' }}>통증이 있다면 전문가와 상담해 주세요.</p>
    </div>
  );
}
