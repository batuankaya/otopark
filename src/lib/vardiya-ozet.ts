/**
 * Vardiya kasa özeti.
 *
 * Server Action dosyasında değil burada durur: hem sayfalar hem de otomatik
 * vardiya sıfırlaması aynı hesabı kullanıyor, `"use server"` dosyasından
 * içe aktarmak gereksiz bir istemci sınırı yaratırdı.
 */

import { sayiyaCevir } from "./para";
import { prisma } from "./prisma";

/**
 * Bir vardiyanın kasa özeti.
 * Tahsilat, çıkışın yapıldığı vardiyaya yazılır (cikisVardiyaId) — araç
 * bir vardiyada girip başka vardiyada çıkabilir, para ikinci kasaya girer.
 */
export async function vardiyaOzetiHesapla(vardiyaId: string) {
  const [
    tahsilatlar,
    girisSayisi,
    cikisSayisi,
    vardiya,
    giderGruplari,
    borclar,
    ucretsizCikisSayisi,
  ] = await Promise.all([
    prisma.parkKaydi.groupBy({
      by: ["odemeYontemi"],
      where: { cikisVardiyaId: vardiyaId, durum: "CIKTI" },
      // Eski borç tahsilatı da bu vardiyanın kasasına girer: para fiilen
      // burada alınmıştır, borcun doğduğu vardiya değil bu vardiya sayar.
      _sum: { tahsilEdilenUcret: true, tahsilEdilenBorc: true },
      _count: { _all: true },
    }),
    prisma.parkKaydi.count({ where: { vardiyaId, durum: { not: "IPTAL" } } }),
    prisma.parkKaydi.count({ where: { cikisVardiyaId: vardiyaId, durum: "CIKTI" } }),
    prisma.vardiya.findUnique({ where: { id: vardiyaId } }),
    prisma.gider.groupBy({
      by: ["odemeYontemi"],
      where: { vardiyaId },
      _sum: { tutar: true },
    }),
    prisma.parkKaydi.aggregate({
      where: { cikisVardiyaId: vardiyaId, durum: "CIKTI", borcTutari: { gt: 0 } },
      _sum: { borcTutari: true },
      _count: { _all: true },
    }),
    // Ücretsiz çıkış = para alınmayan çıkış. Borçlu çıkışta da ödeme yöntemi
    // boştur ama o araç ücretsiz çıkmamıştır — ayrı sayılmalı.
    prisma.parkKaydi.count({
      where: { cikisVardiyaId: vardiyaId, durum: "CIKTI", odemeYontemi: null, borcTutari: 0 },
    }),
  ]);

  const topla = (yontem: "NAKIT" | "KART") => {
    const grup = tahsilatlar.find((t) => t.odemeYontemi === yontem);
    return (
      sayiyaCevir(grup?._sum.tahsilEdilenUcret) + sayiyaCevir(grup?._sum.tahsilEdilenBorc)
    );
  };

  const toplamNakit = topla("NAKIT");
  const toplamKart = topla("KART");
  const acilisKasa = sayiyaCevir(vardiya?.acilisKasa);

  const giderTopla = (yontem: "NAKIT" | "KART") =>
    sayiyaCevir(giderGruplari.find((g) => g.odemeYontemi === yontem)?._sum.tutar);

  const nakitGider = giderTopla("NAKIT");
  const kartGider = giderTopla("KART");

  return {
    toplamNakit,
    toplamKart,
    toplamTahsilat: toplamNakit + toplamKart,
    acilisKasa,
    nakitGider,
    kartGider,
    toplamGider: nakitGider + kartGider,
    /**
     * Kasada olması gereken nakit.
     * Nakit giderler kasadan çıktığı için düşülür; kartla ödenen giderler
     * kasayı etkilemez.
     */
    beklenenKasa: acilisKasa + toplamNakit - nakitGider,
    /** Giderler düşülmüş net kazanç. */
    netKazanc: toplamNakit + toplamKart - nakitGider - kartGider,
    girisSayisi,
    cikisSayisi,
    ucretsizCikisSayisi,
    /** Bu vardiyada ödemeden çıkan araçların bıraktığı toplam borç. */
    olusanBorc: sayiyaCevir(borclar._sum.borcTutari),
    borcluCikisSayisi: borclar._count._all,
    /** Bu vardiyada kasaya giren eski borç tahsilatı. */
    tahsilEdilenBorc: tahsilatlar.reduce(
      (toplam, grup) => toplam + sayiyaCevir(grup._sum.tahsilEdilenBorc),
      0,
    ),
  };
}
