import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";

import { ipAdresiniAl, SAHTE_SIFRE_OZETI } from "@/lib/giris-koruma";

describe("SAHTE_SIFRE_OZETI", () => {
  /**
   * bcryptjs biçimi bozuk bir özeti hesaplama yapmadan reddeder. O zaman
   * kayıtsız e-postalar anında, kayıtlılar ~250 ms'de cevaplanır ve hangi
   * hesabın var olduğu cevap süresinden anlaşılır.
   */
  it("gerçek ölçülere sahip bir bcrypt özetidir", () => {
    expect(SAHTE_SIFRE_OZETI).toHaveLength(60);
    expect(bcrypt.getRounds(SAHTE_SIFRE_OZETI)).toBe(12);
  });

  it("karşılaştırma gerçek bir özetle aynı sürede çalışır", async () => {
    const gercek = await bcrypt.hash("deneme-sifresi-1", 12);

    const sure = async (ozet: string) => {
      const bas = performance.now();
      await bcrypt.compare("yanlis-sifre", ozet);
      return performance.now() - bas;
    };

    const [gercekSure, sahteSure] = [await sure(gercek), await sure(SAHTE_SIFRE_OZETI)];
    // Kesin eşitlik beklenmez; sahte özet anında dönüyorsa oran ~0 olur.
    expect(sahteSure / gercekSure).toBeGreaterThan(0.5);
  });

  it("hiçbir yaygın girdiyle eşleşmez", async () => {
    for (const girdi of ["", "admin", "Otopark2026Admin", "123456"]) {
      expect(await bcrypt.compare(girdi, SAHTE_SIFRE_OZETI)).toBe(false);
    }
  });
});

describe("ipAdresiniAl", () => {
  const baslik = (degerler: Record<string, string>) => new Headers(degerler);

  it("proxy'nin eklediği son değeri alır, istemcinin uydurduğu öndekileri değil", () => {
    expect(ipAdresiniAl(baslik({ "x-forwarded-for": "1.2.3.4, 5.6.7.8, 203.0.113.9" }))).toBe(
      "203.0.113.9",
    );
  });

  it("tek değeri olduğu gibi alır", () => {
    expect(ipAdresiniAl(baslik({ "x-forwarded-for": " 203.0.113.9 " }))).toBe("203.0.113.9");
  });

  it("istemcinin doğrudan gönderebileceği başlıklara güvenmez", () => {
    expect(ipAdresiniAl(baslik({ "x-real-ip": "1.1.1.1", "cf-connecting-ip": "2.2.2.2" }))).toBeNull();
  });

  it("başlık yoksa ya da boşsa null döner", () => {
    expect(ipAdresiniAl(baslik({}))).toBeNull();
    expect(ipAdresiniAl(baslik({ "x-forwarded-for": "" }))).toBeNull();
  });
});
