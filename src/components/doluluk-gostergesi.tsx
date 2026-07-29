/**
 * Ana panodaki anlık doluluk göstergesi.
 * %90 üstü turuncu, dolu ise kırmızı — görevli uzaktan bakınca anlasın.
 */
export function DolulukGostergesi({
  iceride,
  kapasite,
  bosYer,
  yuzde,
}: {
  iceride: number;
  kapasite: number;
  bosYer: number;
  yuzde: number;
}) {
  const renk =
    yuzde >= 100 ? "bg-red-600" : yuzde >= 90 ? "bg-orange-500" : "bg-green-600";

  return (
    <section
      aria-label="Anlık doluluk"
      className="rounded-xl border border-neutral-300 bg-white p-4"
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
            İçerideki araç
          </div>
          <div className="mt-0.5 text-4xl font-bold tabular-nums text-neutral-900">
            {iceride}
            <span className="text-2xl font-normal text-neutral-500"> / {kapasite}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
            Boş yer
          </div>
          <div
            className={`mt-0.5 text-4xl font-bold tabular-nums ${
              bosYer === 0 ? "text-red-700" : "text-green-700"
            }`}
          >
            {bosYer}
          </div>
        </div>
      </div>

      <div
        className="mt-3 h-3 w-full overflow-hidden rounded-full bg-neutral-200"
        role="progressbar"
        aria-valuenow={yuzde}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Doluluk %${yuzde}`}
      >
        <div className={`h-full rounded-full ${renk}`} style={{ width: `${yuzde}%` }} />
      </div>

      <div className="mt-1.5 text-sm text-neutral-600">Doluluk %{yuzde}</div>

      {bosYer === 0 && (
        <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-base font-bold text-red-800">
          Otopark dolu — yeni araç alınamaz.
        </p>
      )}
    </section>
  );
}
