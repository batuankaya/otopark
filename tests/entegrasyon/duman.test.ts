import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { acikVardiyayiBul } from "@/lib/yetki";
import { vardiyaAc } from "@/actions/vardiya";

import {
  BOS_DURUM,
  form,
  oturumAc,
  saatiAyarla,
  temelVeriyiKur,
  veritabaniniTemizle,
  zamaniDondur,
  zamaniSerbestBirak,
} from "./yardimcilar";

/**
 * Altyapı duman testi: veritabanı bağlantısı, sahte zaman ve taklit edilen
 * oturum birlikte çalışıyor mu? Bozulursa diğer tüm entegrasyon testleri
 * anlamsız hata verir; sebebi burada net görünür.
 */
describe("entegrasyon altyapısı", () => {
  beforeEach(async () => {
    zamaniDondur();
    saatiAyarla("08:00");
    await veritabaniniTemizle();
  });

  afterEach(() => zamaniSerbestBirak());

  it("test veritabanına bağlanır", async () => {
    const [{ current_database }] = await prisma.$queryRaw<Array<{ current_database: string }>>`
      SELECT current_database()
    `;
    expect(current_database).toBe("otopark_test");
  });

  it("sahte zaman açıkken veritabanı çağrıları çalışır", async () => {
    // Asıl risk: setTimeout taklit edilirse Prisma'nın ağ katmanı asla
    // tamamlanmaz. toFake: ["Date"] bunu önlüyor — kanıtı bu test.
    const temel = await temelVeriyiKur();
    expect(temel.tarife.ad).toBe("Standart");
    expect(new Date().toISOString()).toBe("2026-07-15T05:00:00.000Z");
  });

  it("oturum taklidi gerçek yetki doğrulamasından geçer", async () => {
    const temel = await temelVeriyiKur();
    oturumAc(temel.gorevli.id);

    const sonuc = await vardiyaAc(BOS_DURUM, form({ acilisKasa: "500" }));

    expect(sonuc.hata).toBeUndefined();
    expect(sonuc.basarili).toBe(true);

    const acik = await acikVardiyayiBul();
    expect(acik?.kullaniciId).toBe(temel.gorevli.id);
  });

  it("her testte tablolar boşalır", async () => {
    const sayim = await prisma.vardiya.count();
    expect(sayim).toBe(0);
  });
});
