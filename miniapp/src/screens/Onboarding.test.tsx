// @vitest-environment jsdom
// ⚠️ jsdom을 전역(`vite.config.ts`)으로 켜면 안 된다 — `import.meta.url`이 `file:`이 아니게 되어
// 문서 대조 테스트(shareLinks)가 파일을 못 읽고 통째로 죽는다. 화면 테스트에서만 켠다.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Onboarding } from './Onboarding';

afterEach(cleanup);

/** 기구·목적은 이 테스트의 관심사가 아니다 — 새로 낀 2단계와 단계 이동만 본다. */
function setup() {
  const onDone = vi.fn();
  const { container } = render(
    <Onboarding owned={[]} spec={{}} onOwnedChange={() => {}} onSpecChange={() => {}} onDone={onDone} />,
  );
  return { onDone, container };
}

const btn = (name: string | RegExp) => screen.getByRole('button', { name }) as HTMLButtonElement;
const click = (name: string | RegExp) => fireEvent.click(btn(name));
const title = () => screen.getByRole('heading').textContent;
const pressed = (name: string) => btn(name).getAttribute('aria-pressed');

describe('온보딩 3단계', () => {
  it('기구 → 경험·몸 상태 → 목적 순으로 넘어간다', () => {
    // 새 단계가 목적 **앞**에 와야 한다. 목적 뒤에 두면 「오늘의 루틴 보기」를 누른 뒤에도
    // 화면이 하나 더 남아 온보딩이 안 끝난 것처럼 보인다.
    setup();
    expect(title()).toBe('집에 어떤 기구가 있나요?');
    click('다음');
    expect(title()).toBe('요즘 몸 상태는 어떤가요?');
    click('아니요');
    click('다음');
    expect(title()).toBe('어떤 목적으로 운동하세요?');
  });

  it('진행바가 3칸이다', () => {
    // 2칸으로 남으면 두 번째 화면에서 이미 끝난 것처럼 보여 목적 단계가 기습이 된다.
    const { container } = setup();
    expect(container.querySelectorAll('[data-progress-step]')).toHaveLength(3);
  });

  it('뒤로 가면 앞 단계로 돌아간다', () => {
    setup();
    click('다음');
    click('아니요');
    click('다음');
    click('뒤로');
    expect(title()).toBe('요즘 몸 상태는 어떤가요?');
    click('뒤로');
    expect(title()).toBe('집에 어떤 기구가 있나요?');
  });

  it('뒤로 갔다 와도 고른 답이 남아 있다', () => {
    // 3단계로 길어진 만큼 되돌아오는 일이 잦아진다. 답이 초기화되면 다시 고르라는 뜻이고,
    // 온보딩 이탈은 그대로 손실이다.
    setup();
    click('다음');
    click('예');
    click('무릎');
    click('다음');
    click('뒤로');
    expect(pressed('예')).toBe('true');
    expect(pressed('무릎')).toBe('true');
  });

  it('경험을 안 고르면 다음으로 못 간다', () => {
    // 경험은 필수다 — 안 받으면 개인화의 유일한 공인 축이 비어 이 단계 자체가 무의미해진다.
    setup();
    click('다음');
    expect(btn('다음').disabled).toBe(true);
    click('다음');
    expect(title()).toBe('요즘 몸 상태는 어떤가요?');
    click('아니요');
    expect(btn('다음').disabled).toBe(false);
  });

  it('불편 부위는 「없음」이 기본이고, 필수가 아니다', () => {
    // 대부분은 아픈 데가 없다. 기본이 비어 있지 않으면 멀쩡한 사람이 운동을 잃는다.
    setup();
    click('다음');
    expect(pressed('없음')).toBe('true');
    click('아니요');
    click('다음');
    expect(title()).toBe('어떤 목적으로 운동하세요?');
  });

  it('부위를 고르면 「없음」이 꺼지고, 「없음」을 누르면 전부 지워진다', () => {
    setup();
    click('다음');
    click('무릎');
    click('허리');
    expect(pressed('없음')).toBe('false');
    click('없음');
    expect(pressed('무릎')).toBe('false');
    expect(pressed('허리')).toBe('false');
    expect(pressed('없음')).toBe('true');
  });

  it('부위는 누른 순서가 아니라 어휘 순서로 저장된다', () => {
    // 같은 조합이 저장소에 여러 모양(`['lowerBack','knee']` / `['knee','lowerBack']`)으로
    // 남으면, 나중에 저장값을 눈으로 대조할 때 **다른 설정처럼 보인다.**
    // ⚠️ 순서를 뒤집어 눌러야 잡힌다 — 어휘 순서대로 누르면 그냥 이어 붙여도 답이 같아
    // 테스트가 공허해진다(`[...value, k]`로 바꿔도 통과했다).
    const { onDone } = setup();
    click('다음');
    click('아니요');
    click('허리');
    click('무릎');
    click('다음');
    click(/건강 유지/);
    click('오늘의 루틴 보기');
    expect(onDone).toHaveBeenCalledWith('health', { experience: 'beginner', avoid: ['knee', 'lowerBack'] });
  });

  it('치료 효능을 주장하지 않고, 전문가 상담을 안내한다', () => {
    // 심사·안전 양쪽이 걸린 문구다. 「낫게 해 준다」로 읽히면 의료 주장이 된다.
    setup();
    click('다음');
    expect(screen.getByText('불편한 부위를 많이 쓰는 운동을 뺍니다.')).toBeTruthy();
    expect(screen.getByText('통증이 있다면 전문가와 상담해 주세요.')).toBeTruthy();
  });

  it('완료하면 목적과 프로필을 함께 넘긴다', () => {
    // 「예」는 중급이다 — 상급은 질문으로 도달할 수 없고 승급으로만 닿는다.
    const { onDone } = setup();
    click('다음');
    click('예');
    click('어깨');
    click('다음');
    click(/근육 키우기/);
    click('오늘의 루틴 보기');
    expect(onDone).toHaveBeenCalledWith('muscle', { experience: 'intermediate', avoid: ['shoulder'] });
  });

  it('「아니요」는 초급이다', () => {
    const { onDone } = setup();
    click('다음');
    click('아니요');
    click('다음');
    click(/건강 유지/);
    click('오늘의 루틴 보기');
    expect(onDone).toHaveBeenCalledWith('health', { experience: 'beginner', avoid: [] });
  });
});
