import Link from "next/link";

type Renk = "mavi" | "yesil" | "kirmizi" | "gri";

const renkSiniflari: Record<Renk, string> = {
  mavi: "bg-blue-700 text-white hover:bg-blue-800 focus-visible:ring-blue-300",
  yesil: "bg-green-700 text-white hover:bg-green-800 focus-visible:ring-green-300",
  kirmizi: "bg-red-700 text-white hover:bg-red-800 focus-visible:ring-red-300",
  gri: "bg-white text-neutral-900 border-2 border-neutral-300 hover:bg-neutral-50 focus-visible:ring-neutral-300",
};

/**
 * Ana pano üzerindeki büyük işlem butonu.
 * Yükseklik 96px: eldivenle, tek elle, yürürken dokunulabilsin diye.
 */
export function BuyukButon({
  href,
  baslik,
  altBaslik,
  simge,
  renk = "mavi",
  devreDisi,
}: {
  href: string;
  baslik: string;
  altBaslik?: string;
  simge: string;
  renk?: Renk;
  devreDisi?: boolean;
}) {
  const siniflar = `flex min-h-24 w-full items-center gap-4 rounded-xl px-5 text-left shadow-sm transition-colors focus:outline-none focus-visible:ring-4 ${renkSiniflari[renk]}`;

  const icerik = (
    <>
      <span aria-hidden className="text-4xl leading-none">
        {simge}
      </span>
      <span className="flex-1">
        <span className="block text-2xl font-bold tracking-tight">{baslik}</span>
        {altBaslik && <span className="mt-0.5 block text-sm opacity-90">{altBaslik}</span>}
      </span>
    </>
  );

  if (devreDisi) {
    return (
      <div aria-disabled className={`${siniflar} cursor-not-allowed opacity-50`}>
        {icerik}
      </div>
    );
  }

  return (
    <Link href={href} className={siniflar}>
      {icerik}
    </Link>
  );
}
