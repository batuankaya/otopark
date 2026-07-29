import { formatlaPlaka } from "@/lib/plaka";

type Boyut = "kucuk" | "orta" | "buyuk";

const boyutSiniflari: Record<Boyut, string> = {
  kucuk: "text-sm px-1.5 py-0.5 gap-1",
  orta: "text-lg px-2 py-1 gap-1.5",
  buyuk: "text-3xl px-3 py-1.5 gap-2",
};

/**
 * Plakayı gerçek plaka görünümünde gösterir: solda ülke şeridi, sağda plaka.
 * Açık havada okunabilirlik için yüksek kontrast.
 *
 * Üç durum:
 *  - Türk plakası  → mavi "TR" şerit
 *  - Yabancı plaka → turuncu ülke kodu şeridi (BG, DE, GE…)
 *  - Plakasız kayıt → gri "PLAKASIZ" şerit, yanında marka/model
 *    (görevli plakayı okuyamadığında aracı marka/model ile kaydedebiliyor)
 */
export function PlakaGoster({
  plaka,
  gosterim,
  ulkeKodu,
  yabanci,
  marka,
  model,
  fisNo,
  boyut = "orta",
  className = "",
}: {
  /** Veritabanındaki normalize plaka. Plakasız kayıtta null. */
  plaka: string | null;
  /** Varsa görevlinin yazdığı okunabilir hâl (yabancı plakalarda önemli). */
  gosterim?: string | null;
  ulkeKodu?: string | null;
  yabanci?: boolean;
  /** Plakasız kayıtta aracı tanıtan bilgiler. */
  marka?: string | null;
  model?: string | null;
  fisNo?: number | null;
  boyut?: Boyut;
  className?: string;
}) {
  const plakasiz = !plaka;

  const metin = plakasiz
    ? [marka, model].filter(Boolean).join(" ") || (fisNo ? `Fiş #${fisNo}` : "Plakasız")
    : gosterim?.trim() || (yabanci ? plaka : formatlaPlaka(plaka));

  const yabanciMi = !plakasiz && (yabanci ?? !!ulkeKodu);
  const seritEtiketi = plakasiz ? "PLAKASIZ" : yabanciMi ? ulkeKodu || "YB" : "TR";
  const seritRengi = plakasiz ? "bg-neutral-600" : yabanciMi ? "bg-amber-600" : "bg-blue-700";

  return (
    <span
      className={`inline-flex items-stretch overflow-hidden rounded border-2 bg-white font-mono font-bold tracking-wider text-neutral-900 ${
        plakasiz ? "border-dashed border-neutral-500" : "border-neutral-900"
      } ${className}`}
      aria-label={
        plakasiz
          ? `Plakasız araç: ${metin}`
          : `${yabanciMi ? "Yabancı plaka" : "Plaka"} ${metin}`
      }
      title={plakasiz ? "Plaka girilmemiş — düzenleyerek ekleyebilirsiniz" : undefined}
    >
      <span
        aria-hidden
        className={`flex items-center px-1 text-[0.6em] font-bold text-white ${seritRengi}`}
      >
        {seritEtiketi}
      </span>
      <span className={`flex items-center whitespace-nowrap ${boyutSiniflari[boyut]}`}>
        {metin}
      </span>
    </span>
  );
}
