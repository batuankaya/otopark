/**
 * Para birimi yardımcıları — her yerde TRY, Türkçe biçim.
 *
 * Prisma `Decimal` döndürdüğü için tutarlar veritabanı sınırında
 * `sayiyaCevir` ile `number`a indirgenir. Hesaplama katmanı (lib/ucret.ts)
 * yalnızca `number` ile çalışır.
 */

const paraBicimi = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const sayiBicimi = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Prisma Decimal | string | number | null → number */
export function sayiyaCevir(deger: unknown): number {
  if (deger === null || deger === undefined) return 0;
  if (typeof deger === "number") return deger;
  if (typeof deger === "string") return Number(deger) || 0;
  // Prisma.Decimal ve benzeri nesneler toString/toNumber sunar.
  if (typeof deger === "object") {
    const nesne = deger as { toNumber?: () => number; toString?: () => string };
    if (typeof nesne.toNumber === "function") return nesne.toNumber();
    if (typeof nesne.toString === "function") return Number(nesne.toString()) || 0;
  }
  return 0;
}

/** 1234.5 → "₺1.234,50" */
export function formatlaPara(deger: unknown): string {
  return paraBicimi.format(sayiyaCevir(deger));
}

/** 1234.5 → "1.234,50" (para simgesi olmadan; tablo ve CSV için) */
export function formatlaTutar(deger: unknown): string {
  return sayiBicimi.format(sayiyaCevir(deger));
}

/**
 * Kullanıcının yazdığı tutarı sayıya çevirir. Hem "1.234,50" hem "1234.50"
 * kabul edilir — görevli hangi biçimi yazarsa yazsın çalışsın diye.
 */
export function tutarAyristir(girdi: string): number | null {
  if (typeof girdi !== "string") return null;
  const temiz = girdi.trim();
  if (!temiz) return null;

  // Türkçe biçim: binlik ".", ondalık ","
  const normalize = temiz.includes(",")
    ? temiz.replace(/\./g, "").replace(",", ".")
    : temiz;

  const sayi = Number(normalize);
  if (!Number.isFinite(sayi) || sayi < 0) return null;
  return Math.round(sayi * 100) / 100;
}
