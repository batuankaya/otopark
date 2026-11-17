/**
 * Excel'e uygun CSV üretimi.
 *
 * Excel Türkçe yerelde noktalı virgülle ayrılmış dosya bekler.
 */

export const AYIRAC = ";";

/**
 * Formül enjeksiyonuna karşı: `=`, `+`, `-`, `@`, sekme veya satır başıyla
 * başlayan hücreyi Excel formül olarak çalıştırır. Görevlinin yazdığı bir
 * not ya da sebep (`=HYPERLINK(...)`) yöneticinin bilgisayarında çalışmasın
 * diye başına `'` eklenir. Sayılar (ör. "-12,50") olduğu gibi bırakılır.
 */
function formulEtkisizlestir(metin: string): string {
  if (!/^[=+\-@\t\r]/.test(metin)) return metin;
  if (/^-\d+(,\d+)?$/.test(metin)) return metin;
  return `'${metin}`;
}

export function csvAlani(deger: unknown): string {
  if (deger === null || deger === undefined) return "";
  const metin = formulEtkisizlestir(String(deger));
  if (metin.includes(AYIRAC) || metin.includes('"') || metin.includes("\n") || metin.includes("\r")) {
    return `"${metin.replace(/"/g, '""')}"`;
  }
  return metin;
}

export function csvSatiri(alanlar: unknown[]): string {
  return alanlar.map(csvAlani).join(AYIRAC);
}
