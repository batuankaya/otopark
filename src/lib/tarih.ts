/**
 * Tarih/saat yardımcıları.
 *
 * Kural: veritabanı UTC saklar, arayüz her zaman Europe/Istanbul gösterir.
 * Rapor aralıkları da İstanbul saatine göre hesaplanır — "bugünün cirosu"
 * sunucunun saat dilimine göre kaymasın diye.
 */

export const ZAMAN_DILIMI = "Europe/Istanbul";

// hour12: false her yerde açıkça verilir — saat biçimi kullanıcının işletim
// sistemi diline göre AM/PM'e dönmesin.
const tarihSaatBicimi = new Intl.DateTimeFormat("tr-TR", {
  timeZone: ZAMAN_DILIMI,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const saatBicimi = new Intl.DateTimeFormat("tr-TR", {
  timeZone: ZAMAN_DILIMI,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const tarihBicimi = new Intl.DateTimeFormat("tr-TR", {
  timeZone: ZAMAN_DILIMI,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const uzunTarihBicimi = new Intl.DateTimeFormat("tr-TR", {
  timeZone: ZAMAN_DILIMI,
  day: "numeric",
  month: "long",
  year: "numeric",
  weekday: "long",
});

/** 27.07.2026 14:35 */
export function formatlaTarihSaat(tarih: Date | string | null | undefined): string {
  if (!tarih) return "—";
  return tarihSaatBicimi.format(new Date(tarih));
}

/** 14:35 */
export function formatlaSaat(tarih: Date | string | null | undefined): string {
  if (!tarih) return "—";
  return saatBicimi.format(new Date(tarih));
}

/** 27.07.2026 */
export function formatlaTarih(tarih: Date | string | null | undefined): string {
  if (!tarih) return "—";
  return tarihBicimi.format(new Date(tarih));
}

/** 27 Temmuz 2026 Pazartesi */
export function formatlaUzunTarih(tarih: Date | string | null | undefined): string {
  if (!tarih) return "—";
  return uzunTarihBicimi.format(new Date(tarih));
}

/**
 * Süreyi insan diliyle yazar: "2 gün 3 sa 15 dk", "45 dk".
 */
export function formatlaSure(dakika: number): string {
  if (!Number.isFinite(dakika) || dakika < 0) return "—";
  const tamDakika = Math.floor(dakika);

  const gun = Math.floor(tamDakika / 1440);
  const saat = Math.floor((tamDakika % 1440) / 60);
  const dk = tamDakika % 60;

  const parcalar: string[] = [];
  if (gun > 0) parcalar.push(`${gun} gün`);
  if (saat > 0) parcalar.push(`${saat} sa`);
  if (dk > 0 || parcalar.length === 0) parcalar.push(`${dk} dk`);
  return parcalar.join(" ");
}

/** İki zaman arası süreyi doğrudan metin olarak verir. */
export function sureMetni(baslangic: Date | string, bitis: Date | string = new Date()): string {
  const fark = new Date(bitis).getTime() - new Date(baslangic).getTime();
  return formatlaSure(Math.max(0, Math.floor(fark / 60000)));
}

/** Park süresi 24 saati aştı mı? İçerideki araçlar listesinde işaretlemek için. */
export function yirmiDortSaatiAstiMi(girisZamani: Date | string, simdi: Date = new Date()): boolean {
  return simdi.getTime() - new Date(girisZamani).getTime() >= 24 * 60 * 60 * 1000;
}

// ---------------------------------------------------------------------------
// Zaman dilimine duyarlı gün sınırları (rapor aralıkları için)
// ---------------------------------------------------------------------------

/**
 * Verilen anın Europe/Istanbul'daki takvim bileşenlerini verir.
 * Sunucunun kendi saat dilimi ne olursa olsun doğru sonuç üretir.
 */
function istanbulParcalari(tarih: Date) {
  const parcalar = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZAMAN_DILIMI,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(tarih);

  const al = (tip: string) => Number(parcalar.find((p) => p.type === tip)?.value ?? "0");
  return {
    yil: al("year"),
    ay: al("month"),
    gun: al("day"),
    // Intl bazı ortamlarda gece yarısını "24" olarak verir.
    saat: al("hour") % 24,
    dakika: al("minute"),
    saniye: al("second"),
  };
}

/** Europe/Istanbul'un o andaki UTC farkı (dakika). Yaz saati değişimlerine dayanıklı. */
function istanbulOfsetDakika(tarih: Date): number {
  const p = istanbulParcalari(tarih);
  const yerelVarsayim = Date.UTC(p.yil, p.ay - 1, p.gun, p.saat, p.dakika, p.saniye);
  return (yerelVarsayim - Math.floor(tarih.getTime() / 1000) * 1000) / 60000;
}

/** İstanbul saatiyle günün başlangıcı (00:00) — UTC `Date` olarak döner. */
export function gunBaslangici(tarih: Date = new Date()): Date {
  const p = istanbulParcalari(tarih);
  const ofset = istanbulOfsetDakika(tarih);
  return new Date(Date.UTC(p.yil, p.ay - 1, p.gun, 0, 0, 0) - ofset * 60000);
}

/** İstanbul saatiyle günün sonu (ertesi gün 00:00). */
export function gunSonu(tarih: Date = new Date()): Date {
  const baslangic = gunBaslangici(tarih);
  return new Date(baslangic.getTime() + 24 * 60 * 60 * 1000);
}

/** N gün öncesinin gün başlangıcı. */
export function gunEkle(tarih: Date, gun: number): Date {
  return new Date(tarih.getTime() + gun * 24 * 60 * 60 * 1000);
}

export type TarihAraligi = { baslangic: Date; bitis: Date; etiket: string };

/** Raporlarda kullanılan hazır aralıklar. */
export function tarihAraligiOlustur(
  tur: "bugun" | "hafta" | "ay",
  referans: Date = new Date(),
): TarihAraligi {
  const bugunBas = gunBaslangici(referans);

  switch (tur) {
    case "bugun":
      return { baslangic: bugunBas, bitis: gunSonu(referans), etiket: "Bugün" };
    case "hafta":
      // Son 7 gün (bugün dahil)
      return {
        baslangic: gunEkle(bugunBas, -6),
        bitis: gunSonu(referans),
        etiket: "Son 7 gün",
      };
    case "ay":
      return {
        baslangic: gunEkle(bugunBas, -29),
        bitis: gunSonu(referans),
        etiket: "Son 30 gün",
      };
  }
}

/** `<input type="date">` için YYYY-MM-DD (İstanbul saatiyle). */
export function tarihGirdisiDegeri(tarih: Date = new Date()): string {
  const p = istanbulParcalari(tarih);
  return `${p.yil}-${String(p.ay).padStart(2, "0")}-${String(p.gun).padStart(2, "0")}`;
}

/**
 * "HH:MM" biçimindeki saati bir günün o saatine çevirir (Europe/Istanbul).
 *
 * `referans` verilmezse BUGÜN kullanılır — geriye dönük araç girişinde görevli
 * 16:00'da "15:25'te gelmişti" dediğinde tarih sormaya gerek kalmasın diye.
 * Geçmiş bir günün saatini hesaplamak için `referans` verilir (mesai kaydı
 * düzeltmesi bunu kullanır).
 *
 * Geçersiz girdide `null` döner.
 */
export function bugununSaati(hhmm: string, referans: Date = new Date()): Date | null {
  const eslesme = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!eslesme) return null;

  const saat = Number(eslesme[1]);
  const dakika = Number(eslesme[2]);
  if (saat > 23 || dakika > 59) return null;

  // gunBaslangici, İstanbul gece yarısının UTC karşılığını verir; üzerine
  // saat/dakika eklemek doğru anı üretir (Türkiye'de yaz saati uygulaması yok).
  return new Date(gunBaslangici(referans).getTime() + (saat * 60 + dakika) * 60_000);
}

/** 24 saatlik "HH:MM" biçimi (İstanbul saatiyle). */
export function saatGirdisiDegeri(tarih: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: ZAMAN_DILIMI,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(tarih);
}

/** Abonman bitişine kaç gün kaldı? Geçmişse negatif döner. */
export function kalanGun(bitisTarihi: Date | string, simdi: Date = new Date()): number {
  const bitis = gunBaslangici(new Date(bitisTarihi));
  const bugun = gunBaslangici(simdi);
  return Math.round((bitis.getTime() - bugun.getTime()) / (24 * 60 * 60 * 1000));
}
