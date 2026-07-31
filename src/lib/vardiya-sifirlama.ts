/**
 * Günlük otomatik vardiya sıfırlaması.
 *
 * Vardiya her gün belirlenen saatte (varsayılan 12:00) kendiliğinden kapanır
 * ve yerine yenisi açılır. Böylece kasa ve rapor "vardiya günü" bazında
 * ayrışır; görevlinin akşam vardiya kapatmayı unutması hâlinde bir sonraki
 * günün tahsilatı öncekinin kasasına karışmaz.
 *
 * Ayrı bir zamanlanmış göreve (cron) BİLEREK bağlanmadı: uygulama sürekli
 * ayakta olmayabilir ve makine kapalıyken çalışmayan bir cron, sıfırlamayı
 * sessizce atlar. Bunun yerine sıfırlama "tembel" (lazy) yapılır — açık
 * vardiya sorgulandığı her an, sınırın geçip geçmediğine bakılır. Uygulama
 * üç gün kapalı kalsa bile ilk açılışta eski vardiya doğru anda (geçmişteki
 * sınır saatinde) kapatılmış olur.
 */

import { Prisma } from "@prisma/client";

import { islemGunluguYazTx } from "./gunluk";
import { prisma } from "./prisma";
import { formatlaTarihSaat, vardiyaGunBaslangici } from "./tarih";
import { vardiyaOzetiHesapla } from "./vardiya-ozet";

/**
 * Ayar okunamazsa kullanılan sıfırlama saati — gece yarısı.
 *
 * Çalışma saatlerinin (08:00–20:30) dışında olmak zorunda: aksi hâlde vardiya
 * gün ortasında kapanır ve tek bir iş günü iki kasa defterine bölünür.
 */
export const VARSAYILAN_SIFIRLAMA_SAATI = 0;

/**
 * Sıfırlama saati ayarı — kısa süreli işlem içi önbellekle.
 *
 * Bu değer açık vardiya sorgulanan HER istekte okunuyor; ayarlar ekranından
 * yılda bir değişen bir alan için her seferinde veritabanına gitmek gereksiz.
 */
let onbellek: { deger: number; zaman: number } | null = null;
const ONBELLEK_OMRU_MS = 60_000;

export async function sifirlamaSaatiniAl(): Promise<number> {
  if (onbellek && Date.now() - onbellek.zaman < ONBELLEK_OMRU_MS) return onbellek.deger;

  try {
    const ayar = await prisma.ayar.findUnique({
      where: { id: 1 },
      select: { vardiyaSifirlamaSaati: true },
    });
    const deger = ayar?.vardiyaSifirlamaSaati ?? VARSAYILAN_SIFIRLAMA_SAATI;
    onbellek = { deger, zaman: Date.now() };
    return deger;
  } catch {
    // Ayar okunamazsa sıfırlama tamamen durmasın.
    return onbellek?.deger ?? VARSAYILAN_SIFIRLAMA_SAATI;
  }
}

/** Ayarlar kaydedildiğinde çağrılır — yeni saat anında yürürlüğe girsin. */
export function sifirlamaOnbelleginiTemizle(): void {
  onbellek = null;
}

/**
 * Sınırı geçmiş açık vardiya varsa kapatır ve yerine yenisini açar.
 *
 * Kasa devri kesintisiz olsun diye yeni vardiyanın açılış kasası, kapanan
 * vardiyanın "kasada olması gereken" tutarıdır: para fiziksel olarak kasada
 * durmaya devam ediyor, yalnızca defter yeni sayfaya geçiyor.
 *
 * Kapanışta kasa SAYILMAZ — ortada sayacak kimse yok. `kapanisKasa` ve
 * `fark` boş bırakılır ki uydurma bir "kasa açığı" raporlanmasın.
 */
export async function vardiyaSifirlamasiniUygula(): Promise<void> {
  try {
    const acik = await prisma.vardiya.findFirst({
      where: { bitis: null },
      orderBy: { baslangic: "desc" },
      select: { id: true, kullaniciId: true, baslangic: true, notlar: true },
    });
    if (!acik) return;

    const saat = await sifirlamaSaatiniAl();
    const sinir = vardiyaGunBaslangici(saat);

    // Vardiya yürürlükteki gün içinde açılmışsa yapacak bir şey yok.
    if (acik.baslangic.getTime() >= sinir.getTime()) return;

    const ozet = await vardiyaOzetiHesapla(acik.id);
    const devredenKasa = new Prisma.Decimal(ozet.beklenenKasa);
    const sinirMetni = formatlaTarihSaat(sinir);

    await prisma.$transaction(async (tx) => {
      // Koşullu güncelleme: bu arada biri vardiyayı elle kapattıysa
      // count 0 döner ve tüm işlem geri alınır.
      const kapanan = await tx.vardiya.updateMany({
        where: { id: acik.id, bitis: null },
        data: {
          bitis: sinir,
          otomatikKapanis: true,
          toplamNakit: new Prisma.Decimal(ozet.toplamNakit),
          toplamKart: new Prisma.Decimal(ozet.toplamKart),
          // kapanisKasa ve fark bilerek boş: kasa sayımı yapılmadı.
          notlar: [acik.notlar, `Günlük sıfırlama saatinde (${sinirMetni}) otomatik kapatıldı.`]
            .filter(Boolean)
            .join(" · "),
        },
      });
      if (kapanan.count === 0) throw new Error("SIFIRLAMA_GEREKSIZ");

      const yeni = await tx.vardiya.create({
        data: {
          // Sistem kapattığı için "açan" olarak önceki vardiyanın sahibi
          // devreder; işlem günlüğü zaten otomatik olduğunu yazıyor.
          kullaniciId: acik.kullaniciId,
          baslangic: sinir,
          acilisKasa: devredenKasa,
          notlar: `Günlük sıfırlama (${sinirMetni}) ile otomatik açıldı.`,
        },
      });

      await islemGunluguYazTx(tx, {
        kullaniciId: acik.kullaniciId,
        islemTipi: "VARDIYA_KAPANIS",
        ilgiliKayitId: acik.id,
        yeniDeger: {
          otomatik: true,
          bitis: sinir.toISOString(),
          toplamNakit: ozet.toplamNakit,
          toplamKart: ozet.toplamKart,
          nakitGider: ozet.nakitGider,
          kartGider: ozet.kartGider,
          beklenenKasa: ozet.beklenenKasa,
        },
        aciklama:
          `Vardiya günlük sıfırlama saatinde otomatik kapatıldı (${sinirMetni}) — ` +
          `nakit ${ozet.toplamNakit} TL, kart ${ozet.toplamKart} TL. Kasa sayılmadı.`,
      });

      await islemGunluguYazTx(tx, {
        kullaniciId: acik.kullaniciId,
        islemTipi: "VARDIYA_ACILIS",
        ilgiliKayitId: yeni.id,
        yeniDeger: { otomatik: true, acilisKasa: ozet.beklenenKasa, oncekiVardiyaId: acik.id },
        aciklama: `Yeni vardiya otomatik açıldı — devreden kasa ${ozet.beklenenKasa} TL`,
      });
    });
  } catch (hata) {
    // Yarış durumu (başkası aynı anda sıfırladı ya da elle kapattı) beklenen
    // bir sonuçtur; log kirletmesin. Diğer hatalarda sayfa çalışmaya devam
    // etsin — sıfırlama bir sonraki istekte yeniden denenir.
    const beklenen =
      (hata instanceof Error && hata.message === "SIFIRLAMA_GEREKSIZ") ||
      (hata instanceof Prisma.PrismaClientKnownRequestError && hata.code === "P2002");
    if (!beklenen) console.error("Vardiya otomatik sıfırlanamadı:", hata);
  }
}
