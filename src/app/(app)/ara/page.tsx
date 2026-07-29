import type { Metadata } from "next";

import { PlakaArama } from "@/components/plaka-arama";
import { oturumZorunlu } from "@/lib/yetki";

export const metadata: Metadata = { title: "Plaka Ara" };
export const dynamic = "force-dynamic";

export default async function AraSayfasi() {
  await oturumZorunlu();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-neutral-900">Plaka Ara</h1>
      <PlakaArama />
    </div>
  );
}
