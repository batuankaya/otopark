/**
 * Brute force koruması.
 *
 * Başarısız giriş denemeleri hem HESAP hem IP bazlı sayılır:
 *  - Hesap bazlı: saldırgan tek hesaba yükleniyorsa o hesap kilitlenir
 *  - IP bazlı: saldırgan çok sayıda hesabı deniyorsa (kullanıcı adı taraması)
 *    o kaynak kilitlenir
 *
 * Kilit kalıcı DEĞİL, zaman aşımına uğrar: gerçek görevli şifresini üst üste
 * yanlış girip kendini sistem dışında bırakmasın. Sahada çalışan bir otoparkta
 * kalıcı kilit, saldırıdan daha çok zarar verir.
 *
 * Sayım veritabanından yapılır (bellek değil): uygulama yeniden başlasa da
 * kilit sürer ve birden fazla sunucu çalışsa bile ortak davranır.
 */

import { prisma } from "./prisma";

/** Hesap bazlı: bu kadar başarısız denemeden sonra kilit. */
export const HESAP_DENEME_SINIRI = 8;
/** IP bazlı: farklı hesaplara yayılan denemeler için daha yüksek eşik. */
export const IP_DENEME_SINIRI = 20;
/** Denemelerin sayıldığı pencere (dakika). */
export const PENCERE_DAKIKA = 15;
/** Kilit süresi (dakika). */
export const KILIT_DAKIKA = 15;
/** Bu süreden eski kayıtlar budanır (gün). */
const SAKLAMA_GUN = 7;

export type KorumaSonucu =
  | { engelli: false }
  | { engelli: true; kalanSaniye: number; sebep: "hesap" | "ip" };

/** İstek başlıklarından istemci IP'sini çıkarır (ters proxy uyumlu). */
export function ipAdresiniAl(basliklar: Headers): string | null {
  // Vercel/Cloudflare/nginx sırasıyla bu başlıkları kullanır.
  const forwarded = basliklar.get("x-forwarded-for");
  if (forwarded) {
    // İlk değer gerçek istemcidir; sonrakiler proxy zinciri.
    const ilk = forwarded.split(",")[0]?.trim();
    if (ilk) return ilk;
  }
  return basliklar.get("x-real-ip") ?? basliklar.get("cf-connecting-ip") ?? null;
}

/**
 * Giriş denemesine izin var mı?
 *
 * Şifre kontrolünden ÖNCE çağrılır: kilitliyken bcrypt çalıştırmak hem
 * gereksiz yük hem de saldırgana zaman bilgisi verir.
 */
export async function girisIzniVarMi(
  email: string,
  ip: string | null,
): Promise<KorumaSonucu> {
  const pencereBaslangici = new Date(Date.now() - PENCERE_DAKIKA * 60_000);

  const [hesapDenemeleri, ipDenemeleri] = await Promise.all([
    prisma.girisDenemesi.findMany({
      where: { email, zaman: { gte: pencereBaslangici } },
      orderBy: { zaman: "desc" },
      select: { zaman: true },
    }),
    ip
      ? prisma.girisDenemesi.findMany({
          where: { ip, zaman: { gte: pencereBaslangici } },
          orderBy: { zaman: "desc" },
          select: { zaman: true },
        })
      : Promise.resolve([]),
  ]);

  // Kilit, SON denemeden itibaren başlar: saldırgan denemeye devam ettikçe
  // süre yenilenir, bekleyip tekrar saldıramaz.
  const kalan = (denemeler: { zaman: Date }[]) => {
    const sonDeneme = denemeler[0]?.zaman;
    if (!sonDeneme) return 0;
    const bitis = sonDeneme.getTime() + KILIT_DAKIKA * 60_000;
    return Math.max(0, Math.ceil((bitis - Date.now()) / 1000));
  };

  if (hesapDenemeleri.length >= HESAP_DENEME_SINIRI) {
    const kalanSaniye = kalan(hesapDenemeleri);
    if (kalanSaniye > 0) return { engelli: true, kalanSaniye, sebep: "hesap" };
  }

  if (ipDenemeleri.length >= IP_DENEME_SINIRI) {
    const kalanSaniye = kalan(ipDenemeleri);
    if (kalanSaniye > 0) return { engelli: true, kalanSaniye, sebep: "ip" };
  }

  return { engelli: false };
}

/** Başarısız denemeyi kaydeder. */
export async function basarisizDenemeyiKaydet(
  email: string,
  ip: string | null,
): Promise<void> {
  try {
    await prisma.girisDenemesi.create({ data: { email, ip } });

    // Eski kayıtları buda — ayrı bir zamanlanmış göreve ihtiyaç kalmasın.
    // Her denemede değil, ~%5 olasılıkla çalıştırılır (gereksiz yük olmasın).
    if (Math.random() < 0.05) {
      await prisma.girisDenemesi.deleteMany({
        where: { zaman: { lt: new Date(Date.now() - SAKLAMA_GUN * 86_400_000) } },
      });
    }
  } catch (hata) {
    // Koruma kaydı yazılamazsa giriş akışı durmamalı.
    console.error("Giriş denemesi kaydedilemedi:", hata);
  }
}

/** Başarılı girişte hesabın deneme sayacını sıfırlar. */
export async function denemeleriTemizle(email: string): Promise<void> {
  try {
    await prisma.girisDenemesi.deleteMany({ where: { email } });
  } catch (hata) {
    console.error("Giriş denemeleri temizlenemedi:", hata);
  }
}

/** Kalan süreyi kullanıcıya gösterilecek metne çevirir. */
export function beklemeMetni(kalanSaniye: number): string {
  const dakika = Math.ceil(kalanSaniye / 60);
  return dakika <= 1 ? "1 dakika" : `${dakika} dakika`;
}
