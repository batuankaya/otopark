import { beforeEach, describe, expect, it } from "vitest";

import {
  denemeyiBaslat,
  denemeyiGeriAl,
  girisIzniVarMi,
  HESAP_DENEME_SINIRI,
} from "@/lib/giris-koruma";
import { prisma } from "@/lib/prisma";

import { veritabaniniTemizle } from "./yardimcilar";

/**
 * Giriş callback'inin koruma adımları: denemeyi kaydet, kendisi hariç say,
 * kilitliyse kaydı geri al. Şifre kontrolü (bcrypt) bu adımlardan sonra
 * gelir; burada yalnızca kaç isteğin ona ulaşabildiği sınanır.
 */
async function korumadanGecerMi(email: string, ip: string): Promise<boolean> {
  const id = await denemeyiBaslat(email, ip);
  const izin = await girisIzniVarMi(email, ip, id);
  if (izin.engelli) {
    await denemeyiGeriAl(id);
    return false;
  }
  return true;
}

describe("giriş koruması", () => {
  beforeEach(async () => {
    await veritabaniniTemizle();
  });

  it("sınır kadar ardışık deneme geçer, sonrakiler engellenir", async () => {
    const sonuclar: boolean[] = [];
    for (let i = 0; i < HESAP_DENEME_SINIRI + 3; i++) {
      sonuclar.push(await korumadanGecerMi("hedef@ornek.com", `10.0.0.${i}`));
    }
    expect(sonuclar.filter(Boolean)).toHaveLength(HESAP_DENEME_SINIRI);
    expect(sonuclar.slice(HESAP_DENEME_SINIRI).every((gecti) => !gecti)).toBe(true);
  });

  it("aynı anda gönderilen istekler sınırı aşamaz", async () => {
    const sonuclar = await Promise.all(
      Array.from({ length: 60 }, (_, i) => korumadanGecerMi("hedef@ornek.com", `10.0.1.${i}`)),
    );
    expect(sonuclar.filter(Boolean).length).toBeLessThanOrEqual(HESAP_DENEME_SINIRI);
  });

  it("kilitliyken gelen istek kayıt bırakmaz", async () => {
    for (let i = 0; i < HESAP_DENEME_SINIRI + 5; i++) {
      await korumadanGecerMi("hedef@ornek.com", `10.0.2.${i}`);
    }
    expect(await prisma.girisDenemesi.count()).toBe(HESAP_DENEME_SINIRI);
  });
});
