import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';

import {
  PHOTO_MAX,
  clearPhotos,
  deletePhoto,
  listPhotos,
  openPhotoDb,
  savePhoto,
  type BodyPhoto,
  type PhotoDb,
} from './photoStore';

/**
 * 사진 저장소. **IDB는 jsdom에 없어서 `fake-indexeddb`를 주입해 실제 호출 경로를 태운다** —
 * 트랜잭션·이벤트 루프를 몇 줄로 흉내 내면 그 흉내를 테스트하는 꼴이 된다.
 *
 * 여기서 잠그는 것은 넷이다: **날짜가 키라서 하루 1장이 저절로 된다** · 상한을 넘으면
 * **오래된 것부터** 빠진다 · 깨진 값은 목록에서 조용히 빠진다 · 그리고 `storage.ts`와
 * 정반대로 **저장 실패는 호출자에게 드러난다**(방금 찍은 사진이 소리 없이 증발하면
 * 사용자는 한 달 뒤에야 안다).
 */
describe('photoStore', () => {
  /** 팩토리를 새로 만들면 DB도 새것이다 — 테스트끼리 사진이 새지 않는다. */
  const freshIdb = () => new IDBFactory() as unknown as IDBFactory;

  /** `2025-01-01`부터 i일 뒤. 상한 테스트가 한 달을 넘겨서 문자열 조립으로는 모자란다. */
  const dayKey = (i: number) => new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10);

  const photo = (date: string, over: Partial<BodyPhoto> = {}): BodyPhoto => ({
    date,
    blob: new Blob([date], { type: 'image/jpeg' }),
    capturedAt: 1_700_000_000_000,
    width: 960,
    height: 1280,
    ...over,
  });

  async function open(): Promise<PhotoDb> {
    const db = await openPhotoDb(freshIdb());
    if (!db) throw new Error('테스트 전제가 깨졌다 — fake-indexeddb가 안 열렸다');
    return db;
  }

  describe('openPhotoDb', () => {
    it('IDB가 없는 환경은 null로 끝난다 — 화면이 안내로 빠지는 유일한 신호다', async () => {
      // 던지지 않는다. 프라이빗 모드·구형 웹뷰에서 앱이 죽는 대신 사진 기능만 접힌다.
      await expect(openPhotoDb(undefined)).resolves.toBeNull();
    });

    it('여는 데 실패해도 null이지 예외가 아니다', async () => {
      const broken = { open: () => { throw new DOMException('blocked', 'SecurityError'); } } as unknown as IDBFactory;
      await expect(openPhotoDb(broken)).resolves.toBeNull();
    });
  });

  describe('savePhoto / listPhotos', () => {
    it('저장한 사진을 날짜 오름차순으로 돌려준다 — [0]이 기준 사진이다', async () => {
      const db = await open();

      // 일부러 뒤죽박죽 넣는다. 순서가 넣은 순서가 아니라 날짜순이어야 고스트가 기준을 짚는다.
      expect(await savePhoto(db, photo('2025-03-02'))).toBe(true);
      expect(await savePhoto(db, photo('2025-01-05'))).toBe(true);
      expect(await savePhoto(db, photo('2025-02-01'))).toBe(true);

      expect((await listPhotos(db)).map((p) => p.date)).toEqual(['2025-01-05', '2025-02-01', '2025-03-02']);
    });

    it('Blob과 메타를 그대로 되돌려준다', async () => {
      const db = await open();
      await savePhoto(db, photo('2025-01-05', { capturedAt: 42, width: 720, height: 960 }));

      const [got] = await listPhotos(db);
      expect(got.blob).toBeInstanceOf(Blob);
      expect(await got.blob.text()).toBe('2025-01-05');
      expect(got.blob.type).toBe('image/jpeg');
      expect({ capturedAt: got.capturedAt, width: got.width, height: got.height }).toEqual({
        capturedAt: 42,
        width: 720,
        height: 960,
      });
    });

    it('같은 날 다시 찍으면 교체된다 — 「하루 1장」은 날짜가 키인 것의 결과다', async () => {
      const db = await open();
      await savePhoto(db, photo('2025-01-05', { capturedAt: 1 }));

      expect(await savePhoto(db, photo('2025-01-05', { capturedAt: 2, width: 111 }))).toBe(true);

      const list = await listPhotos(db);
      expect(list).toHaveLength(1);
      // 두 번째 것이 남아야 한다. 첫 장이 이겨 버리면 「다시 찍기」가 아무 일도 안 한 것과 같다.
      expect(list[0].capturedAt).toBe(2);
      expect(list[0].width).toBe(111);
    });

    it('DB가 못 쓰게 되면 빈 목록이다 — 화면은 「사진 없음」으로 돈다', async () => {
      const db = await open();
      await savePhoto(db, photo('2025-01-05'));
      db.close();

      await expect(listPhotos(db)).resolves.toEqual([]);
    });

    it('깨진 값은 목록에서 빠진다 — 어휘 밖 레코드가 화면까지 가지 않는다', async () => {
      const db = await open();
      await savePhoto(db, photo('2025-01-05'));
      // 옛 버전이 남겼거나 손상된 형태. blob이 Blob이 아니면 createObjectURL에서 화면이 죽는다.
      await savePhoto(db, { date: '2025-01-06', blob: 'not-a-blob', capturedAt: 1, width: 1, height: 1 } as unknown as BodyPhoto);
      // 날짜 어휘(YYYY-MM-DD) 밖. 정렬도 비교 화면의 날짜 표시도 이 형태를 전제한다.
      await savePhoto(db, photo('nope' as string));

      expect((await listPhotos(db)).map((p) => p.date)).toEqual(['2025-01-05']);
    });
  });

  describe('상한 프루닝', () => {
    it(`${PHOTO_MAX}장을 넘기면 가장 오래된 것부터 빠진다`, async () => {
      const db = await open();
      for (let i = 0; i < PHOTO_MAX; i++) await savePhoto(db, photo(dayKey(i)));
      expect(await listPhotos(db)).toHaveLength(PHOTO_MAX);

      expect(await savePhoto(db, photo(dayKey(PHOTO_MAX)))).toBe(true);

      const list = await listPhotos(db);
      expect(list).toHaveLength(PHOTO_MAX);
      // 방금 찍은 것이 남고, 맨 앞 하루가 밀려난다. 반대로 자르면 오늘 사진이 증발한다.
      expect(list[0].date).toBe(dayKey(1));
      expect(list[list.length - 1].date).toBe(dayKey(PHOTO_MAX));
    });
  });

  describe('저장 실패는 삼키지 않는다', () => {
    /** 쿼터 초과의 실제 모습 — put 요청이 실패하면서 트랜잭션이 abort된다. */
    function quotaDb(): PhotoDb {
      const store = { put: () => ({}), getAllKeys: () => ({}), delete: () => ({}) };
      const tx = {
        objectStore: () => store,
        oncomplete: null as null | (() => void),
        onerror: null as null | (() => void),
        onabort: null as null | (() => void),
      };
      setTimeout(() => tx.onabort?.(), 0);
      return { transaction: () => tx } as unknown as PhotoDb;
    }

    it('트랜잭션이 abort되면 false다 — 확인 화면이 "저장하지 못했어요"를 띄울 근거', async () => {
      // storage.ts의 write는 실패를 삼키지만 여기서만은 다르다(설계 §5.1의 유일한 이탈).
      await expect(savePhoto(quotaDb(), photo('2025-01-05'))).resolves.toBe(false);
    });

    it('DB가 닫혀 있어도 던지지 않고 false다', async () => {
      const db = await open();
      db.close();

      await expect(savePhoto(db, photo('2025-01-05'))).resolves.toBe(false);
    });
  });

  describe('deletePhoto / clearPhotos', () => {
    it('한 장만 지운다 — 나머지 날짜는 남는다', async () => {
      const db = await open();
      await savePhoto(db, photo('2025-01-05'));
      await savePhoto(db, photo('2025-01-06'));

      await deletePhoto(db, '2025-01-05');

      expect((await listPhotos(db)).map((p) => p.date)).toEqual(['2025-01-06']);
    });

    it('전체 삭제는 비운다 — 프라이버시 기능이라 v1에서 뺄 수 없다', async () => {
      const db = await open();
      await savePhoto(db, photo('2025-01-05'));
      await savePhoto(db, photo('2025-01-06'));

      await clearPhotos(db);

      expect(await listPhotos(db)).toEqual([]);
    });

    it('DB가 닫혀 있어도 던지지 않는다', async () => {
      const db = await open();
      db.close();

      await expect(deletePhoto(db, '2025-01-05')).resolves.toBeUndefined();
      await expect(clearPhotos(db)).resolves.toBeUndefined();
    });
  });
});
