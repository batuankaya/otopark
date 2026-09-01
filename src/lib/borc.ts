/**
 * Borç — ödemeden çıkan araçların açık kalan alacağı.
 *
 * Borç ayrı bir tabloda değil, borcun doğduğu park kaydının üzerinde tutulur:
 * her borcun kaynağı tek bir çıkıştır ve tahsilatı da yine bir çıkış ekranından
 * yapılır, dolayısıyla ayrı bir varlık kazandırdığı bir şey yok.
 *
 * Tahsilat, ödemenin yapıldığı çıkışın kaydına (`tahsilEdilenBorc`) yazılır;
 * kasa ve ciro o çıkışın vardiyasına düşer — para gerçekten o vardiyada
 * kasaya girdiği için.
 */

import type { Prisma } from "@prisma/client";

import { sayiyaCevir } from "./para";
import { prisma } from "./prisma";

/** Kuruş hatası birikmesin diye her tutar iki haneye yuvarlanır. */
export function kurusYuvarla(tutar: number): number {
  return Math.round(tutar * 100) / 100;
}

export type AcikBorc = {
  id: string;
  fisNo: number;
  cikisZamani: Date | null;
  /** Çıkışta doğan borç. */
  tutar: number;
  /** Kalan bakiye. */
  kalan: number;
};

/**
 * Bir aracın kapanmamış borçları — en eskisi başta.
 *
 * Plakasız kayıtlarda `aracId` boştur: o kayıtta doğan borç sonradan bir
 * araçla eşleştirilemez, bu yüzden burada da görünmez. Çıkış ekranı bu
 * durumda görevliyi uyarır.
 */
export async function acikBorclariAl(aracId: string): Promise<AcikBorc[]> {
  const kayitlar = await prisma.parkKaydi.findMany({
    where: { aracId, borcKalan: { gt: 0 }, durum: "CIKTI" },
    orderBy: { cikisZamani: "asc" },
    select: {
      id: true,
      fisNo: true,
      cikisZamani: true,
      borcTutari: true,
      borcKalan: true,
    },
  });

  return kayitlar.map((kayit) => ({
    id: kayit.id,
    fisNo: kayit.fisNo,
    cikisZamani: kayit.cikisZamani,
    tutar: sayiyaCevir(kayit.borcTutari),
    kalan: sayiyaCevir(kayit.borcKalan),
  }));
}

/**
 * Birden çok aracın açık borç toplamı — plaka arama ve içerideki araçlar
 * listeleri her satır için ayrı sorgu atmasın diye tek groupBy ile alınır.
 */
export async function araclarinAcikBorclari(
  aracIdler: string[],
): Promise<Map<string, number>> {
  const benzersiz = [...new Set(aracIdler)];
  if (benzersiz.length === 0) return new Map();

  const gruplar = await prisma.parkKaydi.groupBy({
    by: ["aracId"],
    where: { aracId: { in: benzersiz }, borcKalan: { gt: 0 }, durum: "CIKTI" },
    _sum: { borcKalan: true },
  });

  return new Map(
    gruplar.flatMap((grup) =>
      grup.aracId ? [[grup.aracId, sayiyaCevir(grup._sum.borcKalan)] as const] : [],
    ),
  );
}

export function borcToplami(borclar: Array<{ kalan: number }>): number {
  return kurusYuvarla(borclar.reduce((toplam, borc) => toplam + borc.kalan, 0));
}

/**
 * Tahsil edilen tutarı açık borçlara dağıtır — en eskisinden başlayarak.
 *
 * En eski borcun önce kapanması, "hangi borç ne zamandır duruyor" sorusunu
 * anlamlı tutar; aksi hâlde kısmi ödemeler eski kayıtları süresiz açık
 * bırakırdı.
 */
export type BorcPayi = {
  id: string;
  /** Dağıtım hesaplanırken görülen bakiye — koşullu güncellemenin anahtarı. */
  oncekiKalan: number;
  dusulen: number;
  kalan: number;
};

export function borcDagit(borclar: AcikBorc[], tutar: number): BorcPayi[] {
  let kalanTahsilat = kurusYuvarla(tutar);
  const dagitim: BorcPayi[] = [];

  for (const borc of borclar) {
    if (kalanTahsilat <= 0) break;
    const dusulen = Math.min(borc.kalan, kalanTahsilat);
    if (dusulen <= 0) continue;
    dagitim.push({
      id: borc.id,
      oncekiKalan: borc.kalan,
      dusulen: kurusYuvarla(dusulen),
      kalan: kurusYuvarla(borc.kalan - dusulen),
    });
    kalanTahsilat = kurusYuvarla(kalanTahsilat - dusulen);
  }

  return dagitim;
}

/**
 * Dağıtımı veritabanına işler — çıkış işleminin transaction'ı içinde çağrılır.
 *
 * Güncelleme koşulludur: bakiye, dağıtım hesaplanırken görülen değerden
 * farklıysa hiçbir şey yazılmaz ve `BORC_DEGISTI` fırlatılır. Aksi hâlde
 * iki görevli aynı borcu aynı anda tahsil ettiğinde para iki kez kasaya
 * girer ama borç bir kez kapanırdı.
 */
export async function borcDagitiminiYazTx(
  tx: Prisma.TransactionClient,
  dagitim: BorcPayi[],
): Promise<void> {
  for (const pay of dagitim) {
    const sonuc = await tx.parkKaydi.updateMany({
      where: { id: pay.id, borcKalan: pay.oncekiKalan },
      data: { borcKalan: pay.kalan },
    });
    if (sonuc.count === 0) throw new Error("BORC_DEGISTI");
  }
}
